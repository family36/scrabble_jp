import {
  Tile, TilePlacement, PlayerInfo, GameState, TurnRecord,
  GamePhase, BonusType,
} from 'shared/src/protocol.js';
import { TileBag } from './TileBag.js';
import { Dictionary } from './Dictionary.js';
import { BoardValidator } from './BoardValidator.js';
import { createBonusLayout } from './board.js';
import { BOARD_SIZE, RACK_SIZE, BINGO_BONUS } from './tiles.js';

const TURN_TIME_MS = 60_000; // 60秒

interface Player {
  id: string;
  name: string;
  score: number;
  rack: Tile[];
  connected: boolean;
}

export class Game {
  private board: (Tile | null)[][] = [];
  private bonusLayout: BonusType[][] = [];
  private players: Player[] = [];
  private currentPlayerIndex = 0;
  private tileBag: TileBag;
  private dictionary: Dictionary;
  private validator: BoardValidator;
  private turnHistory: TurnRecord[] = [];
  private phase: GamePhase = 'waiting';
  private consecutivePasses = 0;
  private isFirstMove = true;
  private turnDeadline = 0;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private onTurnTimeout: (() => void) | null = null;

  constructor(dictionary: Dictionary) {
    this.dictionary = dictionary;
    this.validator = new BoardValidator(dictionary);
    this.tileBag = new TileBag();
    this.bonusLayout = createBonusLayout();
    this.initBoard();
  }

  /** サーバーから呼ばれるコールバック設定 */
  setTurnTimeoutCallback(cb: () => void): void {
    this.onTurnTimeout = cb;
  }

  private initBoard(): void {
    this.board = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(null)
    );
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    if (this.phase !== 'playing') return;
    this.turnDeadline = Date.now() + TURN_TIME_MS;
    this.turnTimer = setTimeout(() => {
      // 時間切れ → 強制パス
      if (this.phase === 'playing') {
        this.forcePass();
        this.onTurnTimeout?.();
      }
    }, TURN_TIME_MS);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  /** 時間切れによる強制パス（assertTurnをスキップ） */
  private forcePass(): void {
    const player = this.players[this.currentPlayerIndex];
    this.consecutivePasses++;
    this.turnHistory.push({
      playerId: player.id,
      playerName: player.name,
      action: 'pass',
      totalScore: 0,
    });
    this.advanceTurn();
    this.checkGameEnd();
  }

  addPlayer(id: string, name: string): void {
    if (this.phase !== 'waiting') throw new Error('ゲーム中は参加できません');
    if (this.players.length >= 4) throw new Error('最大4人です');
    if (this.players.some(p => p.id === id)) throw new Error('既に参加しています');
    this.players.push({ id, name, score: 0, rack: [], connected: true });
  }

  removePlayer(id: string): void {
    this.players = this.players.filter(p => p.id !== id);
  }

  setConnected(id: string, connected: boolean): void {
    const player = this.players.find(p => p.id === id);
    if (player) player.connected = connected;
  }

  start(): void {
    if (this.players.length < 2) throw new Error('2人以上必要です');
    this.phase = 'playing';
    for (const player of this.players) {
      player.rack = this.tileBag.draw(RACK_SIZE);
    }
    this.startTurnTimer();
  }

  get currentPlayerId(): string {
    return this.players[this.currentPlayerIndex]?.id ?? '';
  }

  get gamePhase(): GamePhase {
    return this.phase;
  }

  getPlayerIds(): string[] {
    return this.players.map(p => p.id);
  }

  playTiles(playerId: string, placements: TilePlacement[]): {
    words: { word: string; score: number }[];
    totalScore: number;
  } {
    this.assertTurn(playerId);

    const player = this.players[this.currentPlayerIndex];
    const rackMap = new Map(player.rack.map(t => [t.id, t]));

    const wordsFound = this.validator.validate(
      this.board, placements, rackMap, this.isFirstMove
    );

    let totalScore = 0;
    const wordResults: { word: string; score: number }[] = [];

    for (const wf of wordsFound) {
      let wordScore = 0;
      let wordMultiplier = 1;

      for (const wt of wf.tiles) {
        const tilePoints = wt.tile.isBlank ? 0 : wt.tile.points;
        if (wt.isNew) {
          const bonus = this.bonusLayout[wt.row][wt.col];
          switch (bonus) {
            case 'DL': wordScore += tilePoints * 2; break;
            case 'TL': wordScore += tilePoints * 3; break;
            case 'DW': case 'START': wordScore += tilePoints; wordMultiplier *= 2; break;
            case 'TW': wordScore += tilePoints; wordMultiplier *= 3; break;
            default: wordScore += tilePoints;
          }
        } else {
          wordScore += tilePoints;
        }
      }

      wordScore *= wordMultiplier;
      totalScore += wordScore;
      wordResults.push({ word: wf.word, score: wordScore });
    }

    if (placements.length === RACK_SIZE) {
      totalScore += BINGO_BONUS;
    }

    for (const p of placements) {
      const tile = rackMap.get(p.tileId)!;
      const placed = { ...tile };
      if (p.assignedChar) {
        placed.assignedChar = p.assignedChar;
      }
      this.board[p.row][p.col] = placed;
    }

    const usedIds = new Set(placements.map(p => p.tileId));
    player.rack = player.rack.filter(t => !usedIds.has(t.id));
    const drawn = this.tileBag.drawToFill(player.rack.length);
    player.rack.push(...drawn);

    player.score += totalScore;
    this.isFirstMove = false;
    this.consecutivePasses = 0;

    this.turnHistory.push({
      playerId: player.id,
      playerName: player.name,
      action: 'play',
      words: wordResults,
      totalScore,
    });

    this.advanceTurn();
    this.checkGameEnd();

    return { words: wordResults, totalScore };
  }

  exchangeTiles(playerId: string, tileIds: number[]): void {
    this.assertTurn(playerId);

    if (tileIds.length === 0) throw new Error('交換するタイルを選択してください');
    if (this.tileBag.remaining() < tileIds.length) {
      throw new Error('袋のタイルが足りません');
    }

    const player = this.players[this.currentPlayerIndex];
    const tilesToExchange: Tile[] = [];

    for (const id of tileIds) {
      const tile = player.rack.find(t => t.id === id);
      if (!tile) throw new Error('ラックにないタイルです');
      tilesToExchange.push(tile);
    }

    const newTiles = this.tileBag.exchange(tilesToExchange);
    player.rack = player.rack.filter(t => !tileIds.includes(t.id));
    player.rack.push(...newTiles);

    this.consecutivePasses = 0;

    this.turnHistory.push({
      playerId: player.id,
      playerName: player.name,
      action: 'exchange',
      totalScore: 0,
    });

    this.advanceTurn();
  }

  pass(playerId: string): void {
    this.assertTurn(playerId);

    const player = this.players[this.currentPlayerIndex];
    this.consecutivePasses++;

    this.turnHistory.push({
      playerId: player.id,
      playerName: player.name,
      action: 'pass',
      totalScore: 0,
    });

    this.advanceTurn();
    this.checkGameEnd();
  }

  private assertTurn(playerId: string): void {
    if (this.phase !== 'playing') throw new Error('ゲームが開始されていません');
    if (this.currentPlayerId !== playerId) throw new Error('あなたの番ではありません');
  }

  private advanceTurn(): void {
    if (this.phase !== 'playing') return;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.startTurnTimer();
  }

  private checkGameEnd(): void {
    if (this.consecutivePasses >= this.players.length * 2) {
      this.endGame();
      return;
    }
    const currentPlayer = this.players.find(p => p.rack.length === 0);
    if (currentPlayer && this.tileBag.isEmpty()) {
      this.endGame();
      return;
    }
  }

  private endGame(): void {
    this.phase = 'finished';
    this.clearTurnTimer();
    for (const player of this.players) {
      const rackPoints = player.rack.reduce((sum, t) => sum + t.points, 0);
      player.score -= rackPoints;
    }
  }

  getWinner(): PlayerInfo | null {
    if (this.phase !== 'finished') return null;
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    return this.toPlayerInfo(sorted[0]);
  }

  getStateForPlayer(playerId: string): GameState {
    const player = this.players.find(p => p.id === playerId);
    return {
      board: this.board,
      players: this.players.map(p => this.toPlayerInfo(p)),
      currentPlayerId: this.currentPlayerId,
      rack: player?.rack ?? [],
      tilesRemaining: this.tileBag.remaining(),
      turnHistory: this.turnHistory,
      phase: this.phase,
      consecutivePasses: this.consecutivePasses,
      turnDeadline: this.turnDeadline,
    };
  }

  getPlayersInfo(): PlayerInfo[] {
    return this.players.map(p => this.toPlayerInfo(p));
  }

  private toPlayerInfo(p: Player): PlayerInfo {
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      tileCount: p.rack.length,
      connected: p.connected,
    };
  }
}
