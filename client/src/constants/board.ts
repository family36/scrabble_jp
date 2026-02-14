import type { BonusType } from '../../../shared/src/protocol';

const BOARD_SIZE = 15;

const BONUS_POSITIONS: { row: number; col: number; type: BonusType }[] = [
  { row: 0, col: 0, type: 'TW' },
  { row: 0, col: 7, type: 'TW' },
  { row: 7, col: 0, type: 'TW' },
  { row: 1, col: 1, type: 'DW' },
  { row: 2, col: 2, type: 'DW' },
  { row: 3, col: 3, type: 'DW' },
  { row: 4, col: 4, type: 'DW' },
  { row: 1, col: 5, type: 'TL' },
  { row: 5, col: 1, type: 'TL' },
  { row: 5, col: 5, type: 'TL' },
  { row: 0, col: 3, type: 'DL' },
  { row: 3, col: 0, type: 'DL' },
  { row: 2, col: 6, type: 'DL' },
  { row: 6, col: 2, type: 'DL' },
  { row: 6, col: 6, type: 'DL' },
  { row: 3, col: 7, type: 'DL' },
  { row: 7, col: 3, type: 'DL' },
  { row: 7, col: 7, type: 'START' },
];

function mirrorPositions(row: number, col: number): [number, number][] {
  const maxIdx = BOARD_SIZE - 1;
  const positions = new Set<string>();
  const result: [number, number][] = [];
  for (const [r, c] of [
    [row, col], [row, maxIdx - col], [maxIdx - row, col], [maxIdx - row, maxIdx - col],
    [col, row], [col, maxIdx - row], [maxIdx - col, row], [maxIdx - col, maxIdx - row],
  ]) {
    const key = `${r},${c}`;
    if (!positions.has(key)) { positions.add(key); result.push([r, c]); }
  }
  return result;
}

export function createBonusLayout(): BonusType[][] {
  const layout: BonusType[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill('NONE')
  );
  for (const { row, col, type } of BONUS_POSITIONS) {
    for (const [r, c] of mirrorPositions(row, col)) {
      if (layout[r][c] === 'NONE' || type === 'START') layout[r][c] = type;
    }
  }
  return layout;
}

export const BONUS_LAYOUT = createBonusLayout();
