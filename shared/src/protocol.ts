// ============================================================
// 共有型定義: WebSocketメッセージプロトコル
// ============================================================

/** タイル */
export interface Tile {
  id: number;
  char: string;       // ひらがな文字 or '' (ブランク)
  points: number;
  isBlank: boolean;
  assignedChar?: string; // ブランクに割り当てた文字 or 濁音/半濁音
}

/** 盤面セル */
export interface CellState {
  row: number;
  col: number;
  tile: Tile | null;
  bonus: BonusType;
}

export type BonusType = 'NONE' | 'DL' | 'TL' | 'DW' | 'TW' | 'START';

/** プレイヤー情報 */
export interface PlayerInfo {
  id: string;
  name: string;
  score: number;
  tileCount: number;
  connected: boolean;
}

/** 配置情報 */
export interface TilePlacement {
  row: number;
  col: number;
  tileId: number;
  assignedChar?: string; // ブランク or 濁音/半濁音の割り当て
}

/** ゲーム状態 (クライアント向け) */
export interface GameState {
  board: (Tile | null)[][];
  players: PlayerInfo[];
  currentPlayerId: string;
  rack: Tile[];
  tilesRemaining: number;
  turnHistory: TurnRecord[];
  phase: GamePhase;
  consecutivePasses: number;
  turnDeadline: number; // Unix ms - turn expires at this time
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

/** ターン記録 */
export interface TurnRecord {
  playerId: string;
  playerName: string;
  action: 'play' | 'exchange' | 'pass';
  words?: { word: string; score: number }[];
  totalScore: number;
}

// ============================================================
// クライアント → サーバー メッセージ
// ============================================================

export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'START_GAME' }
  | { type: 'PLAY_TILES'; placements: TilePlacement[] }
  | { type: 'EXCHANGE_TILES'; tileIds: number[] }
  | { type: 'PASS' }
  | { type: 'RECONNECT'; roomCode: string; playerId: string };

// ============================================================
// サーバー → クライアント メッセージ
// ============================================================

export type ServerMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; playerId: string }
  | { type: 'ROOM_JOINED'; roomCode: string; playerId: string; players: PlayerInfo[] }
  | { type: 'PLAYER_JOINED'; player: PlayerInfo }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'GAME_STARTED'; gameState: GameState }
  | { type: 'GAME_STATE'; gameState: GameState }
  | { type: 'PLAY_RESULT'; success: boolean; error?: string; gameState?: GameState }
  | { type: 'EXCHANGE_RESULT'; success: boolean; error?: string; gameState?: GameState }
  | { type: 'GAME_OVER'; gameState: GameState; winner: PlayerInfo }
  | { type: 'ERROR'; message: string }
  | { type: 'PLAYER_RECONNECTED'; playerId: string };
