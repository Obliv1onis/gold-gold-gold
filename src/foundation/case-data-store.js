// Static case data store. Loads cases.json once at startup; read-only for the session.
// See GDD: design/gdd/case-data-store.md for schema, validation rules, and edge cases.

const VALID_RARITIES = ['mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];

let _cases = new Map();
let _state = 'unloaded'; // 'unloaded' | 'loaded' | 'error'

function _validateEntry(entry) {
  if (entry.type !== 'weapon_case') {
    console.warn(`[CDS] Skipping "${entry.id}": unrecognized type "${entry.type}"`);
    return false;
  }

  const weights = entry.rarity_weights ?? {};
  const sum = VALID_RARITIES.reduce((acc, r) => acc + (weights[r] ?? 0), 0);
  if (Math.abs(sum - 100.0) > 0.01) {
    console.error(`[CDS] Data error: "${entry.id}" weights sum to ${sum.toFixed(4)} (expected 100.0 ±0.01). Skipping.`);
    return false;
  }

  const items = entry.items ?? {};
  for (const rarity of VALID_RARITIES) {
    const tier = items[rarity] ?? [];
    const weight = weights[rarity] ?? 0;
    if (tier.length === 0) {
      console.error(`[CDS] Data error: "${entry.id}" has empty items for tier "${rarity}". Skipping.`);
      return false;
    }
    if (weight === 0 && tier.length > 0) {
      console.error(`[CDS] Data error: "${entry.id}" tier "${rarity}" has items but weight 0.0. Skipping.`);
      return false;
    }
  }

  return true;
}

function _normalizeItem(item) {
  return { ...item, image_url: item.image_url ?? null, stattrak: item.stattrak ?? false };
}

function _normalizeEntry(entry) {
  const items = {};
  for (const r of VALID_RARITIES) {
    items[r] = (entry.items[r] ?? []).map(_normalizeItem);
  }
  return { ...entry, items };
}

export const CaseDataStore = {
  getState() { return _state; },

  async init(url = '/data/cases.json') {
    _state = 'unloaded';
    _cases.clear();

    let data;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      _state = 'error';
      throw err;
    }

    if (!data.format_version) {
      console.warn('[CDS] Warning: cases.json missing format_version field.');
    }

    const seenIds = new Set();
    for (const entry of data.cases ?? []) {
      if (seenIds.has(entry.id)) {
        console.error(`[CDS] Duplicate id "${entry.id}". Keeping first, skipping duplicate.`);
        continue;
      }
      if (!_validateEntry(entry)) continue;
      seenIds.add(entry.id);
      _cases.set(entry.id, _normalizeEntry(entry));
    }

    _state = 'loaded';
  },

  getCase(id) {
    return _cases.get(id) ?? null;
  },

  getCaseList() {
    // Returns metadata only — item pools are excluded. (GDD: Interface Contract)
    return Array.from(_cases.values()).map(({ items, ...meta }) => meta);
  },

  getItems(id, rarity) {
    const c = _cases.get(id);
    if (!c) return [];
    return c.items[rarity] ?? [];
  },

  getAllItems(id) {
    const c = _cases.get(id);
    if (!c) return [];
    return VALID_RARITIES.flatMap(r => (c.items[r] ?? []).map(item => ({ ...item, rarity: r })));
  },

  getAllSkins() {
    const result = [];
    for (const c of _cases.values()) {
      for (const r of VALID_RARITIES) result.push(...(c.items[r] ?? []));
    }
    return result;
  },

  getItem(itemId) {
    for (const c of _cases.values()) {
      for (const r of VALID_RARITIES) {
        const item = (c.items[r] ?? []).find(i => i.item_id === itemId);
        if (item) return item;
      }
    }
    return null;
  },
};
