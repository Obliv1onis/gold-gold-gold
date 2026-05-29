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

async function _loadUrl(url, label) {
  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    let valid = 0, invalid = 0;
    for (const entry of json.capsules ?? []) {
      if (_validate(entry)) { _capsules.set(entry.id, entry); valid++; }
      else invalid++;
    }
    console.log(`[CapsuleDataStore] ${label}: ${valid} loaded, ${invalid} invalid`);
  } catch (err) {
    console.warn(`[CapsuleDataStore] Failed to load ${label} (${url}): ${err.message}`);
  }
}

export const CapsuleDataStore = {
  /**
   * @param {string} capsulesUrl   - URL for capsules.json  (required)
   * @param {string} [othersUrl]   - URL for others.json    (optional)
   */
  async init(capsulesUrl, othersUrl) {
    if (_state === 'loaded') return;
    _state = 'loading';
    await _loadUrl(capsulesUrl, 'capsules');
    if (othersUrl) await _loadUrl(othersUrl, 'others');
    _state = 'loaded';
  },

  getCapsule(id) { return _capsules.get(id) ?? null; },

  /**
   * @param {string|string[]|null} type - filter by type(s), or null for all
   */
  getCapsuleList(type = null) {
    const all = [..._capsules.values()];
    if (!type) return all;
    const types = Array.isArray(type) ? type : [type];
    return all.filter(c => types.includes(c.type ?? 'sticker_capsule'));
  },

  /**
   * Returns every item across all capsules (optionally filtered by container type),
   * with `capsuleType` and `capsuleName` fields added.
   * @param {string|string[]|null} type
   */
  getAllItems(type = null) {
    const typesArr = type ? (Array.isArray(type) ? type : [type]) : null;
    const result = [];
    for (const cap of _capsules.values()) {
      const capType = cap.type ?? 'sticker_capsule';
      if (typesArr && !typesArr.includes(capType)) continue;
      for (const [rarity, items] of Object.entries(cap.tiers ?? {})) {
        for (const item of items) {
          result.push({ ...item, rarity, capsuleType: capType, capsuleName: cap.name });
        }
      }
    }
    return result;
  },
};
