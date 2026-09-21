const VALID_RARITIES = ['high_grade', 'remarkable', 'exotic', 'extraordinary'];

let _capsules = new Map();
let _marketItems = [];
let _state    = 'unloaded';
let _capsuleLists = new Map();
let _allItemsCache = new Map();

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
    let invalid = 0;
    const entries = [];
    for (const entry of json.capsules ?? []) {
      if (_validate(entry)) entries.push(entry);
      else invalid++;
    }
    console.log(`[CapsuleDataStore] ${label}: ${entries.length} loaded, ${invalid} invalid`);
    return entries;
  } catch (err) {
    console.warn(`[CapsuleDataStore] Failed to load ${label} (${url}): ${err.message}`);
    return [];
  }
}

async function _loadMarketItems(url) {
  if (!url) return [];
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return (data.items ?? []).filter(item => item.name && item.market_hash_name);
  } catch (error) {
    console.warn(`[CapsuleDataStore] Failed to load market items (${url}): ${error.message}`);
    return [];
  }
}

export const CapsuleDataStore = {
  /**
   * @param {string} capsulesUrl   - URL for capsules.json  (required)
   * @param {string} [othersUrl]   - URL for others.json    (optional)
   */
  async init(capsulesUrl, othersUrl, marketItemsUrl = null) {
    if (_state === 'loaded') return;
    _state = 'loading';
    _capsules.clear();
    _capsuleLists.clear();
    _allItemsCache.clear();
    _marketItems = [];
    const [capsules, others, marketItems] = await Promise.all([
      _loadUrl(capsulesUrl, 'capsules'),
      othersUrl ? _loadUrl(othersUrl, 'others') : Promise.resolve([]),
      _loadMarketItems(marketItemsUrl),
    ]);
    for (const entry of [...capsules, ...others]) _capsules.set(entry.id, entry);
    _marketItems = marketItems;
    _state = 'loaded';
  },

  getCapsule(id) { return _capsules.get(id) ?? null; },

  /**
   * @param {string|string[]|null} type - filter by type(s), or null for all
   */
  getCapsuleList(type = null) {
    const types = type ? (Array.isArray(type) ? type : [type]) : null;
    const key = types ? [...types].sort().join('|') : 'all';
    if (!_capsuleLists.has(key)) {
      const all = [..._capsules.values()];
      _capsuleLists.set(key, types
        ? all.filter(c => types.includes(c.type ?? 'sticker_capsule'))
        : all);
    }
    return [..._capsuleLists.get(key)];
  },

  /**
   * Returns every item across all capsules (optionally filtered by container type),
   * with `capsuleType` and `capsuleName` fields added.
   * @param {string|string[]|null} type
   */
  getAllItems(type = null) {
    const typesArr = type ? (Array.isArray(type) ? type : [type]) : null;
    const cacheKey = typesArr ? [...typesArr].sort().join('|') : 'all';
    if (_allItemsCache.has(cacheKey)) return _allItemsCache.get(cacheKey);
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
    _allItemsCache.set(cacheKey, result);
    return result;
  },

  getMarketItems() {
    return _marketItems.map(item => ({ ...item, isMarketOnly: true }));
  },
};
