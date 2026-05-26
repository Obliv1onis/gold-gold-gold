// Static case data store. Loads cases.json + souvenirs.json once at startup; read-only for the session.
// See GDD: design/gdd/case-data-store.md for schema, validation rules, and edge cases.

const WEAPON_CASE_RARITIES = ['mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];
const ALL_RARITIES = ['consumer_grade', 'industrial_grade', 'mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];

let _cases = new Map();
let _state = 'unloaded'; // 'unloaded' | 'loaded' | 'error'

function _validateEntry(entry) {
  const type = entry.type ?? 'weapon_case';

  if (type !== 'weapon_case' && type !== 'souvenir_package') {
    console.warn(`[CDS] Skipping "${entry.id}": unrecognized type "${type}"`);
    return false;
  }

  const weights = entry.rarity_weights ?? {};
  const checkRarities = type === 'weapon_case' ? WEAPON_CASE_RARITIES : ALL_RARITIES;
  const sum = checkRarities.reduce((acc, r) => acc + (weights[r] ?? 0), 0);
  if (Math.abs(sum - 100.0) > 0.01) {
    console.error(`[CDS] Data error: "${entry.id}" weights sum to ${sum.toFixed(4)} (expected 100.0 ±0.01). Skipping.`);
    return false;
  }

  const items = entry.items ?? {};

  if (type === 'weapon_case') {
    for (const rarity of WEAPON_CASE_RARITIES) {
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
  } else {
    // souvenir_package: at least one tier must have items; weight/items must be consistent
    let hasAnyItems = false;
    for (const rarity of ALL_RARITIES) {
      const tier = items[rarity] ?? [];
      const weight = weights[rarity] ?? 0;
      if (tier.length > 0) hasAnyItems = true;
      if (weight > 0 && tier.length === 0) {
        console.error(`[CDS] Data error: "${entry.id}" tier "${rarity}" has weight ${weight} but no items. Skipping.`);
        return false;
      }
      if (weight === 0 && tier.length > 0) {
        console.error(`[CDS] Data error: "${entry.id}" tier "${rarity}" has items but weight 0.0. Skipping.`);
        return false;
      }
    }
    if (!hasAnyItems) {
      console.error(`[CDS] Data error: "${entry.id}" has no items in any tier. Skipping.`);
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
  for (const r of ALL_RARITIES) {
    items[r] = (entry.items[r] ?? []).map(_normalizeItem);
  }
  return { ...entry, items };
}

async function _loadFile(url, required) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.format_version) {
    console.warn(`[CDS] Warning: ${url} missing format_version field.`);
  }
  return data.cases ?? [];
}

export const CaseDataStore = {
  getState() { return _state; },

  /**
   * @param {string} caseUrl   - URL for weapon cases JSON (required)
   * @param {string} souvenirUrl - URL for souvenir packages JSON (optional, non-fatal if missing)
   */
  async init(caseUrl = '/data/cases.json', souvenirUrl = '/data/souvenirs.json') {
    _state = 'unloaded';
    _cases.clear();

    let allEntries = [];

    try {
      allEntries.push(...await _loadFile(caseUrl, true));
    } catch (err) {
      _state = 'error';
      throw err;
    }

    if (souvenirUrl) {
      try {
        allEntries.push(...await _loadFile(souvenirUrl, false));
      } catch (err) {
        console.warn(`[CDS] Failed to load ${souvenirUrl}: ${err.message}`);
      }
    }

    const seenIds = new Set();
    for (const entry of allEntries) {
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

  /**
   * Returns metadata only (item pools excluded).
   * @param {string|null} type - 'weapon_case' | 'souvenir_package' | null (all)
   */
  getCaseList(type = null) {
    return Array.from(_cases.values())
      .filter(e => type === null || e.type === type)
      .map(({ items, ...meta }) => meta);
  },

  getItems(id, rarity) {
    const c = _cases.get(id);
    if (!c) return [];
    return c.items[rarity] ?? [];
  },

  getAllItems(id) {
    const c = _cases.get(id);
    if (!c) return [];
    return ALL_RARITIES.flatMap(r => (c.items[r] ?? []).map(item => ({ ...item, rarity: r })));
  },

  getAllSkins() {
    const result = [];
    for (const c of _cases.values()) {
      for (const r of ALL_RARITIES) result.push(...(c.items[r] ?? []));
    }
    return result;
  },

  getItem(itemId) {
    for (const c of _cases.values()) {
      for (const r of ALL_RARITIES) {
        const item = (c.items[r] ?? []).find(i => i.item_id === itemId);
        if (item) return item;
      }
    }
    return null;
  },

  /** Returns the case id that contains the given item_id, or null if not found. */
  findCaseForItem(itemId) {
    for (const [caseId, c] of _cases) {
      for (const r of ALL_RARITIES) {
        if ((c.items[r] ?? []).some(it => it.item_id === itemId)) return caseId;
      }
    }
    return null;
  },
};
