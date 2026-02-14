import { WebSocket } from 'ws';
import { Game } from './Game.js';
import { Dictionary } from './Dictionary.js';

interface RoomPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

export class Room {
  readonly code: string;
  private players: Map<string, RoomPlayer> = new Map();
  private hostId: string;
  game: Game;

  constructor(code: string, dictionary: Dictionary) {
    this.code = code;
    this.hostId = '';
    this.game = new Game(dictionary);
  }

  addPlayer(id: string, name: string, ws: WebSocket): void {
    this.players.set(id, { id, name, ws });
    this.game.addPlayer(id, name);
    if (this.players.size === 1) {
      this.hostId = id;
    }
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player?.reconnectTimer) clearTimeout(player.reconnectTimer);
    this.players.delete(id);
    if (this.game.gamePhase === 'waiting') {
      this.game.removePlayer(id);
    }
  }

  reconnectPlayer(id: string, ws: WebSocket): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer);
      player.reconnectTimer = undefined;
    }
    player.ws = ws;
    this.game.setConnected(id, true);
    return true;
  }

  handleDisconnect(id: string, onTimeout: () => void): void {
    const player = this.players.get(id);
    if (!player) return;

    this.game.setConnected(id, false);

    if (this.game.gamePhase === 'playing') {
      // 60秒の再接続猶予
      player.reconnectTimer = setTimeout(() => {
        this.removePlayer(id);
        onTimeout();
      }, 60_000);
    } else {
      this.removePlayer(id);
      onTimeout();
    }
  }

  isHost(id: string): boolean {
    return id === this.hostId;
  }

  getPlayerWs(id: string): WebSocket | undefined {
    return this.players.get(id)?.ws;
  }

  broadcast(message: object, excludeId?: string): void {
    const data = JSON.stringify(message);
    for (const [id, player] of this.players) {
      if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }

  sendTo(id: string, message: object): void {
    const player = this.players.get(id);
    if (player && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  }

  get playerCount(): number {
    return this.players.size;
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  getPlayerIds(): string[] {
    return [...this.players.keys()];
  }
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private dictionary: Dictionary;

  constructor(dictionary: Dictionary) {
    this.dictionary = dictionary;
  }

  createRoom(): Room {
    const code = this.generateCode();
    const room = new Room(code, this.dictionary);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }
}
