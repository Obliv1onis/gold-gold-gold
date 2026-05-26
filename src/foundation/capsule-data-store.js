const VALID_RARITIES = ['high_grade', 'remarkable', 'exotic', 'extraordinary'];

let _capsules = new Map();
let _state    = 'unloaded';

function _validate(entry) {
  const weights = entry.rarity_weights ?? {};
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100.0) > 0.5) {
    console.error(`[CapsuleDataStore] ${entry.id}: weights sum to ${sum}, expected 100`);
    return false;
  }
  for (const [rarity, weight] of Object.entries(weights)) {
    if (weight > 0 && (!entry.tiers?.[rarity] || entry.tiers[rarity].length === 0)) {
      console.error(`[CapsuleDataStore] ${entry.id}: rarity "${rarity}" has weight ${weight} but no items`);
      return false;
    }
  }
  return true;
}

export const CapsuleDataStore = {
  async init(url) {
    if (_state === 'loaded') return;
    _state = 'loading';
    const res  = await fetch(url);
    const json = await res.json();
    let valid = 0, invalid = 0;
    for (const entry of json.capsules ?? []) {
      if (_validate(entry)) { _capsules.set(entry.id, entry); valid++; }
      else invalid++;
    }
    _state = 'loaded';
    console.log(`[CapsuleDataStore] ${valid} capsules loaded, ${invalid} invalid`);
  },

  getCapsule(id)  { return _capsules.get(id) ?? null; },
  getCapsuleList(){ return [..._capsules.values()]; },
};
