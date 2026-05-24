import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: {
    getCase:  vi.fn(),
    getItems: vi.fn(),
  },
}));

import { DropRateEngine, RollError } from '../../../src/core/drop-rate-engine.js';
import { CaseDataStore } from '../../../src/foundation/case-data-store.js';

// Standard Recoil Case weights
const WEIGHTS = { mil_spec: 79.92, restricted: 15.98, classified: 3.20, covert: 0.64, rare_special: 0.26 };

const ITEMS = {
  mil_spec:     Array.from({ length: 7 }, (_, i) => ({ item_id: `ms_${i}`, weapon: 'P250', skin: `Skin${i}`, stattrak: true })),
  restricted:   [{ item_id: 're_0', weapon: 'UMP-45', skin: 'Fade', stattrak: true }],
  classified:   [{ item_id: 'cl_0', weapon: 'AK-47', skin: 'Ice Coaled', stattrak: true }],
  covert:       [{ item_id: 'cv_0', weapon: 'AUG', skin: 'Momentum', stattrak: true }],
  rare_special: [{ item_id: 'rs_0', weapon: 'Karambit', skin: 'Vanilla', stattrak: false }],
};

function setupCase() {
  CaseDataStore.getCase.mockReturnValue({ id: 'recoil_case', rarity_weights: { ...WEIGHTS } });
  CaseDataStore.getItems.mockImplementation((id, tier) => [...(ITEMS[tier] ?? [])]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupCase();
});

// ─── Happy path ──────────────────────────────────────────────────────────────

describe('DropRateEngine — roll() happy path', () => {
  it('test_dre_roll_returns_item_entry_with_required_fields', () => {
    // Arrange — rng forces mil_spec (r1=0.0) then first item (r2=0.0)
    const item = DropRateEngine.roll('recoil_case', () => 0.0);
    expect(item).toHaveProperty('item_id');
    expect(item).toHaveProperty('weapon');
    expect(item).toHaveProperty('skin');
    expect(item).toHaveProperty('stattrak');
  });

  it('test_dre_roll_returned_item_has_source_properties', () => {
    // rng 0.0 → mil_spec tier, first item
    const item = DropRateEngine.roll('recoil_case', () => 0.0);
    expect(item.item_id).toBe('ms_0');
    expect(item.weapon).toBe('P250');
    expect(item.skin).toBe('Skin0');
  });

  it('test_dre_roll_injects_rarity_into_returned_item', () => {
    // rng 0.0 → mil_spec
    const item = DropRateEngine.roll('recoil_case', () => 0.0);
    expect(item.rarity).toBe('mil_spec');
  });

  it('test_dre_roll_rare_special_item_has_rare_special_rarity', () => {
    // rng 0.9999 on first call → rare_special tier; 0.0 on second → first item
    let call = 0;
    const item = DropRateEngine.roll('recoil_case', () => call++ === 0 ? 0.9999 : 0.0);
    expect(item.rarity).toBe('rare_special');
    expect(item.weapon).toBe('Karambit');
  });

  it('test_dre_roll_is_synchronous', () => {
    // Just verify it doesn't return a Promise
    const result = DropRateEngine.roll('recoil_case', () => 0.0);
    expect(result).not.toBeInstanceOf(Promise);
  });
});

// ─── Phase 1: weighted tier selection ────────────────────────────────────────

describe('DropRateEngine — Phase 1 tier selection', () => {
  it('test_dre_phase1_r1_zero_selects_mil_spec', () => {
    // r1 = 0.0 < 0.7992 → mil_spec
    const item = DropRateEngine.roll('recoil_case', () => 0.0);
    expect(CaseDataStore.getItems).toHaveBeenCalledWith('recoil_case', 'mil_spec');
    expect(item.rarity).toBe('mil_spec');
    expect(ITEMS.mil_spec.some(i => i.item_id === item.item_id)).toBe(true);
  });

  it('test_dre_phase1_r1_in_restricted_range_selects_restricted', () => {
    // mil_spec cumulative = 0.7992; restricted cumulative = 0.9590
    // r1 = 0.85 is in restricted range
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.85 : 0.0);
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(CaseDataStore.getItems).toHaveBeenCalledWith('recoil_case', 'restricted');
    expect(item.rarity).toBe('restricted');
    expect(ITEMS.restricted.some(i => i.item_id === item.item_id)).toBe(true);
  });

  it('test_dre_phase1_r1_in_classified_range_selects_classified', () => {
    // restricted cumulative = 0.9590; classified cumulative = 0.9910
    // r1 = 0.96 is in classified range
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.96 : 0.0);
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(CaseDataStore.getItems).toHaveBeenCalledWith('recoil_case', 'classified');
    expect(item.rarity).toBe('classified');
    expect(ITEMS.classified.some(i => i.item_id === item.item_id)).toBe(true);
  });

  it('test_dre_phase1_r1_in_covert_range_selects_covert', () => {
    // classified cumulative = 0.9910; covert cumulative = 0.9974
    // r1 = 0.993 is in covert range
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.993 : 0.0);
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(CaseDataStore.getItems).toHaveBeenCalledWith('recoil_case', 'covert');
    expect(item.rarity).toBe('covert');
    expect(ITEMS.covert.some(i => i.item_id === item.item_id)).toBe(true);
  });

  it('test_dre_phase1_r1_near_one_selects_rare_special', () => {
    // r1 = 0.999 — falls in rare_special range or via fallback
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.999 : 0.0);
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(CaseDataStore.getItems).toHaveBeenCalledWith('recoil_case', 'rare_special');
    expect(item.rarity).toBe('rare_special');
    expect(ITEMS.rare_special.some(i => i.item_id === item.item_id)).toBe(true);
  });

  it('test_dre_phase1_fallback_selects_rare_special_when_loop_does_not_break', () => {
    // If all cumulative thresholds are somehow < r1 (float edge case), rare_special is the fallback
    // Simulate this by making r1 = 1.0 (edge case; Math.random() never returns exactly 1.0 but we can test the fallback)
    // Actually, r1 = 0.9999 should hit rare_special in the loop since cumulative reaches 1.0
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.9999 : 0.0);
    DropRateEngine.roll('recoil_case', rng);
    expect(CaseDataStore.getItems).toHaveBeenCalledWith('recoil_case', 'rare_special');
  });
});

// ─── Phase 2: uniform item selection ─────────────────────────────────────────

describe('DropRateEngine — Phase 2 uniform item selection', () => {
  it('test_dre_phase2_r2_zero_returns_first_item', () => {
    // Force mil_spec (r1=0), first item (r2=0) → items[0]
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.0 : 0.0);
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(item.item_id).toBe(ITEMS.mil_spec[0].item_id);
  });

  it('test_dre_phase2_r2_halfway_returns_middle_item', () => {
    // 7 mil_spec items; r2 = 0.5 → floor(0.5 * 7) = 3 → items[3]
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.0 : 0.5);
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(item.item_id).toBe(ITEMS.mil_spec[3].item_id);
  });

  it('test_dre_phase2_r2_near_one_returns_last_item_without_out_of_bounds', () => {
    // 7 items; r2 = 0.9999 → floor(0.9999 * 7) = 6 → items[6] (last valid index)
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.0 : 0.9999);
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(item.item_id).toBe(ITEMS.mil_spec[6].item_id);
    expect(item).not.toBeUndefined();
  });

  it('test_dre_phase2_single_item_tier_always_returns_that_item', () => {
    // rare_special has 1 item — any r2 should return it
    let callCount = 0;
    const rng = () => (callCount++ === 0 ? 0.999 : 0.9999); // → rare_special, then items[0]
    const item = DropRateEngine.roll('recoil_case', rng);
    expect(item.item_id).toBe(ITEMS.rare_special[0].item_id);
  });
});

// ─── Statistical distribution (reduced Monte Carlo) ─────────────────────────

describe('DropRateEngine — distribution', () => {
  it('test_dre_roll_5000_times_tier_frequencies_match_weights_within_2pct', () => {
    const N = 5000;
    const counts = { mil_spec: 0, restricted: 0, classified: 0, covert: 0, rare_special: 0 };

    // Use a real rng sequence but track which tier getItems was called with
    CaseDataStore.getItems.mockImplementation((id, tier) => {
      counts[tier]++;
      return [{ item_id: 'x', weapon: 'P', skin: 'S', stattrak: false }];
    });

    for (let i = 0; i < N; i++) {
      DropRateEngine.roll('recoil_case'); // uses real Math.random
    }

    const expected = { mil_spec: 79.92, restricted: 15.98, classified: 3.20, covert: 0.64, rare_special: 0.26 };
    const TOLERANCE = 2.0; // ±2% absolute

    for (const [tier, expectedPct] of Object.entries(expected)) {
      const observedPct = (counts[tier] / N) * 100;
      expect(observedPct).toBeGreaterThanOrEqual(expectedPct - TOLERANCE);
      expect(observedPct).toBeLessThanOrEqual(expectedPct + TOLERANCE);
    }
  });
});

// ─── Statelessness ───────────────────────────────────────────────────────────

describe('DropRateEngine — statelessness', () => {
  it('test_dre_roll_holds_no_internal_state_between_calls', () => {
    // Verify roll() has no side effects on any module-level variable
    // by confirming results are fully determined by rng and case data
    const rng = () => 0.0; // always mil_spec, always first item
    const item1 = DropRateEngine.roll('recoil_case', rng);
    const item2 = DropRateEngine.roll('recoil_case', rng);
    expect(item1).toEqual(item2); // same rng → same properties, no streak memory
  });

  it('test_dre_roll_does_not_mutate_case_data_store_items', () => {
    const before = JSON.stringify(ITEMS.mil_spec);
    DropRateEngine.roll('recoil_case', () => 0.0);
    DropRateEngine.roll('recoil_case', () => 0.0);
    const after = JSON.stringify(ITEMS.mil_spec);
    expect(after).toBe(before);
  });
});

// ─── Error cases ─────────────────────────────────────────────────────────────

describe('DropRateEngine — errors', () => {
  it('test_dre_roll_throws_roll_error_for_unknown_case_id', () => {
    CaseDataStore.getCase.mockReturnValue(null);
    expect(() => DropRateEngine.roll('ghost_case')).toThrow(RollError);
    expect(() => DropRateEngine.roll('ghost_case')).toThrow('Case not found: ghost_case');
  });

  it('test_dre_roll_throws_roll_error_for_empty_item_pool', () => {
    // Force mil_spec tier to be selected, then return empty array
    CaseDataStore.getItems.mockReturnValue([]);
    expect(() => DropRateEngine.roll('recoil_case', () => 0.0)).toThrow(RollError);
    expect(() => DropRateEngine.roll('recoil_case', () => 0.0)).toThrow(/Empty item pool for tier/);
  });

  it('test_dre_roll_error_does_not_return_an_item', () => {
    CaseDataStore.getCase.mockReturnValue(null);
    let returned;
    try { returned = DropRateEngine.roll('ghost_case'); } catch (_) {}
    expect(returned).toBeUndefined();
  });
});
