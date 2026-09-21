/**
 * Returns the rarity used for UI colour without changing official drop odds.
 * Gold-named stickers are intentionally shown in red; Contraband remains gold.
 */
export function visualRarity(item, fallback = 'unknown') {
  const name = item?.market_hash_name ?? item?.name ?? '';
  const isSticker = item?.capsuleType === 'sticker_capsule' || name.startsWith('Sticker | ');
  if (isSticker && /\(Gold(?:,|\))/.test(name)) return 'extraordinary';
  return item?.rarity ?? fallback;
}

