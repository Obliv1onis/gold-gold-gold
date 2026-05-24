import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock VirtualEconomy — keeps this a unit test
vi.mock('../../../src/core/virtual-economy.js', () => ({
  VirtualEconomy: { earn: vi.fn() },
  KEY_COST_USD: 2.49,
  STARTING_BALANCE: 2000,
  EconomyError: class EconomyError extends Error {},
}));

import { SkinInventory, InventoryError, SELL_FEE_RATE } from '../../../src/core/skin-inventory.js';
import { VirtualEconomy } from '../../../src/core/virtual-economy.js';

const ITEM = (overrides = {}) => ({
  weapon: 'AK-47', skin: 'Ice Coaled', item_id: 'ak47_icecoaled',
  image_url: 'https://example.com/ak47.png', market_price: 5.00, stattrak: false,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  SkinInventory.clearInventory();
  vi.clearAllMocks();
});

// ─── addItem ─────────────────────────────────────────────────────────────────

describe('SkinInventory — addItem', () => {
  it('test_si_addItem_returns_entry_with_instance_id_and_timestamp', () => {
    const before = Date.now();
    const entry = SkinInventory.addItem(ITEM());
    expect(typeof entry.instanceId).toBe('string');
    expect(entry.instanceId.length).toBeGreaterThan(0);
    expect(entry.acquiredAt).toBeGreaterThanOrEqual(before);
    expect(entry.item).toEqual(ITEM());
  });

  it('test_si_addItem_prepends_to_inventory_newest_first', () => {
    SkinInventory.addItem(ITEM({ item_id: 'first' }));
    SkinInventory.addItem(ITEM({ item_id: 'second' }));
    const items = SkinInventory.getItems();
    expect(items[0].item.item_id).toBe('second');
    expect(items[1].item.item_id).toBe('first');
  });

  it('test_si_addItem_increments_inventory_length', () => {
    SkinInventory.addItem(ITEM());
    SkinInventory.addItem(ITEM());
    SkinInventory.addItem(ITEM());
    expect(SkinInventory.getItems()).toHaveLength(3);
  });

  it('test_si_addItem_fires_skin_inventory_changed_event', () => {
    let detail = null;
    document.addEventListener('skin-inventory-changed', e => { detail = e.detail; }, { once: true });
    SkinInventory.addItem(ITEM());
    expect(detail).not.toBeNull();
    expect(Array.isArray(detail.inventory)).toBe(true);
    expect(detail.inventory).toHaveLength(1);
  });

  it('test_si_addItem_persists_to_localstorage', () => {
    const entry = SkinInventory.addItem(ITEM());
    const stored = JSON.parse(localStorage.getItem('vault_skin_inventory'));
    expect(stored).toHaveLength(1);
    expect(stored[0].instanceId).toBe(entry.instanceId);
  });
});

// ─── getItems / getItem / hasItem ─────────────────────────────────────────────

describe('SkinInventory — getItems / getItem / hasItem', () => {
  it('test_si_getItems_returns_shallow_copy', () => {
    SkinInventory.addItem(ITEM());
    const items = SkinInventory.getItems();
    items.push({ fake: true });
    expect(SkinInventory.getItems()).toHaveLength(1); // original unchanged
  });

  it('test_si_getItem_returns_entry_by_instance_id', () => {
    const added = SkinInventory.addItem(ITEM());
    const found = SkinInventory.getItem(added.instanceId);
    expect(found.instanceId).toBe(added.instanceId);
  });

  it('test_si_getItem_returns_null_for_unknown_instance_id', () => {
    expect(SkinInventory.getItem('nonexistent')).toBeNull();
  });

  it('test_si_hasItem_returns_true_for_existing_instance', () => {
    const entry = SkinInventory.addItem(ITEM());
    expect(SkinInventory.hasItem(entry.instanceId)).toBe(true);
  });

  it('test_si_hasItem_returns_false_for_unknown_instance', () => {
    expect(SkinInventory.hasItem('ghost-id')).toBe(false);
  });
});

// ─── sellItem ────────────────────────────────────────────────────────────────

describe('SkinInventory — sellItem', () => {
  it('test_si_sellItem_removes_entry_and_returns_true', () => {
    const entry = SkinInventory.addItem(ITEM());
    const result = SkinInventory.sellItem(entry.instanceId, 5.00);
    expect(result).toBe(true);
    expect(SkinInventory.hasItem(entry.instanceId)).toBe(false);
    expect(SkinInventory.getItems()).toHaveLength(0);
  });

  it('test_si_sellItem_calls_earn_with_15_percent_fee_applied', () => {
    const entry = SkinInventory.addItem(ITEM({ market_price: 10.00 }));
    SkinInventory.sellItem(entry.instanceId, 10.00);
    // 10.00 × 0.85 = 8.50
    expect(VirtualEconomy.earn).toHaveBeenCalledWith(8.50);
  });

  it('test_si_sellItem_rounds_net_proceeds_to_two_decimal_places', () => {
    // 7.777 × 0.85 = 6.61045 → 6.61
    const entry = SkinInventory.addItem(ITEM({ market_price: 7.777 }));
    SkinInventory.sellItem(entry.instanceId, 7.777);
    expect(VirtualEconomy.earn).toHaveBeenCalledWith(6.61);
  });

  it('test_si_sellItem_returns_false_for_unknown_instance_id', () => {
    const result = SkinInventory.sellItem('ghost-id', 5.00);
    expect(result).toBe(false);
    expect(VirtualEconomy.earn).not.toHaveBeenCalled();
  });

  it('test_si_sellItem_allows_zero_sale_price_removes_item_earns_nothing', () => {
    const entry = SkinInventory.addItem(ITEM());
    const ok = SkinInventory.sellItem(entry.instanceId, 0);
    expect(ok).toBe(true);
    expect(SkinInventory.hasItem(entry.instanceId)).toBe(false);
    // Earn is called with 0 * 0.85 = 0
    expect(VirtualEconomy.earn).toHaveBeenCalledWith(0);
  });

  it('test_si_sellItem_throws_inventory_error_for_negative_sale_price', () => {
    const entry = SkinInventory.addItem(ITEM());
    expect(() => SkinInventory.sellItem(entry.instanceId, -1)).toThrow(InventoryError);
  });

  it('test_si_sellItem_second_call_on_same_id_returns_false_no_double_earn', () => {
    const entry = SkinInventory.addItem(ITEM());
    SkinInventory.sellItem(entry.instanceId, 5.00);
    const secondResult = SkinInventory.sellItem(entry.instanceId, 5.00);
    expect(secondResult).toBe(false);
    expect(VirtualEconomy.earn).toHaveBeenCalledTimes(1); // not twice
  });

  it('test_si_sellItem_fires_skin_inventory_changed_event', () => {
    const entry = SkinInventory.addItem(ITEM());
    let detail = null;
    document.addEventListener('skin-inventory-changed', e => { detail = e.detail; }, { once: true });
    SkinInventory.sellItem(entry.instanceId, 5.00);
    expect(detail.inventory).toHaveLength(0);
  });

  it('test_si_sellItem_persists_removal_to_localstorage', () => {
    const entry = SkinInventory.addItem(ITEM());
    SkinInventory.sellItem(entry.instanceId, 5.00);
    const stored = JSON.parse(localStorage.getItem('vault_skin_inventory'));
    expect(stored).toHaveLength(0);
  });
});

// ─── clearInventory ──────────────────────────────────────────────────────────

describe('SkinInventory — clearInventory', () => {
  it('test_si_clearInventory_empties_the_array', () => {
    SkinInventory.addItem(ITEM());
    SkinInventory.addItem(ITEM());
    SkinInventory.clearInventory();
    expect(SkinInventory.getItems()).toHaveLength(0);
  });

  it('test_si_clearInventory_persists_empty_array', () => {
    SkinInventory.addItem(ITEM());
    SkinInventory.clearInventory();
    const stored = JSON.parse(localStorage.getItem('vault_skin_inventory'));
    expect(stored).toEqual([]);
  });

  it('test_si_clearInventory_fires_skin_inventory_changed_event', () => {
    let detail = null;
    document.addEventListener('skin-inventory-changed', e => { detail = e.detail; }, { once: true });
    SkinInventory.clearInventory();
    expect(detail.inventory).toEqual([]);
  });
});

// ─── Persistence — corrupt data ──────────────────────────────────────────────

describe('SkinInventory — corrupt localStorage', () => {
  it('test_si_loads_empty_array_when_localstorage_is_not_array', async () => {
    localStorage.setItem('vault_skin_inventory', '"not-an-array"');
    vi.resetModules();
    vi.mock('../../../src/core/virtual-economy.js', () => ({
      VirtualEconomy: { earn: vi.fn() },
      KEY_COST_USD: 2.49,
      STARTING_BALANCE: 2000,
      EconomyError: class extends Error {},
    }));
    const { SkinInventory: Fresh } = await import('../../../src/core/skin-inventory.js');
    expect(Fresh.getItems()).toEqual([]);
  });

  it('test_si_drops_entries_missing_instance_id_on_load', async () => {
    const corrupt = [{ acquiredAt: Date.now(), item: ITEM() }]; // no instanceId
    const valid   = [{ instanceId: 'valid-id', acquiredAt: Date.now(), item: ITEM() }];
    localStorage.setItem('vault_skin_inventory', JSON.stringify([...corrupt, ...valid]));
    vi.resetModules();
    vi.mock('../../../src/core/virtual-economy.js', () => ({
      VirtualEconomy: { earn: vi.fn() },
      KEY_COST_USD: 2.49,
      STARTING_BALANCE: 2000,
      EconomyError: class extends Error {},
    }));
    const { SkinInventory: Fresh } = await import('../../../src/core/skin-inventory.js');
    expect(Fresh.getItems()).toHaveLength(1);
    expect(Fresh.getItems()[0].instanceId).toBe('valid-id');
  });

  it('test_si_drops_duplicate_instance_ids_on_load', async () => {
    const dup1 = { instanceId: 'dup', acquiredAt: 1000, item: ITEM() };
    const dup2 = { instanceId: 'dup', acquiredAt: 2000, item: ITEM() };
    localStorage.setItem('vault_skin_inventory', JSON.stringify([dup1, dup2]));
    vi.resetModules();
    vi.mock('../../../src/core/virtual-economy.js', () => ({
      VirtualEconomy: { earn: vi.fn() },
      KEY_COST_USD: 2.49,
      STARTING_BALANCE: 2000,
      EconomyError: class extends Error {},
    }));
    const { SkinInventory: Fresh } = await import('../../../src/core/skin-inventory.js');
    expect(Fresh.getItems()).toHaveLength(1);
    expect(Fresh.getItems()[0].acquiredAt).toBe(1000); // first occurrence kept
  });
});

// ─── SELL_FEE_RATE constant ──────────────────────────────────────────────────

describe('SkinInventory — SELL_FEE_RATE', () => {
  it('test_si_sell_fee_rate_is_fifteen_percent', () => {
    expect(SELL_FEE_RATE).toBe(0.15);
  });
});
