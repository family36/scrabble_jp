import { useState, useCallback, useEffect, useRef } from 'react';
import type { DragEvent } from 'react';
import type { GameState, Tile, TilePlacement, PlayerInfo } from '../../../shared/src/protocol';
import { BONUS_LAYOUT } from '../constants/board';
import { BlankTileModal } from './BlankTileModal';
import { DAKUTEN_MAP } from '../../../shared/src/kana';

interface Props {
  gameState: GameState;
  playerId: string;
  winner: PlayerInfo | null;
  error: string;
  onPlayTiles: (placements: TilePlacement[]) => void;
  onExchange: (tileIds: number[]) => void;
  onPass: () => void;
  onClearError: () => void;
  onTilePlace: () => void;
  onBGMFast: (fast: boolean) => void;
  muted: boolean;
  onToggleMute: () => void;
}

interface PendingPlacement {
  row: number;
  col: number;
  tile: Tile;
  assignedChar?: string;
}

const BONUS_LABELS: Record<string, string> = {
  TW: '3W',
  DW: '2W',
  TL: '3L',
  DL: '2L',
  START: '★',
};

export function GameView({ gameState, playerId, winner, error, onPlayTiles, onExchange, onPass, onClearError, onTilePlace, onBGMFast, muted, onToggleMute }: Props) {
  const [pendingPlacements, setPendingPlacements] = useState<PendingPlacement[]>([]);
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeSelection, setExchangeSelection] = useState<Set<number>>(new Set());
  const [blankModal, setBlankModal] = useState<{ tile: Tile; row: number; col: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ row: number; col: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const dragTileRef = useRef<Tile | null>(null);
  const dragSourceRef = useRef<{ row: number; col: number } | null>(null);

  // Rack tile selection + dakuten override
  const [selectedRackTile, setSelectedRackTile] = useState<Tile | null>(null);
  const [dakutenOverride, setDakutenOverride] = useState<string | undefined>(undefined);

  const isMyTurn = gameState.currentPlayerId === playerId;
  const isPlaying = gameState.phase === 'playing';
  const isFinished = gameState.phase === 'finished';

  // Dakuten variants for the selected rack tile
  const selectedVariants = selectedRackTile && !selectedRackTile.isBlank
    ? DAKUTEN_MAP[selectedRackTile.char] ?? null
    : null;
  const canDakuten = !!selectedVariants && selectedVariants.length >= 1;
  const canHandakuten = !!selectedVariants && selectedVariants.length >= 2;

  // Timer countdown + BGM speed-up when < 10s
  useEffect(() => {
    if (!isPlaying || gameState.turnDeadline <= 0) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      onBGMFast(remaining > 0 && remaining <= 10);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => {
      clearInterval(interval);
      onBGMFast(false);
    };
  }, [isPlaying, gameState.turnDeadline, onBGMFast]);

  // Clear pending placements when turn changes (successful play)
  const prevTurnPlayer = useRef(gameState.currentPlayerId);
  useEffect(() => {
    if (prevTurnPlayer.current !== gameState.currentPlayerId) {
      setPendingPlacements([]);
      setSelectedRackTile(null);
      setDakutenOverride(undefined);
      prevTurnPlayer.current = gameState.currentPlayerId;
    }
  }, [gameState.currentPlayerId]);

  // Rack tiles that haven't been placed on board yet
  const availableRack = gameState.rack.filter(
    t => !pendingPlacements.some(p => p.tile.id === t.id)
  );

  // The display char for the selected rack tile (with dakuten if active)
  const selectedDisplayChar = selectedRackTile
    ? dakutenOverride || selectedRackTile.char
    : null;

  // --- Dakuten/Handakuten handlers ---
  const handleDakutenToggle = () => {
    if (!selectedVariants) return;
    setDakutenOverride(prev =>
      prev === selectedVariants[0] ? undefined : selectedVariants[0]
    );
  };

  const handleHandakutenToggle = () => {
    if (!selectedVariants || selectedVariants.length < 2) return;
    setDakutenOverride(prev =>
      prev === selectedVariants[1] ? undefined : selectedVariants[1]
    );
  };

  // --- Drag & Drop handlers ---
  const handleDragStart = (e: DragEvent, tile: Tile, fromBoard?: { row: number; col: number }) => {
    if (!isMyTurn || !isPlaying || exchangeMode) return;
    dragTileRef.current = tile;
    dragSourceRef.current = fromBoard ?? null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tile.id));
  };

  const handleDragOver = (e: DragEvent, row: number, col: number) => {
    e.preventDefault();
    if (!dragTileRef.current) return;
    if (gameState.board[row][col]) return;
    const src = dragSourceRef.current;
    const isOwnCell = src && src.row === row && src.col === col;
    if (!isOwnCell && pendingPlacements.some(p => p.row === row && p.col === col)) return;
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ row, col });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: DragEvent, row: number, col: number) => {
    e.preventDefault();
    setDropTarget(null);
    const tile = dragTileRef.current;
    const source = dragSourceRef.current;
    dragTileRef.current = null;
    dragSourceRef.current = null;
    if (!tile) return;
    if (gameState.board[row][col]) return;

    const existingPending = pendingPlacements.find(p => p.row === row && p.col === col);
    if (existingPending && !(source && source.row === row && source.col === col)) return;

    if (source) {
      // Re-dragging from board
      if (source.row === row && source.col === col) return;
      setPendingPlacements(prev => {
        const old = prev.find(p => p.row === source.row && p.col === source.col);
        const filtered = prev.filter(p => !(p.row === source.row && p.col === source.col));
        return [...filtered, { row, col, tile, assignedChar: old?.assignedChar }];
      });
      onTilePlace();
    } else {
      // Dragging from rack — place as base kana (use dakutenOverride if tile was selected)
      if (tile.isBlank) {
        setBlankModal({ tile, row, col });
      } else {
        const override = selectedRackTile?.id === tile.id ? dakutenOverride : undefined;
        setPendingPlacements(prev => [...prev, { row, col, tile, assignedChar: override }]);
        setSelectedRackTile(null);
        setDakutenOverride(undefined);
        onTilePlace();
      }
    }
  };

  const handleDragEnd = () => {
    dragTileRef.current = null;
    dragSourceRef.current = null;
    setDropTarget(null);
  };

  // --- Click handlers ---
  const handleCellClick = useCallback((row: number, col: number) => {
    if (!isMyTurn || !isPlaying || exchangeMode) return;

    // If cell has a pending tile, remove it
    const existing = pendingPlacements.find(p => p.row === row && p.col === col);
    if (existing) {
      setPendingPlacements(prev => prev.filter(p => !(p.row === row && p.col === col)));
      setSelectedRackTile(null);
      setDakutenOverride(undefined);
      return;
    }

    // If cell already has a committed tile, ignore
    if (gameState.board[row][col]) return;

    // If we have a selected rack tile, place it
    if (selectedRackTile) {
      if (selectedRackTile.isBlank) {
        setBlankModal({ tile: selectedRackTile, row, col });
      } else {
        setPendingPlacements(prev => [
          ...prev,
          { row, col, tile: selectedRackTile, assignedChar: dakutenOverride }
        ]);
        setSelectedRackTile(null);
        setDakutenOverride(undefined);
        onTilePlace();
      }
    }
  }, [isMyTurn, isPlaying, exchangeMode, selectedRackTile, dakutenOverride, pendingPlacements, gameState.board, onTilePlace]);

  const handleBlankSelect = (char: string) => {
    if (!blankModal) return;
    setPendingPlacements(prev => [
      ...prev,
      { row: blankModal.row, col: blankModal.col, tile: blankModal.tile, assignedChar: char }
    ]);
    setSelectedRackTile(null);
    setDakutenOverride(undefined);
    setBlankModal(null);
    onTilePlace();
  };

  const handleRackTileClick = (tile: Tile) => {
    if (!isMyTurn || !isPlaying) return;

    if (exchangeMode) {
      setExchangeSelection(prev => {
        const next = new Set(prev);
        if (next.has(tile.id)) next.delete(tile.id);
        else next.add(tile.id);
        return next;
      });
      return;
    }

    if (selectedRackTile?.id === tile.id) {
      setSelectedRackTile(null);
      setDakutenOverride(undefined);
    } else {
      setSelectedRackTile(tile);
      setDakutenOverride(undefined);
    }
  };

  const handlePlay = () => {
    if (pendingPlacements.length === 0) return;
    const placements: TilePlacement[] = pendingPlacements.map(p => ({
      row: p.row,
      col: p.col,
      tileId: p.tile.id,
      assignedChar: p.assignedChar,
    }));
    onPlayTiles(placements);
    setSelectedRackTile(null);
    setDakutenOverride(undefined);
  };

  const handleExchangeConfirm = () => {
    if (exchangeSelection.size === 0) return;
    onExchange([...exchangeSelection]);
    setExchangeMode(false);
    setExchangeSelection(new Set());
  };

  const handleReset = () => {
    setPendingPlacements([]);
    setSelectedRackTile(null);
    setDakutenOverride(undefined);
    onClearError();
  };

  const handlePassClick = () => {
    setPendingPlacements([]);
    setSelectedRackTile(null);
    setDakutenOverride(undefined);
    onPass();
  };

  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);

  return (
    <div className="game-layout">
      <div className="game-main">
        {/* Turn info + timer */}
        <div className={`turn-info ${isMyTurn ? 'your-turn' : ''}`}>
          <span>
            {isFinished
              ? 'ゲーム終了'
              : isMyTurn
                ? 'あなたの番です'
                : `${currentPlayer?.name ?? ''}の番です`}
          </span>
          {isPlaying && (
            <span className={`timer ${timeLeft <= 10 ? 'timer-warn' : ''}`}>
              {timeLeft}秒
            </span>
          )}
        </div>

        {/* Board */}
        <div className="board">
          {Array.from({ length: 15 }, (_, row) =>
            Array.from({ length: 15 }, (_, col) => {
              const committedTile = gameState.board[row]?.[col];
              const pending = pendingPlacements.find(p => p.row === row && p.col === col);
              const bonus = BONUS_LAYOUT[row][col];
              const hasTile = !!committedTile;
              const hasPending = !!pending;
              const isDrop = dropTarget?.row === row && dropTarget?.col === col;

              let className = 'cell';
              if (hasTile) className += ' has-tile';
              else if (hasPending) className += ' has-pending-tile';
              else if (bonus !== 'NONE') className += ` bonus-${bonus}`;
              if (isDrop) className += ' drop-target';

              return (
                <div
                  key={`${row}-${col}`}
                  className={className}
                  onClick={() => handleCellClick(row, col)}
                  onDragOver={(e) => handleDragOver(e, row, col)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, row, col)}
                >
                  {committedTile ? (
                    <div className={`tile committed ${committedTile.isBlank ? 'blank-tile' : ''}`}>
                      {committedTile.assignedChar || committedTile.char}
                      <span className="tile-points">{committedTile.points}</span>
                    </div>
                  ) : pending ? (
                    <div
                      className={`tile pending ${pending.tile.isBlank ? 'blank-tile' : ''}`}
                      draggable={isMyTurn && isPlaying && !exchangeMode}
                      onDragStart={(e) => handleDragStart(e, pending.tile, { row, col })}
                      onDragEnd={handleDragEnd}
                    >
                      {pending.assignedChar || pending.tile.char}
                      <span className="tile-points">{pending.tile.points}</span>
                    </div>
                  ) : (
                    bonus !== 'NONE' && (
                      <span className="bonus-label">{BONUS_LABELS[bonus] || ''}</span>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Rack */}
        <div className="rack-area">
          <div className="rack">
            {availableRack.map(tile => {
              const isSelected = selectedRackTile?.id === tile.id;
              const displayChar = tile.isBlank
                ? '＿'
                : isSelected && dakutenOverride
                  ? dakutenOverride
                  : tile.char;

              return (
                <div
                  key={tile.id}
                  className={`tile ${
                    isSelected ? 'selected' : ''
                  } ${exchangeSelection.has(tile.id) ? 'selected' : ''} ${
                    tile.isBlank ? 'blank-tile' : ''
                  }`}
                  onClick={() => handleRackTileClick(tile)}
                  draggable={isMyTurn && isPlaying && !exchangeMode}
                  onDragStart={(e) => handleDragStart(e, tile)}
                  onDragEnd={handleDragEnd}
                >
                  {displayChar}
                  <span className="tile-points">{tile.points}</span>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          {isMyTurn && isPlaying && !exchangeMode && (
            <div className="controls">
              {/* Dakuten/Handakuten buttons */}
              <button
                className={`btn btn-dakuten ${dakutenOverride && canDakuten && dakutenOverride === selectedVariants![0] ? 'active' : ''}`}
                onClick={handleDakutenToggle}
                disabled={!canDakuten}
                title="濁音"
              >
                ゛
              </button>
              <button
                className={`btn btn-dakuten ${dakutenOverride && canHandakuten && dakutenOverride === selectedVariants![1] ? 'active' : ''}`}
                onClick={handleHandakutenToggle}
                disabled={!canHandakuten}
                title="半濁音"
              >
                ゜
              </button>

              <button
                className="btn btn-primary"
                onClick={handlePlay}
                disabled={pendingPlacements.length === 0}
              >
                決定
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={pendingPlacements.length === 0}
              >
                戻す
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { handleReset(); setExchangeMode(true); }}
                disabled={gameState.tilesRemaining === 0}
              >
                交換
              </button>
              <button className="btn btn-secondary" onClick={handlePassClick}>
                パス
              </button>
            </div>
          )}

          {isMyTurn && isPlaying && exchangeMode && (
            <div className="controls">
              <button
                className="btn btn-primary"
                onClick={handleExchangeConfirm}
                disabled={exchangeSelection.size === 0}
              >
                交換確定 ({exchangeSelection.size}枚)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setExchangeMode(false); setExchangeSelection(new Set()); }}
              >
                キャンセル
              </button>
            </div>
          )}
        </div>

        {/* Error message at bottom */}
        {error && (
          <div className="error-bottom" onClick={onClearError}>{error}</div>
        )}
      </div>

      {/* Sidebar */}
      <div className="game-sidebar">
        <div className="sidebar-top">
          <div className="tile-info">
            残りタイル: {gameState.tilesRemaining}枚
          </div>
          <button
            className="mute-btn"
            onClick={onToggleMute}
            title={muted ? '音声ON' : '音声OFF'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="scoreboard">
          <h3>スコア</h3>
          {gameState.players.map(p => (
            <div
              key={p.id}
              className={`score-entry ${p.id === gameState.currentPlayerId ? 'current-turn' : ''}`}
            >
              <span>
                {p.name}
                {!p.connected && ' (切断)'}
              </span>
              <span className="score-value">{p.score}</span>
            </div>
          ))}
        </div>

        <div className="history">
          <h3>履歴</h3>
          {gameState.turnHistory.slice().reverse().map((turn, i) => (
            <div key={i} className="history-entry">
              <strong>{turn.playerName}</strong>:{' '}
              {turn.action === 'play'
                ? `${turn.words?.map(w => w.word).join(', ')} (+${turn.totalScore})`
                : turn.action === 'exchange'
                  ? 'タイル交換'
                  : 'パス'}
            </div>
          ))}
        </div>
      </div>

      {/* Blank tile modal */}
      {blankModal && (
        <BlankTileModal
          onSelect={handleBlankSelect}
          onCancel={() => setBlankModal(null)}
        />
      )}

      {/* Game over modal */}
      {isFinished && winner && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>ゲーム終了!</h2>
            <div className="winner-name">{winner.name} の勝ち!</div>
            <div className="final-scores">
              {gameState.players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map(p => (
                  <div key={p.id} className="score-entry">
                    <span>{p.name}</span>
                    <span className="score-value">{p.score}点</span>
                  </div>
                ))}
            </div>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              ロビーに戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
