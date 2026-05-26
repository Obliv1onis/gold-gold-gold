import { CapsuleDataStore } from '../foundation/capsule-data-store.js';

function _roll(weights) {
  let r = Math.random() * 100;
  for (const [rarity, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return Object.keys(weights).at(-1);
}

export const CapsuleEngine = {
  roll(capsuleId) {
    const capsule = CapsuleDataStore.getCapsule(capsuleId);
    if (!capsule) throw new Error(`[CapsuleEngine] Unknown capsule: ${capsuleId}`);

    const rarity = _roll(capsule.rarity_weights);
    const pool   = capsule.tiers[rarity];
    const sticker = pool[Math.floor(Math.random() * pool.length)];

    return {
      capsuleId,
      capsuleName: capsule.name,
      rarity,
      name:             sticker.name,
      market_hash_name: sticker.market_hash_name,
      image_url:        sticker.image_url ?? null,
      market_price:     sticker.market_price ?? null,
    };
  },
};
