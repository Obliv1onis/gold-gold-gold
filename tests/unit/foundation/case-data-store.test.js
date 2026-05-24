import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CaseDataStore } from '../../../src/foundation/case-data-store.js';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const ITEM = (overrides = {}) => ({
  weapon: 'P250', skin: 'Re.built', item_id: 'p250_rebuilt',
  image_url: 'https://example.com/p250.png', market_price: 0.50, stattrak: true,
  ...overrides,
});

const WEIGHTS = { mil_spec: 79.92, restricted: 15.98, classified: 3.20, covert: 0.64, rare_special: 0.26 };

const CASE = (overrides = {}) => ({
  id: 'recoil_case',
  name: 'Recoil Case',
  release_date: '2022-07-01',
  type: 'weapon_case',
  image_url: 'https://example.com/recoil.png',
  market_price: 0.49,
  rarity_weights: { ...WEIGHTS },
  items: {
    mil_spec:     [ITEM({ item_id: 'mil_1' }), ITEM({ item_id: 'mil_2' })],
    restricted:   [ITEM({ item_id: 'res_1' })],
    classified:   [ITEM({ item_id: 'cls_1' })],
    covert:       [ITEM({ item_id: 'cvt_1' })],
    rare_special: [ITEM({ item_id: 'rs_1' })],
  },
  ...overrides,
});

function stubFetch(payload) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  }));
}

function stubFetchError(status = 404) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Loading lifecycle ───────────────────────────────────────────────────────

describe('CaseDataStore — loading lifecycle', () => {
  it('test_cds_init_sets_state_to_loaded_on_success', async () => {
    // Arrange
    stubFetch({ format_version: '1.0', cases: [CASE()] });

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(CaseDataStore.getState()).toBe('loaded');
  });

  it('test_cds_init_sets_state_to_error_on_http_failure', async () => {
    // Arrange
    stubFetchError(404);

    // Act / Assert
    await expect(CaseDataStore.init('/fake/cases.json')).rejects.toThrow();
    expect(CaseDataStore.getState()).toBe('error');
  });

  it('test_cds_init_sets_state_to_error_on_network_failure', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network fail')));

    // Act / Assert
    await expect(CaseDataStore.init('/fake/cases.json')).rejects.toThrow('network fail');
    expect(CaseDataStore.getState()).toBe('error');
  });

  it('test_cds_init_loads_cases_from_cases_array', async () => {
    // Arrange
    stubFetch({ format_version: '1.0', cases: [CASE(), CASE({ id: 'fracture_case', name: 'Fracture Case' })] });

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(CaseDataStore.getCaseList()).toHaveLength(2);
  });

  it('test_cds_init_warns_when_format_version_missing', async () => {
    // Arrange
    stubFetch({ cases: [CASE()] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('format_version'));
    warn.mockRestore();
  });
});

// ─── Validation — skipped entries ───────────────────────────────────────────

describe('CaseDataStore — entry validation', () => {
  it('test_cds_init_skips_case_with_wrong_type', async () => {
    // Arrange
    stubFetch({ format_version: '1.0', cases: [CASE({ type: 'sticker_capsule' })] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(CaseDataStore.getCaseList()).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('test_cds_init_skips_case_with_weights_too_high', async () => {
    // Arrange — weights sum to 100.50
    const badWeights = { mil_spec: 80.42, restricted: 15.98, classified: 3.20, covert: 0.64, rare_special: 0.26 };
    stubFetch({ format_version: '1.0', cases: [CASE({ rarity_weights: badWeights })] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(CaseDataStore.getCaseList()).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('test_cds_init_accepts_case_with_weights_within_tolerance', async () => {
    // Arrange — weights sum to 99.995 (within ±0.01)
    const closeWeights = { mil_spec: 79.915, restricted: 15.98, classified: 3.20, covert: 0.64, rare_special: 0.26 };
    stubFetch({ format_version: '1.0', cases: [CASE({ rarity_weights: closeWeights })] });

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(CaseDataStore.getCaseList()).toHaveLength(1);
  });

  it('test_cds_init_skips_case_with_empty_rarity_tier', async () => {
    // Arrange
    const items = { ...CASE().items, mil_spec: [] };
    stubFetch({ format_version: '1.0', cases: [CASE({ items })] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(CaseDataStore.getCaseList()).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('test_cds_init_skips_case_with_zero_weight_but_items_in_tier', async () => {
    // Arrange — mil_spec has items but weight 0
    const badWeights = { mil_spec: 0, restricted: 95.98, classified: 3.20, covert: 0.64, rare_special: 0.18 };
    stubFetch({ format_version: '1.0', cases: [CASE({ rarity_weights: badWeights })] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    expect(CaseDataStore.getCaseList()).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('test_cds_init_keeps_first_and_skips_duplicate_id', async () => {
    // Arrange
    const first = CASE({ name: 'First' });
    const second = CASE({ name: 'Second' }); // same id "recoil_case"
    stubFetch({ format_version: '1.0', cases: [first, second] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert — first wins
    expect(CaseDataStore.getCaseList()).toHaveLength(1);
    expect(CaseDataStore.getCase('recoil_case').name).toBe('First');
    vi.restoreAllMocks();
  });
});

// ─── Normalization ───────────────────────────────────────────────────────────

describe('CaseDataStore — item normalization', () => {
  it('test_cds_getCase_normalizes_missing_image_url_to_null', async () => {
    // Arrange — item has no image_url
    const items = { ...CASE().items, mil_spec: [ITEM({ item_id: 'x', image_url: undefined })] };
    stubFetch({ format_version: '1.0', cases: [CASE({ items })] });

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    const [item] = CaseDataStore.getItems('recoil_case', 'mil_spec');
    expect(item.image_url).toBeNull();
  });

  it('test_cds_getCase_normalizes_missing_stattrak_to_false', async () => {
    // Arrange — item has no stattrak field
    const rawItem = { weapon: 'Glock-18', skin: 'Winterized', item_id: 'glock_x', market_price: 0.05 };
    const items = { ...CASE().items, mil_spec: [rawItem] };
    stubFetch({ format_version: '1.0', cases: [CASE({ items })] });

    // Act
    await CaseDataStore.init('/fake/cases.json');

    // Assert
    const [item] = CaseDataStore.getItems('recoil_case', 'mil_spec');
    expect(item.stattrak).toBe(false);
  });
});

// ─── Query interface ─────────────────────────────────────────────────────────

describe('CaseDataStore — getCase', () => {
  beforeEach(async () => {
    stubFetch({ format_version: '1.0', cases: [CASE()] });
    await CaseDataStore.init('/fake/cases.json');
  });

  it('test_cds_getCase_returns_entry_for_valid_id', () => {
    expect(CaseDataStore.getCase('recoil_case')).not.toBeNull();
    expect(CaseDataStore.getCase('recoil_case').name).toBe('Recoil Case');
  });

  it('test_cds_getCase_returns_null_for_unknown_id', () => {
    expect(CaseDataStore.getCase('unknown_case')).toBeNull();
  });
});

describe('CaseDataStore — getCaseList', () => {
  it('test_cds_getCaseList_returns_all_loaded_cases', async () => {
    // Arrange
    stubFetch({ format_version: '1.0', cases: [CASE(), CASE({ id: 'fracture_case', name: 'Fracture Case' })] });
    await CaseDataStore.init('/fake/cases.json');

    // Act
    const list = CaseDataStore.getCaseList();

    // Assert
    expect(list).toHaveLength(2);
  });

  it('test_cds_getCaseList_omits_items_field', async () => {
    // Arrange
    stubFetch({ format_version: '1.0', cases: [CASE()] });
    await CaseDataStore.init('/fake/cases.json');

    // Act
    const [entry] = CaseDataStore.getCaseList();

    // Assert — metadata only
    expect(entry.items).toBeUndefined();
    expect(entry.id).toBe('recoil_case');
  });
});

describe('CaseDataStore — getItems', () => {
  beforeEach(async () => {
    stubFetch({ format_version: '1.0', cases: [CASE()] });
    await CaseDataStore.init('/fake/cases.json');
  });

  it('test_cds_getItems_returns_correct_tier_items', () => {
    // Act
    const items = CaseDataStore.getItems('recoil_case', 'mil_spec');

    // Assert
    expect(items).toHaveLength(2); // CASE() fixture has 2 mil_spec items
    expect(items[0].item_id).toBe('mil_1');
  });

  it('test_cds_getItems_returns_empty_array_for_unknown_case', () => {
    expect(CaseDataStore.getItems('unknown_case', 'mil_spec')).toEqual([]);
  });
});

describe('CaseDataStore — getAllItems', () => {
  beforeEach(async () => {
    stubFetch({ format_version: '1.0', cases: [CASE()] });
    await CaseDataStore.init('/fake/cases.json');
  });

  it('test_cds_getAllItems_returns_flat_array_of_all_tiers', () => {
    // Arrange — CASE() has 2 mil_spec + 1 restricted + 1 classified + 1 covert + 1 rare_special = 6
    const items = CaseDataStore.getAllItems('recoil_case');
    expect(items).toHaveLength(6);
  });

  it('test_cds_getAllItems_contains_no_duplicates', () => {
    const items = CaseDataStore.getAllItems('recoil_case');
    const ids = items.map(i => i.item_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('test_cds_getAllItems_returns_empty_array_for_unknown_case', () => {
    expect(CaseDataStore.getAllItems('unknown_case')).toEqual([]);
  });
});

describe('CaseDataStore — getItem', () => {
  beforeEach(async () => {
    stubFetch({ format_version: '1.0', cases: [CASE()] });
    await CaseDataStore.init('/fake/cases.json');
  });

  it('test_cds_getItem_returns_matching_item_by_id', () => {
    const item = CaseDataStore.getItem('rs_1');
    expect(item).not.toBeNull();
    expect(item.item_id).toBe('rs_1');
  });

  it('test_cds_getItem_returns_null_for_unknown_item_id', () => {
    expect(CaseDataStore.getItem('nonexistent_item')).toBeNull();
  });
});

describe('CaseDataStore — getAllSkins', () => {
  it('test_cds_getAllSkins_returns_every_item_across_all_cases', async () => {
    // Arrange — two cases, 6 items each (from CASE() fixture)
    stubFetch({ format_version: '1.0', cases: [CASE(), CASE({ id: 'fracture_case', name: 'Fracture Case' })] });
    await CaseDataStore.init('/fake/cases.json');

    // Act
    const skins = CaseDataStore.getAllSkins();

    // Assert — 6 + 6 = 12 total items
    expect(skins).toHaveLength(12);
  });

  it('test_cds_getAllSkins_returns_empty_when_no_cases_loaded', async () => {
    stubFetch({ format_version: '1.0', cases: [] });
    await CaseDataStore.init('/fake/cases.json');
    expect(CaseDataStore.getAllSkins()).toEqual([]);
  });
});
