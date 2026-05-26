import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: {
    getItems: vi.fn(),
    getCase:  vi.fn(),
  },
}));

import { TradeUpEngine, CONTRACT_SIZE, CONTRACT_SIZE_COVERT } from '../../../src/core/trade-up-engine.js';
import { CaseDataStore }               from '../../../src/foundation/case-data-store.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CASE_A = 'recoil_case';
const CASE_B = 'revolution_case';

function makeItem(overrides = {}) {
  return {
    item_id:      'ms_001',
    weapon:       'AK-47',
    skin:         'Redline',
    rarity:       'mil_spec',
    case_id:      CASE_A,
    float:        0.20,
    stat_trak:    false,
    market_price: 10.00,
    ...overrides,
  };
}

function makeTen(overrides = {}) {
  return Array.from({ length: 10 }, () => makeItem(overrides));
}

const NEXT_ITEM = {
  item_id:      'res_001',
  weapon:       'M4A4',
  skin:         'Howl',
  market_price: 50.00,
  image_url:    null,
};

// ─── validate ─────────────────────────────────────────────────────────────────

describe('TradeUpEngine — validate', () => {
  it('test_tue_validate_ok_for_ten_matching_mil_spec', () => {
    expect(TradeUpEngine.validate(makeTen())).toEqual({ ok: true });
  });

  it('test_tue_validate_ok_for_ten_matching_restricted', () => {
    expect(TradeUpEngine.validate(makeTen({ rarity: 'restricted' }))).toEqual({ ok: true });
  });

  it('test_tue_validate_ok_for_ten_matching_classified', () => {
    expect(TradeUpEngine.validate(makeTen({ rarity: 'classified' }))).toEqual({ ok: true });
  });

  it('test_tue_validate_fails_with_fewer_than_ten', () => {
    expect(TradeUpEngine.validate([makeItem()])).toEqual({ ok: false, reason: 'need_ten' });
  });

  it('test_tue_validate_fails_with_more_than_ten', () => {
    expect(TradeUpEngine.validate([...makeTen(), makeItem()])).toEqual({ ok: false, reason: 'need_ten' });
  });

  it('test_tue_validate_ok_for_five_covert', () => {
    const items = Array.from({ length: CONTRACT_SIZE_COVERT }, () => makeItem({ rarity: 'covert' }));
    expect(TradeUpEngine.validate(items)).toEqual({ ok: true });
  });

  it('test_tue_validate_fails_covert_with_ten_items', () => {
    expect(TradeUpEngine.validate(makeTen({ rarity: 'covert' }))).toEqual({ ok: false, reason: 'need_five' });
  });

  it('test_tue_validate_fails_covert_with_fewer_than_five', () => {
    const items = Array.from({ length: 3 }, () => makeItem({ rarity: 'covert' }));
    expect(TradeUpEngine.validate(items)).toEqual({ ok: false, reason: 'need_five' });
  });

  it('test_tue_validate_fails_for_rare_special_rarity', () => {
    expect(TradeUpEngine.validate(makeTen({ rarity: 'rare_special' }))).toEqual({ ok: false, reason: 'ineligible_rarity' });
  });

  it('test_tue_validate_fails_for_mixed_rarity', () => {
    const items = [...makeTen(), makeItem({ rarity: 'restricted' })].slice(0, 10);
    items[9] = makeItem({ rarity: 'restricted' });
    expect(TradeUpEngine.validate(items)).toEqual({ ok: false, reason: 'mixed_rarity' });
  });

  it('test_tue_validate_fails_when_item_missing_case_id', () => {
    const items = makeTen();
    items[0] = makeItem({ case_id: undefined });
    expect(TradeUpEngine.validate(items)).toEqual({ ok: false, reason: 'missing_case_id' });
  });

  it('test_tue_validate_fails_for_mixed_stat_trak', () => {
    const items = makeTen();
    items[0] = makeItem({ stat_trak: true });
    expect(TradeUpEngine.validate(items)).toEqual({ ok: false, reason: 'mixed_stat_trak' });
  });

  it('test_tue_validate_ok_for_all_stat_trak', () => {
    expect(TradeUpEngine.validate(makeTen({ stat_trak: true }))).toEqual({ ok: true });
  });
});

// ─── calcOutputFloat ──────────────────────────────────────────────────────────

describe('TradeUpEngine — calcOutputFloat', () => {
  it('test_tue_calcOutputFloat_returns_average_of_input_floats', () => {
    const items = [makeItem({ float: 0.10 }), makeItem({ float: 0.30 })];
    expect(TradeUpEngine.calcOutputFloat(items)).toBeCloseTo(0.20, 10);
  });

  it('test_tue_calcOutputFloat_all_fn_floats_stays_fn', () => {
    const items = makeTen({ float: 0.05 });
    expect(TradeUpEngine.calcOutputFloat(items)).toBeCloseTo(0.05, 10);
  });

  it('test_tue_calcOutputFloat_clamps_to_zero_minimum', () => {
    const items = makeTen({ float: 0 });
    expect(TradeUpEngine.calcOutputFloat(items)).toBe(0);
  });

  it('test_tue_calcOutputFloat_treats_missing_float_as_zero', () => {
    const items = makeTen({ float: undefined });
    expect(TradeUpEngine.calcOutputFloat(items)).toBe(0);
  });
});

// ─── buildPool ────────────────────────────────────────────────────────────────

describe('TradeUpEngine — buildPool', () => {
  beforeAll(() => {
    CaseDataStore.getItems.mockImplementation((caseId, rarity) => {
      if (rarity !== 'restricted') return [];
      if (caseId === CASE_A) return [NEXT_ITEM, { ...NEXT_ITEM, item_id: 'res_002' }];
      if (caseId === CASE_B) return [{ ...NEXT_ITEM, item_id: 'res_003' }];
      return [];
    });
    CaseDataStore.getCase.mockImplementation(caseId => ({ id: caseId, name: caseId }));
  });

  it('test_tue_buildPool_returns_next_rarity_items', () => {
    const pool = TradeUpEngine.buildPool(makeTen({ rarity: 'mil_spec', case_id: CASE_A }));
    expect(pool.length).toBeGreaterThan(0);
    pool.forEach(e => expect(e.item.rarity).toBe('restricted'));
  });

  it('test_tue_buildPool_weights_proportional_to_case_input_count', () => {
    // 7 from CASE_A (2 next-tier skins) + 3 from CASE_B (1 next-tier skin)
    const items = [
      ...Array(7).fill(null).map(() => makeItem({ rarity: 'mil_spec', case_id: CASE_A })),
      ...Array(3).fill(null).map(() => makeItem({ rarity: 'mil_spec', case_id: CASE_B })),
    ];
    const pool = TradeUpEngine.buildPool(items);

    const totalWt = pool.reduce((s, e) => s + e.weight, 0);
    const caseAWt = pool.filter(e => e.item.case_id === CASE_A).reduce((s, e) => s + e.weight, 0);
    const caseBWt = pool.filter(e => e.item.case_id === CASE_B).reduce((s, e) => s + e.weight, 0);

    // CASE_A contributes 7/10 of total weight; CASE_B contributes 3/10
    expect(caseAWt / totalWt).toBeCloseTo(0.7, 5);
    expect(caseBWt / totalWt).toBeCloseTo(0.3, 5);
  });

  it('test_tue_buildPool_attaches_rarity_and_case_id_to_pool_items', () => {
    const pool = TradeUpEngine.buildPool(makeTen({ rarity: 'mil_spec', case_id: CASE_A }));
    pool.forEach(e => {
      expect(e.item.rarity).toBe('restricted');
      expect(e.item.case_id).toBe(CASE_A);
    });
  });
});

// ─── rollFromPool ─────────────────────────────────────────────────────────────

describe('TradeUpEngine — rollFromPool', () => {
  it('test_tue_rollFromPool_returns_item_from_pool', () => {
    const pool = [{ item: NEXT_ITEM, weight: 1 }];
    expect(TradeUpEngine.rollFromPool(pool)).toBe(NEXT_ITEM);
  });

  it('test_tue_rollFromPool_throws_for_empty_pool', () => {
    expect(() => TradeUpEngine.rollFromPool([])).toThrow('empty_pool');
  });

  it('test_tue_rollFromPool_deterministic_with_injected_rng', () => {
    const pool = [
      { item: { ...NEXT_ITEM, item_id: 'a' }, weight: 0.7 },
      { item: { ...NEXT_ITEM, item_id: 'b' }, weight: 0.3 },
    ];
    // rng returns 0 → first item always wins
    const result = TradeUpEngine.rollFromPool(pool, () => 0);
    expect(result.item_id).toBe('a');
  });
});

// ─── execute ──────────────────────────────────────────────────────────────────

describe('TradeUpEngine — execute', () => {
  beforeAll(() => {
    CaseDataStore.getItems.mockReturnValue([NEXT_ITEM]);
    CaseDataStore.getCase.mockReturnValue({ id: CASE_A, name: 'Recoil Case' });
  });

  it('test_tue_execute_returns_item_with_correct_rarity', () => {
    const result = TradeUpEngine.execute(makeTen());
    expect(result.rarity).toBe('restricted');
  });

  it('test_tue_execute_result_float_equals_average_input_float', () => {
    const items = makeTen({ float: 0.15 });
    const result = TradeUpEngine.execute(items);
    expect(result.float).toBeCloseTo(0.15, 10);
  });

  it('test_tue_execute_result_is_stat_trak_when_all_inputs_are_stat_trak', () => {
    const result = TradeUpEngine.execute(makeTen({ stat_trak: true }));
    expect(result.stat_trak).toBe(true);
  });

  it('test_tue_execute_result_is_not_stat_trak_when_all_inputs_are_standard', () => {
    const result = TradeUpEngine.execute(makeTen({ stat_trak: false }));
    expect(result.stat_trak).toBe(false);
  });

  it('test_tue_execute_throws_on_invalid_input', () => {
    expect(() => TradeUpEngine.execute([makeItem()])).toThrow('need_ten');
  });

  it('test_tue_execute_accepts_rng_for_determinism', () => {
    const result = TradeUpEngine.execute(makeTen(), () => 0);
    expect(result.item_id).toBe(NEXT_ITEM.item_id);
  });
});
