/** タイル定義: { 文字, 点数, 枚数 } */
export const TILE_DEFINITIONS: { char: string; points: number; count: number }[] = [
  // 頻出文字（1点）
  { char: 'い', points: 1, count: 5 },
  { char: 'う', points: 1, count: 5 },
  { char: 'か', points: 1, count: 4 },
  { char: 'し', points: 1, count: 4 },
  { char: 'た', points: 1, count: 4 },
  { char: 'て', points: 1, count: 4 },
  { char: 'の', points: 1, count: 4 },
  { char: 'に', points: 1, count: 4 },
  { char: 'は', points: 1, count: 3 },
  { char: 'ん', points: 1, count: 3 },
  { char: 'く', points: 1, count: 3 },
  { char: 'こ', points: 1, count: 3 },
  { char: 'と', points: 1, count: 3 },
  { char: 'な', points: 1, count: 3 },
  { char: 'り', points: 1, count: 3 },
  { char: 'る', points: 1, count: 3 },
  // 一般文字（2点）
  { char: 'き', points: 2, count: 3 },
  { char: 'あ', points: 2, count: 3 },
  { char: 'お', points: 2, count: 3 },
  { char: 'け', points: 2, count: 2 },
  { char: 'さ', points: 2, count: 2 },
  { char: 'す', points: 2, count: 2 },
  { char: 'せ', points: 2, count: 2 },
  { char: 'そ', points: 2, count: 2 },
  { char: 'ち', points: 2, count: 2 },
  { char: 'つ', points: 2, count: 2 },
  { char: 'ま', points: 2, count: 2 },
  { char: 'み', points: 2, count: 2 },
  { char: 'も', points: 2, count: 2 },
  { char: 'よ', points: 2, count: 2 },
  { char: 'え', points: 2, count: 2 },
  { char: 'れ', points: 2, count: 2 },
  // やや少ない（3点）
  { char: 'わ', points: 3, count: 2 },
  { char: 'ふ', points: 3, count: 2 },
  { char: 'ら', points: 3, count: 2 },
  { char: 'む', points: 3, count: 1 },
  { char: 'め', points: 3, count: 1 },
  { char: 'ろ', points: 3, count: 1 },
  { char: 'ー', points: 3, count: 2 },
  // 少ない（4点）
  { char: 'ぬ', points: 4, count: 1 },
  { char: 'ね', points: 4, count: 1 },
  { char: 'ひ', points: 4, count: 1 },
  { char: 'ほ', points: 4, count: 1 },
  { char: 'や', points: 4, count: 1 },
  { char: 'ゆ', points: 4, count: 1 },
  // ブランク（0点）
  { char: '', points: 0, count: 2 },
];

export const RACK_SIZE = 7;
export const BOARD_SIZE = 15;
export const BINGO_BONUS = 50; // 7枚全部使った場合のボーナス
