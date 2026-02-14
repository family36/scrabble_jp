import { useState, useCallback, useRef } from 'react';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { GameView } from './components/GameView';
import { useWebSocket } from './hooks/useWebSocket';
import type { GameState, ServerMessage, TilePlacement, PlayerInfo } from '../../shared/src/protocol';
import './App.css';

type Screen = 'lobby' | 'waiting' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [winner, setWinner] = useState<PlayerInfo | null>(null);
  const playerNameRef = useRef('');

  const handleMessage = useCallback((msg: ServerMessage) => {
    setError('');
    switch (msg.type) {
      case 'ROOM_CREATED':
        setRoomCode(msg.roomCode);
        setPlayerId(msg.playerId);
        setIsHost(true);
        setPlayers([{
          id: msg.playerId,
          name: playerNameRef.current,
          score: 0,
          tileCount: 0,
          connected: true,
        }]);
        setScreen('waiting');
        break;
      case 'ROOM_JOINED':
        setRoomCode(msg.roomCode);
        setPlayerId(msg.playerId);
        setPlayers(msg.players);
        setScreen('waiting');
        break;
      case 'PLAYER_JOINED':
        setPlayers(prev => [...prev, msg.player]);
        break;
      case 'PLAYER_LEFT':
        setPlayers(prev => prev.filter(p => p.id !== msg.playerId));
        break;
      case 'GAME_STARTED':
        setGameState(msg.gameState);
        setScreen('game');
        break;
      case 'GAME_STATE':
        setGameState(msg.gameState);
        if (screen !== 'game') setScreen('game');
        break;
      case 'PLAY_RESULT':
        if (msg.success && msg.gameState) setGameState(msg.gameState);
        if (!msg.success && msg.error) setError(msg.error);
        break;
      case 'EXCHANGE_RESULT':
        if (msg.success && msg.gameState) setGameState(msg.gameState);
        if (!msg.success && msg.error) setError(msg.error);
        break;
      case 'GAME_OVER':
        setGameState(msg.gameState);
        setWinner(msg.winner);
        break;
      case 'PLAYER_RECONNECTED':
        break;
      case 'ERROR':
        setError(msg.message);
        break;
    }
  }, [screen]);

  const { send, connected } = useWebSocket(handleMessage);

  const handleCreateRoom = (name: string) => {
    playerNameRef.current = name;
    send({ type: 'CREATE_ROOM', playerName: name });
  };

  const handleJoinRoom = (name: string, code: string) => {
    playerNameRef.current = name;
    send({ type: 'JOIN_ROOM', roomCode: code, playerName: name });
  };

  const handleStartGame = () => send({ type: 'START_GAME' });

  const handleBackToLobby = () => {
    setScreen('lobby');
    setRoomCode('');
    setPlayerId('');
    setPlayers([]);
    setIsHost(false);
    setGameState(null);
    setWinner(null);
    setError('');
  };

  const handlePlayTiles = (placements: TilePlacement[]) => {
    setError('');
    send({ type: 'PLAY_TILES', placements });
  };

  const handleExchange = (tileIds: number[]) => {
    setError('');
    send({ type: 'EXCHANGE_TILES', tileIds });
  };

  const handlePass = () => {
    setError('');
    send({ type: 'PASS' });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>日本語スクラブル</h1>
        {!connected && <span className="disconnected">切断中...</span>}
      </header>

      {error && screen !== 'game' && <div className="error-banner" onClick={() => setError('')}>{error}</div>}

      {screen === 'lobby' && (
        <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      )}

      {screen === 'waiting' && (
        <WaitingRoom
          roomCode={roomCode}
          players={players}
          playerId={playerId}
          isHost={isHost}
          onStartGame={handleStartGame}
          onBack={handleBackToLobby}
        />
      )}

      {screen === 'game' && gameState && (
        <GameView
          gameState={gameState}
          playerId={playerId}
          winner={winner}
          error={error}
          onPlayTiles={handlePlayTiles}
          onExchange={handleExchange}
          onPass={handlePass}
          onClearError={() => setError('')}
        />
      )}
    </div>
  );
}
