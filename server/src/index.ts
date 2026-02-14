import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from 'shared/src/protocol.js';
import { Dictionary } from './Dictionary.js';
import { RoomManager, Room } from './Room.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);

const dictionary = new Dictionary();
const roomManager = new RoomManager(dictionary);

// Player ID → Room code mapping
const playerRoomMap = new Map<string, string>();

const server = http.createServer((req, res) => {
  // Serve static client build files
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');

  if (req.url === '/' || req.url === '/index.html') {
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h1>日本語スクラブル サーバー稼働中</h1><p>クライアントをビルドしてください: npm run build -w client</p></body></html>');
    }
    return;
  }

  // Static file serving
  const filePath = path.join(clientDist, req.url || '');
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  let playerId = '';
  let roomCode = '';

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendError(ws, '不正なメッセージです');
      return;
    }

    try {
      switch (msg.type) {
        case 'CREATE_ROOM': {
          playerId = randomUUID();
          const room = roomManager.createRoom();
          roomCode = room.code;
          room.addPlayer(playerId, msg.playerName, ws);
          playerRoomMap.set(playerId, roomCode);

          send(ws, {
            type: 'ROOM_CREATED',
            roomCode: room.code,
            playerId,
          });
          break;
        }

        case 'JOIN_ROOM': {
          const room = roomManager.getRoom(msg.roomCode);
          if (!room) {
            sendError(ws, '部屋が見つかりません');
            return;
          }
          if (room.game.gamePhase !== 'waiting') {
            sendError(ws, 'ゲームは既に開始されています');
            return;
          }
          if (room.playerCount >= 4) {
            sendError(ws, '部屋が満員です');
            return;
          }

          playerId = randomUUID();
          roomCode = room.code;
          room.addPlayer(playerId, msg.playerName, ws);
          playerRoomMap.set(playerId, roomCode);

          send(ws, {
            type: 'ROOM_JOINED',
            roomCode: room.code,
            playerId,
            players: room.game.getPlayersInfo(),
          });

          room.broadcast({
            type: 'PLAYER_JOINED',
            player: { id: playerId, name: msg.playerName, score: 0, tileCount: 0, connected: true },
          } as ServerMessage, playerId);
          break;
        }

        case 'RECONNECT': {
          const room = roomManager.getRoom(msg.roomCode);
          if (!room) {
            sendError(ws, '部屋が見つかりません');
            return;
          }
          if (room.reconnectPlayer(msg.playerId, ws)) {
            playerId = msg.playerId;
            roomCode = room.code;

            send(ws, {
              type: 'GAME_STATE',
              gameState: room.game.getStateForPlayer(playerId),
            });

            room.broadcast({ type: 'PLAYER_RECONNECTED', playerId } as ServerMessage, playerId);
          } else {
            sendError(ws, '再接続に失敗しました');
          }
          break;
        }

        case 'START_GAME': {
          const room = getRoom();
          if (!room) return;
          if (!room.isHost(playerId)) {
            sendError(ws, 'ホストのみ開始できます');
            return;
          }

          room.game.setTurnTimeoutCallback(() => {
            // 時間切れ → 全プレイヤーに状態を送信
            for (const pid of room.getPlayerIds()) {
              const state = room.game.getStateForPlayer(pid);
              if (room.game.gamePhase === 'finished') {
                room.sendTo(pid, {
                  type: 'GAME_OVER',
                  gameState: state,
                  winner: room.game.getWinner()!,
                } as ServerMessage);
              } else {
                room.sendTo(pid, {
                  type: 'GAME_STATE',
                  gameState: state,
                } as ServerMessage);
              }
            }
          });

          room.game.start();

          // 各プレイヤーに個別の状態を送信
          for (const pid of room.getPlayerIds()) {
            room.sendTo(pid, {
              type: 'GAME_STARTED',
              gameState: room.game.getStateForPlayer(pid),
            } as ServerMessage);
          }
          break;
        }

        case 'PLAY_TILES': {
          const room = getRoom();
          if (!room) return;

          try {
            const result = room.game.playTiles(playerId, msg.placements);

            // 各プレイヤーに更新を送信
            for (const pid of room.getPlayerIds()) {
              const state = room.game.getStateForPlayer(pid);
              if (room.game.gamePhase === 'finished') {
                room.sendTo(pid, {
                  type: 'GAME_OVER',
                  gameState: state,
                  winner: room.game.getWinner()!,
                } as ServerMessage);
              } else {
                room.sendTo(pid, {
                  type: 'PLAY_RESULT',
                  success: true,
                  gameState: state,
                } as ServerMessage);
              }
            }
          } catch (e: any) {
            send(ws, {
              type: 'PLAY_RESULT',
              success: false,
              error: e.message || '配置エラー',
            });
          }
          break;
        }

        case 'EXCHANGE_TILES': {
          const room = getRoom();
          if (!room) return;

          room.game.exchangeTiles(playerId, msg.tileIds);

          for (const pid of room.getPlayerIds()) {
            room.sendTo(pid, {
              type: 'EXCHANGE_RESULT',
              success: true,
              gameState: room.game.getStateForPlayer(pid),
            } as ServerMessage);
          }
          break;
        }

        case 'PASS': {
          const room = getRoom();
          if (!room) return;

          room.game.pass(playerId);

          for (const pid of room.getPlayerIds()) {
            const state = room.game.getStateForPlayer(pid);
            if (room.game.gamePhase === 'finished') {
              room.sendTo(pid, {
                type: 'GAME_OVER',
                gameState: state,
                winner: room.game.getWinner()!,
              } as ServerMessage);
            } else {
              room.sendTo(pid, {
                type: 'GAME_STATE',
                gameState: state,
              } as ServerMessage);
            }
          }
          break;
        }
      }
    } catch (e: any) {
      sendError(ws, e.message || 'エラーが発生しました');
    }
  });

  ws.on('close', () => {
    if (!roomCode || !playerId) return;
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    room.handleDisconnect(playerId, () => {
      playerRoomMap.delete(playerId);
      room.broadcast({ type: 'PLAYER_LEFT', playerId } as ServerMessage);
      if (room.isEmpty) {
        roomManager.removeRoom(roomCode);
      }
    });
  });

  function getRoom(): Room | undefined {
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      sendError(ws, '部屋が見つかりません');
      return undefined;
    }
    return room;
  }
});

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function sendError(ws: WebSocket, message: string): void {
  send(ws, { type: 'ERROR', message });
}

server.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
});
