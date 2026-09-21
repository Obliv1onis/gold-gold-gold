// Static case data store. Loads cases.json + souvenirs.json once at startup; read-only for the session.
// See GDD: design/gdd/case-data-store.md for schema, validation rules, and edge cases.

const WEAPON_CASE_RARITIES = ['mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];
const TERMINAL_RARITIES    = ['mil_spec', 'restricted', 'classified', 'covert'];
const ALL_RARITIES = ['consumer_grade', 'industrial_grade', 'mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];

let _cases = new Map();
let _state = 'unloaded'; // 'unloaded' | 'loaded' | 'error'
let _caseLists = new Map();
let _allItemsByCase = new Map();
let _itemById = new Map();
let _caseByItemId = new Map();
let _allSkins = [];

function _validateEntry(entry) {
  const type = entry.type ?? 'weapon_case';

  if (type !== 'weapon_case' && type !== 'souvenir_package' && type !== 'terminal') {
    console.warn(`[CDS] Skipping "${entry.id}": unrecognized type "${type}"`);
    return false;
  }

  const weights = entry.rarity_weights ?? {};
  const terminalRarities = (weights.rare_special ?? 0) > 0
    ? [...TERMINAL_RARITIES, 'rare_special']
    : TERMINAL_RARITIES;
  const checkRarities = type === 'weapon_case' ? WEAPON_CASE_RARITIES
                      : type === 'terminal'     ? terminalRarities
                      :                          ALL_RARITIES;
  const sum = checkRarities.reduce((acc, r) => acc + (weights[r] ?? 0), 0);
  if (Math.abs(sum - 100.0) > 0.01) {
    console.error(`[CDS] Data error: "${entry.id}" weights sum to ${sum.toFixed(4)} (expected 100.0 ±0.01). Skipping.`);
    return false;
  }

  const items = entry.items ?? {};

  if (type === 'weapon_case' || type === 'terminal') {
    const rarities = type === 'weapon_case' ? WEAPON_CASE_RARITIES : terminalRarities;
    for (const rarity of rarities) {
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
    _caseLists.clear();
    _allItemsByCase.clear();
    _itemById.clear();
    _caseByItemId.clear();
    _allSkins = [];

    try {
      const [caseEntries, souvenirEntries] = await Promise.all([
        _loadFile(caseUrl, true),
        souvenirUrl
          ? _loadFile(souvenirUrl, false).catch(err => {
              console.warn(`[CDS] Failed to load ${souvenirUrl}: ${err.message}`);
              return [];
            })
          : Promise.resolve([]),
      ]);
      const allEntries = [...caseEntries, ...souvenirEntries];

      const seenIds = new Set();
      for (const entry of allEntries) {
        if (seenIds.has(entry.id)) {
          console.error(`[CDS] Duplicate id "${entry.id}". Keeping first, skipping duplicate.`);
          continue;
        }
        if (!_validateEntry(entry)) continue;
        seenIds.add(entry.id);
        const normalized = _normalizeEntry(entry);
        _cases.set(entry.id, normalized);

        const flattened = [];
        for (const rarity of ALL_RARITIES) {
          for (const item of normalized.items[rarity] ?? []) {
            _allSkins.push(item);
            flattened.push({ ...item, rarity });
            if (!_itemById.has(item.item_id)) {
              _itemById.set(item.item_id, item);
              _caseByItemId.set(item.item_id, entry.id);
            }
          }
        }
        _allItemsByCase.set(entry.id, flattened);
      }

      const allMetadata = [..._cases.values()].map(({ items, ...meta }) => meta);
      _caseLists.set('all', allMetadata);
      for (const type of ['weapon_case', 'souvenir_package', 'terminal']) {
        _caseLists.set(type, allMetadata.filter(entry => entry.type === type));
      }
    } catch (err) {
      _state = 'error';
      throw err;
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
    return [...(_caseLists.get(type ?? 'all') ?? [])];
  },

  getItems(id, rarity) {
    const c = _cases.get(id);
    if (!c) return [];
    return c.items[rarity] ?? [];
  },

  getAllItems(id) {
    return _allItemsByCase.get(id) ?? [];
  },

  getAllSkins() {
    return [..._allSkins];
  },

  getItem(itemId) {
    return _itemById.get(itemId) ?? null;
  },

  /** Returns the case id that contains the given item_id, or null if not found. */
  findCaseForItem(itemId) {
    return _caseByItemId.get(itemId) ?? null;
  },
};
