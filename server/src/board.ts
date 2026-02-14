import { BonusType } from 'shared/src/protocol.js';
import { BOARD_SIZE } from './tiles.js';

/**
 * 標準SCRABBLE 15×15 ボーナス配置
 * 対称性を利用して1/8のみ定義し、ミラーで展開
 */
const BONUS_POSITIONS: { row: number; col: number; type: BonusType }[] = [
  // TW (Triple Word)
  { row: 0, col: 0, type: 'TW' },
  { row: 0, col: 7, type: 'TW' },
  { row: 7, col: 0, type: 'TW' },
  // DW (Double Word)
  { row: 1, col: 1, type: 'DW' },
  { row: 2, col: 2, type: 'DW' },
  { row: 3, col: 3, type: 'DW' },
  { row: 4, col: 4, type: 'DW' },
  // TL (Triple Letter)
  { row: 1, col: 5, type: 'TL' },
  { row: 5, col: 1, type: 'TL' },
  { row: 5, col: 5, type: 'TL' },
  // DL (Double Letter)
  { row: 0, col: 3, type: 'DL' },
  { row: 3, col: 0, type: 'DL' },
  { row: 2, col: 6, type: 'DL' },
  { row: 6, col: 2, type: 'DL' },
  { row: 6, col: 6, type: 'DL' },
  { row: 3, col: 7, type: 'DL' },
  { row: 7, col: 3, type: 'DL' },
  // START
  { row: 7, col: 7, type: 'START' },
];

/** ボーナスレイアウト (15×15) を生成 */
export function createBonusLayout(): BonusType[][] {
  const layout: BonusType[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill('NONE')
  );

  for (const { row, col, type } of BONUS_POSITIONS) {
    // 4方向にミラー
    const positions = mirrorPositions(row, col);
    for (const [r, c] of positions) {
      if (layout[r][c] === 'NONE' || type === 'START') {
        layout[r][c] = type;
      }
    }
  }

  return layout;
}

function mirrorPositions(row: number, col: number): [number, number][] {
  const maxIdx = BOARD_SIZE - 1;
  const positions = new Set<string>();
  const result: [number, number][] = [];

  for (const [r, c] of [
    [row, col],
    [row, maxIdx - col],
    [maxIdx - row, col],
    [maxIdx - row, maxIdx - col],
    [col, row],
    [col, maxIdx - row],
    [maxIdx - col, row],
    [maxIdx - col, maxIdx - row],
  ]) {
    const key = `${r},${c}`;
    if (!positions.has(key)) {
      positions.add(key);
      result.push([r, c]);
    }
  }

  return result;
}
