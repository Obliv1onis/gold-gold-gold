import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies — keeps these as unit tests
vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: { getCase: vi.fn() },
}));
vi.mock('../../../src/core/virtual-economy.js', () => ({
  VirtualEconomy: { spend: vi.fn(), canAfford: vi.fn() },
  KEY_COST_USD: 2.49,
  STARTING_BALANCE: 2000,
  EconomyError: class EconomyError extends Error {},
}));

import { CaseInventory, InventoryError } from '../../../src/core/case-inventory.js';
import { CaseDataStore } from '../../../src/foundation/case-data-store.js';
import { VirtualEconomy } from '../../../src/core/virtual-economy.js';

const VALID_CASE_ID = 'recoil_case';

beforeEach(() => {
  localStorage.clear();
  CaseInventory.clearInventory();
  vi.clearAllMocks();
  CaseDataStore.getCase.mockReturnValue({ id: VALID_CASE_ID }); // valid by default
  VirtualEconomy.spend.mockReturnValue(true);                  // affordable by default
});

// ─── getCaseCount / hasCase ──────────────────────────────────────────────────

describe('CaseInventory — getCaseCount / hasCase', () => {
  it('test_ci_getCaseCount_returns_zero_for_unknown_case', () => {
    expect(CaseInventory.getCaseCount('unknown')).toBe(0);
  });

  it('test_ci_hasCase_returns_false_when_count_zero', () => {
    expect(CaseInventory.hasCase(VALID_CASE_ID)).toBe(false);
  });

  it('test_ci_hasCase_returns_true_when_count_at_least_one', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    expect(CaseInventory.hasCase(VALID_CASE_ID)).toBe(true);
  });
});

// ─── buyCase ─────────────────────────────────────────────────────────────────

describe('CaseInventory — buyCase', () => {
  it('test_ci_buyCase_increments_count_and_returns_true', () => {
    const result = CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    expect(result).toBe(true);
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(1);
  });

  it('test_ci_buyCase_two_arg_form_buys_one_case', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(1);
    expect(VirtualEconomy.spend).toHaveBeenCalledWith(0.50);
  });

  it('test_ci_buyCase_with_quantity_increments_by_quantity', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50, 5);
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(5);
    expect(VirtualEconomy.spend).toHaveBeenCalledWith(2.50);
  });

  it('test_ci_buyCase_returns_false_when_spend_fails', () => {
    VirtualEconomy.spend.mockReturnValue(false);
    const result = CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    expect(result).toBe(false);
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(0);
  });

  it('test_ci_buyCase_returns_false_for_unknown_case_id', () => {
    CaseDataStore.getCase.mockReturnValue(null);
    const result = CaseInventory.buyCase('fake_case', 0.50);
    expect(result).toBe(false);
    expect(VirtualEconomy.spend).not.toHaveBeenCalled();
  });

  it('test_ci_buyCase_throws_inventory_error_for_zero_quantity', () => {
    expect(() => CaseInventory.buyCase(VALID_CASE_ID, 0.50, 0)).toThrow(InventoryError);
    expect(() => CaseInventory.buyCase(VALID_CASE_ID, 0.50, 0)).toThrow('quantity must be positive');
  });

  it('test_ci_buyCase_throws_inventory_error_for_negative_quantity', () => {
    expect(() => CaseInventory.buyCase(VALID_CASE_ID, 0.50, -1)).toThrow(InventoryError);
  });

  it('test_ci_buyCase_throws_inventory_error_for_zero_unit_price', () => {
    expect(() => CaseInventory.buyCase(VALID_CASE_ID, 0, 1)).toThrow(InventoryError);
    expect(() => CaseInventory.buyCase(VALID_CASE_ID, 0, 1)).toThrow('unitPrice must be positive');
  });

  it('test_ci_buyCase_persists_new_count_to_localstorage', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    const stored = JSON.parse(localStorage.getItem('vault_case_inventory'));
    expect(stored[VALID_CASE_ID]).toBe(1);
  });

  it('test_ci_buyCase_fires_case_inventory_changed_event', () => {
    let detail = null;
    document.addEventListener('case-inventory-changed', e => { detail = e.detail; }, { once: true });
    CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    expect(detail).toEqual({ caseId: VALID_CASE_ID, count: 1 });
  });
});

// ─── removeCase ──────────────────────────────────────────────────────────────

describe('CaseInventory — removeCase', () => {
  it('test_ci_removeCase_decrements_count_and_returns_true', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    const result = CaseInventory.removeCase(VALID_CASE_ID);
    expect(result).toBe(true);
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(0);
  });

  it('test_ci_removeCase_returns_false_when_count_zero', () => {
    const result = CaseInventory.removeCase(VALID_CASE_ID);
    expect(result).toBe(false);
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(0);
  });

  it('test_ci_removeCase_returns_false_for_unknown_case_id', () => {
    expect(CaseInventory.removeCase('nonexistent')).toBe(false);
  });

  it('test_ci_removeCase_persists_after_decrement', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50, 2);
    CaseInventory.removeCase(VALID_CASE_ID);
    const stored = JSON.parse(localStorage.getItem('vault_case_inventory'));
    expect(stored[VALID_CASE_ID]).toBe(1);
  });

  it('test_ci_removeCase_fires_case_inventory_changed_event', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50, 2);
    let detail = null;
    document.addEventListener('case-inventory-changed', e => { detail = e.detail; }, { once: true });
    CaseInventory.removeCase(VALID_CASE_ID);
    expect(detail).toEqual({ caseId: VALID_CASE_ID, count: 1 });
  });
});

// ─── getInventory ────────────────────────────────────────────────────────────

describe('CaseInventory — getInventory', () => {
  it('test_ci_getInventory_returns_shallow_copy', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50, 3);
    const inv = CaseInventory.getInventory();
    inv[VALID_CASE_ID] = 999; // mutate the copy
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(3); // original unchanged
  });
});

// ─── clearInventory ──────────────────────────────────────────────────────────

describe('CaseInventory — clearInventory', () => {
  it('test_ci_clearInventory_resets_count_map_to_empty', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50, 5);
    CaseInventory.clearInventory();
    expect(CaseInventory.getCaseCount(VALID_CASE_ID)).toBe(0);
    expect(Object.keys(CaseInventory.getInventory())).toHaveLength(0);
  });

  it('test_ci_clearInventory_persists_empty_map', () => {
    CaseInventory.buyCase(VALID_CASE_ID, 0.50);
    CaseInventory.clearInventory();
    const stored = JSON.parse(localStorage.getItem('vault_case_inventory'));
    expect(stored).toEqual({});
  });

  it('test_ci_clearInventory_fires_case_inventory_changed_event', () => {
    let detail = null;
    document.addEventListener('case-inventory-changed', e => { detail = e.detail; }, { once: true });
    CaseInventory.clearInventory();
    expect(detail).toEqual({ caseId: null, count: 0 });
  });
});

// ─── Persistence — corrupt data ──────────────────────────────────────────────

describe('CaseInventory — corrupt localStorage', () => {
  it('test_ci_loads_empty_inventory_when_localstorage_is_corrupt_string', async () => {
    localStorage.setItem('vault_case_inventory', '"not-an-object"');
    vi.resetModules();

    vi.mock('../../../src/foundation/case-data-store.js', () => ({ CaseDataStore: { getCase: vi.fn() } }));
    vi.mock('../../../src/core/virtual-economy.js', () => ({ VirtualEconomy: { spend: vi.fn() }, KEY_COST_USD: 2.49, STARTING_BALANCE: 2000, EconomyError: class extends Error {} }));

    const { CaseInventory: Fresh } = await import('../../../src/core/case-inventory.js');
    expect(Fresh.getCaseCount('any')).toBe(0);
  });
});
