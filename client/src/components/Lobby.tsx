import { useState } from 'react';
import { RulesModal } from './RulesModal';

interface Props {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (name: string, code: string) => void;
}

export function Lobby({ onCreateRoom, onJoinRoom }: Props) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="lobby">
      <h2>ひらがなスクラブルへようこそ</h2>
      <div className="lobby-actions">
        <div className="lobby-section">
          <h3>名前を入力</h3>
          <input
            type="text"
            placeholder="プレイヤー名"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={10}
          />
        </div>

        <div className="lobby-section">
          <h3>新しい部屋を作る</h3>
          <button
            className="btn btn-primary"
            onClick={() => onCreateRoom(name)}
            disabled={!name.trim()}
          >
            部屋を作成
          </button>
        </div>

        <div className="lobby-section">
          <h3>部屋に参加する</h3>
          <input
            type="text"
            placeholder="部屋コード (4文字)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
          />
          <button
            className="btn btn-primary"
            onClick={() => onJoinRoom(name, joinCode)}
            disabled={!name.trim() || joinCode.length !== 4}
          >
            参加
          </button>
        </div>
      </div>

      <button className="btn btn-secondary" onClick={() => setShowRules(true)}>
        遊び方
      </button>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
