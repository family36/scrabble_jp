import type { PlayerInfo } from '../../../shared/src/protocol';

interface Props {
  roomCode: string;
  players: PlayerInfo[];
  playerId: string;
  isHost: boolean;
  onStartGame: () => void;
  onBack: () => void;
}

export function WaitingRoom({ roomCode, players, playerId, isHost, onStartGame, onBack }: Props) {
  return (
    <div className="waiting-room">
      <h2>部屋コード</h2>
      <div className="room-code">{roomCode}</div>
      <p style={{ color: 'var(--text-dim)' }}>このコードを友人に伝えてください</p>

      <div className="player-list">
        <h3>プレイヤー ({players.length}/4)</h3>
        {players.map(p => (
          <div key={p.id} className="player-item">
            {p.name} {p.id === playerId ? '(あなた)' : ''}
          </div>
        ))}
      </div>

      {isHost && players.length >= 2 && (
        <button className="btn btn-primary" onClick={onStartGame}>
          ゲーム開始
        </button>
      )}
      {isHost && players.length < 2 && (
        <p className="hint">2人以上でゲーム開始できます</p>
      )}
      {!isHost && (
        <p className="hint">ホストがゲームを開始するのを待っています...</p>
      )}

      <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: 12 }}>
        戻る
      </button>
    </div>
  );
}
