/** 濁音・半濁音マッピング: 清音 → [濁音] or [濁音, 半濁音] */
export const DAKUTEN_MAP: Record<string, string[]> = {
  'か': ['が'], 'き': ['ぎ'], 'く': ['ぐ'], 'け': ['げ'], 'こ': ['ご'],
  'さ': ['ざ'], 'し': ['じ'], 'す': ['ず'], 'せ': ['ぜ'], 'そ': ['ぞ'],
  'た': ['だ'], 'ち': ['ぢ'], 'つ': ['づ'], 'て': ['で'], 'と': ['ど'],
  'は': ['ば', 'ぱ'], 'ひ': ['び', 'ぴ'], 'ふ': ['ぶ', 'ぷ'],
  'へ': ['べ', 'ぺ'], 'ほ': ['ぼ', 'ぽ'],
};

/** 大きい仮名 → 小さい仮名 */
export const LARGE_TO_SMALL: Record<string, string> = {
  'つ': 'っ', 'や': 'ゃ', 'ゆ': 'ゅ', 'よ': 'ょ',
};

/** 濁音/半濁音使用時の実効ポイント */
export const DAKUTEN_POINTS: Record<string, number> = {
  'が': 3, 'ぎ': 3, 'ぐ': 3, 'げ': 3, 'ご': 3,
  'ざ': 4, 'じ': 4, 'ず': 4, 'ぜ': 4, 'ぞ': 4,
  'だ': 3, 'ぢ': 3, 'づ': 3, 'で': 3, 'ど': 3,
  'ば': 4, 'び': 4, 'ぶ': 4, 'べ': 4, 'ぼ': 4,
  'ぱ': 5, 'ぴ': 5, 'ぷ': 5, 'ぺ': 5, 'ぽ': 5,
};

/** タイルの実効ポイントを取得（濁音/半濁音考慮） */
export function getEffectivePoints(tile: { points: number; isBlank: boolean; assignedChar?: string }): number {
  if (tile.isBlank) return 0;
  if (tile.assignedChar && DAKUTEN_POINTS[tile.assignedChar] !== undefined) {
    return DAKUTEN_POINTS[tile.assignedChar];
  }
  return tile.points;
}

/** 濁音/半濁音の割り当てが有効かチェック */
export function isValidDakutenAssignment(baseChar: string, assignedChar: string): boolean {
  const variants = DAKUTEN_MAP[baseChar];
  return !!variants && variants.includes(assignedChar);
}

/**
 * 単語の小さい仮名バリエーションを全て生成
 * 例: "けつかく" → ["けつかく", "けっかく"]
 */
export function generateSmallKanaVariants(word: string): string[] {
  const chars = [...word];
  const positions: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (LARGE_TO_SMALL[chars[i]]) positions.push(i);
  }

  if (positions.length === 0) return [word];

  const variants: string[] = [];
  const total = 1 << positions.length;
  for (let mask = 0; mask < total; mask++) {
    const variant = [...chars];
    for (let b = 0; b < positions.length; b++) {
      if (mask & (1 << b)) {
        variant[positions[b]] = LARGE_TO_SMALL[variant[positions[b]]];
      }
    }
    variants.push(variant.join(''));
  }
  return variants;
}
