import { Tile, TilePlacement, BonusType } from 'shared/src/protocol.js';
import { BOARD_SIZE } from './tiles.js';
import { Dictionary } from './Dictionary.js';

interface WordFound {
  word: string;
  tiles: { tile: Tile; row: number; col: number; isNew: boolean }[];
}

export class BoardValidator {
  constructor(private dictionary: Dictionary) {}

  /**
   * 配置を検証し、形成された単語を返す
   * エラー時はthrow
   */
  validate(
    board: (Tile | null)[][],
    placements: TilePlacement[],
    rackTiles: Map<number, Tile>,
    isFirstMove: boolean
  ): WordFound[] {
    if (placements.length === 0) {
      throw new Error('タイルを配置してください');
    }

    // 配置タイルをrackから取得して検証
    const placedTiles: { tile: Tile; row: number; col: number }[] = [];
    for (const p of placements) {
      const tile = rackTiles.get(p.tileId);
      if (!tile) {
        throw new Error('ラックにないタイルです');
      }
      if (p.row < 0 || p.row >= BOARD_SIZE || p.col < 0 || p.col >= BOARD_SIZE) {
        throw new Error('盤面の範囲外です');
      }
      if (board[p.row][p.col] !== null) {
        throw new Error(`(${p.row},${p.col})には既にタイルがあります`);
      }
      const placedTile: Tile = { ...tile };
      if (tile.isBlank) {
        if (!p.assignedChar) {
          throw new Error('ブランクタイルに文字を指定してください');
        }
        placedTile.assignedChar = p.assignedChar;
      }
      placedTiles.push({ tile: placedTile, row: p.row, col: p.col });
    }

    // 全て同じ行 or 同じ列であることを確認
    const rows = new Set(placedTiles.map(t => t.row));
    const cols = new Set(placedTiles.map(t => t.col));
    const isHorizontal = rows.size === 1;
    const isVertical = cols.size === 1;

    if (!isHorizontal && !isVertical) {
      throw new Error('タイルは一直線に配置してください');
    }

    // 仮盤面を作成
    const tempBoard: (Tile | null)[][] = board.map(row => [...row]);
    const newPositions = new Set<string>();
    for (const pt of placedTiles) {
      tempBoard[pt.row][pt.col] = pt.tile;
      newPositions.add(`${pt.row},${pt.col}`);
    }

    // 配置間にギャップがないことを確認
    if (isHorizontal) {
      const row = placedTiles[0].row;
      const minCol = Math.min(...placedTiles.map(t => t.col));
      const maxCol = Math.max(...placedTiles.map(t => t.col));
      for (let c = minCol; c <= maxCol; c++) {
        if (tempBoard[row][c] === null) {
          throw new Error('タイルの間に隙間があります');
        }
      }
    } else {
      const col = placedTiles[0].col;
      const minRow = Math.min(...placedTiles.map(t => t.row));
      const maxRow = Math.max(...placedTiles.map(t => t.row));
      for (let r = minRow; r <= maxRow; r++) {
        if (tempBoard[r][col] === null) {
          throw new Error('タイルの間に隙間があります');
        }
      }
    }

    // 初手は中央マスを通ること
    if (isFirstMove) {
      const center = Math.floor(BOARD_SIZE / 2);
      const touchesCenter = placedTiles.some(t => t.row === center && t.col === center);
      if (!touchesCenter) {
        throw new Error('最初の手は中央マスを通る必要があります');
      }
      if (placedTiles.length < 2) {
        throw new Error('最初の手は2文字以上必要です');
      }
    } else {
      // 既存タイルに隣接していること
      const adjacent = placedTiles.some(pt => {
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        return dirs.some(([dr, dc]) => {
          const nr = pt.row + dr;
          const nc = pt.col + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return false;
          return board[nr][nc] !== null; // 元の盤面にタイルがある
        });
      });
      if (!adjacent) {
        throw new Error('既存のタイルに隣接させてください');
      }
    }

    // 単語を抽出
    const words = this.extractWords(tempBoard, placedTiles, newPositions);

    if (words.length === 0) {
      throw new Error('有効な単語が形成されていません');
    }

    // 辞書チェック
    for (const w of words) {
      if (!this.dictionary.isValid(w.word)) {
        throw new Error(`「${w.word}」は辞書にありません`);
      }
    }

    return words;
  }

  private extractWords(
    board: (Tile | null)[][],
    placedTiles: { tile: Tile; row: number; col: number }[],
    newPositions: Set<string>
  ): WordFound[] {
    const words: WordFound[] = [];
    const checked = new Set<string>();

    for (const pt of placedTiles) {
      // 横方向の単語
      const hWord = this.getWordAt(board, pt.row, pt.col, 'horizontal', newPositions);
      if (hWord && hWord.tiles.length >= 2) {
        const key = `h:${hWord.tiles[0].row},${hWord.tiles[0].col}`;
        if (!checked.has(key)) {
          checked.add(key);
          words.push(hWord);
        }
      }

      // 縦方向の単語
      const vWord = this.getWordAt(board, pt.row, pt.col, 'vertical', newPositions);
      if (vWord && vWord.tiles.length >= 2) {
        const key = `v:${vWord.tiles[0].row},${vWord.tiles[0].col}`;
        if (!checked.has(key)) {
          checked.add(key);
          words.push(vWord);
        }
      }
    }

    return words;
  }

  private getWordAt(
    board: (Tile | null)[][],
    row: number,
    col: number,
    direction: 'horizontal' | 'vertical',
    newPositions: Set<string>
  ): WordFound | null {
    const dr = direction === 'vertical' ? 1 : 0;
    const dc = direction === 'horizontal' ? 1 : 0;

    // 単語の開始位置を見つける
    let r = row, c = col;
    while (r - dr >= 0 && c - dc >= 0 && board[r - dr][c - dc] !== null) {
      r -= dr;
      c -= dc;
    }

    // 単語全体を収集
    const tiles: WordFound['tiles'] = [];
    let word = '';
    while (r < BOARD_SIZE && c < BOARD_SIZE && board[r][c] !== null) {
      const tile = board[r][c]!;
      const ch = tile.isBlank && tile.assignedChar ? tile.assignedChar : tile.char;
      word += ch;
      tiles.push({ tile, row: r, col: c, isNew: newPositions.has(`${r},${c}`) });
      r += dr;
      c += dc;
    }

    if (tiles.length < 2) return null;
    return { word, tiles };
  }
}
