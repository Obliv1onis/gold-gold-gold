import { describe, it, expect, beforeEach, vi } from 'vitest';

// Re-import the module fresh for each init test by resetting the module cache.
// Runtime tests call reset() in beforeEach to get a known starting state.

beforeEach(() => {
  localStorage.clear();
});

// ─── Initialization ──────────────────────────────────────────────────────────

describe('VirtualEconomy — initialization', () => {
  it('test_ve_init_defaults_to_2000_when_no_saved_balance', async () => {
    // Arrange — localStorage is clear (beforeEach)
    vi.resetModules();
    const { VirtualEconomy } = await import('../../../src/core/virtual-economy.js');
    expect(VirtualEconomy.getBalance()).toBe(2000.00);
  });

  it('test_ve_init_loads_persisted_balance', async () => {
    // Arrange
    localStorage.setItem('vault_balance', '1234.56');
    vi.resetModules();
    const { VirtualEconomy } = await import('../../../src/core/virtual-economy.js');
    expect(VirtualEconomy.getBalance()).toBe(1234.56);
  });

  it('test_ve_init_falls_back_to_2000_for_corrupt_balance', async () => {
    // Arrange
    localStorage.setItem('vault_balance', '"notanumber"');
    vi.resetModules();
    const { VirtualEconomy } = await import('../../../src/core/virtual-economy.js');
    expect(VirtualEconomy.getBalance()).toBe(2000.00);
  });

  it('test_ve_init_clamps_negative_balance_to_zero', async () => {
    // Arrange
    localStorage.setItem('vault_balance', '-500');
    vi.resetModules();
    const { VirtualEconomy } = await import('../../../src/core/virtual-economy.js');
    expect(VirtualEconomy.getBalance()).toBe(0);
  });

  it('test_ve_init_clamps_absurdly_large_balance_to_sanity_ceiling', async () => {
    // Arrange
    localStorage.setItem('vault_balance', '99999999');
    vi.resetModules();
    const { VirtualEconomy } = await import('../../../src/core/virtual-economy.js');
    expect(VirtualEconomy.getBalance()).toBe(9_999_999);
  });
});

// ─── Runtime behavior ────────────────────────────────────────────────────────
// All tests below call reset() to start from $2000.

describe('VirtualEconomy — spend', () => {
  let VirtualEconomy;

  beforeEach(async () => {
    vi.resetModules();
    ({ VirtualEconomy } = await import('../../../src/core/virtual-economy.js'));
  });

  it('test_ve_spend_deducts_amount_and_returns_true', () => {
    const result = VirtualEconomy.spend(2.49);
    expect(result).toBe(true);
    expect(VirtualEconomy.getBalance()).toBe(1997.51);
  });

  it('test_ve_spend_rounds_result_to_two_decimal_places', () => {
    VirtualEconomy.spend(2.49);
    // 2000.00 - 2.49 = 1997.51 (not 1997.5099...)
    expect(VirtualEconomy.getBalance()).toBe(1997.51);
  });

  it('test_ve_spend_persists_rounded_value_to_localstorage', () => {
    VirtualEconomy.spend(2.49);
    expect(localStorage.getItem('vault_balance')).toBe('1997.51');
  });

  it('test_ve_spend_returns_false_and_no_mutation_when_insufficient', () => {
    const balanceBefore = VirtualEconomy.getBalance();
    const result = VirtualEconomy.spend(9999);
    expect(result).toBe(false);
    expect(VirtualEconomy.getBalance()).toBe(balanceBefore);
  });

  it('test_ve_spend_succeeds_at_exact_balance_boundary', () => {
    VirtualEconomy.spend(2000.00);
    expect(VirtualEconomy.spend(0.01)).toBe(false); // balance is 0 now
    // Go fresh at 2.49
    vi.resetModules();
    // Instead test: spend exact balance
    expect(VirtualEconomy.getBalance()).toBe(0);
  });

  it('test_ve_spend_exact_amount_leaves_zero_balance', () => {
    // Start at 2000, spend 2000
    const result = VirtualEconomy.spend(2000.00);
    expect(result).toBe(true);
    expect(VirtualEconomy.getBalance()).toBe(0.00);
  });

  it('test_ve_spend_throws_economy_error_for_zero_amount', async () => {
    const { EconomyError } = await import('../../../src/core/virtual-economy.js');
    expect(() => VirtualEconomy.spend(0)).toThrow(EconomyError);
    expect(() => VirtualEconomy.spend(0)).toThrow('amount must be positive');
  });

  it('test_ve_spend_throws_economy_error_for_negative_amount', async () => {
    const { EconomyError } = await import('../../../src/core/virtual-economy.js');
    expect(() => VirtualEconomy.spend(-1)).toThrow(EconomyError);
  });

  it('test_ve_spend_fires_balance_changed_event_on_success', () => {
    let received = null;
    document.addEventListener('balance-changed', e => { received = e.detail; }, { once: true });
    VirtualEconomy.spend(100);
    expect(received).toEqual({ balance: VirtualEconomy.getBalance() });
  });

  it('test_ve_spend_does_not_fire_event_on_failure', () => {
    let fired = false;
    document.addEventListener('balance-changed', () => { fired = true; }, { once: true });
    VirtualEconomy.spend(99999); // will fail
    expect(fired).toBe(false);
    // clean up listener
    document.removeEventListener('balance-changed', () => {});
  });
});

describe('VirtualEconomy — earn', () => {
  let VirtualEconomy;

  beforeEach(async () => {
    vi.resetModules();
    ({ VirtualEconomy } = await import('../../../src/core/virtual-economy.js'));
  });

  it('test_ve_earn_adds_amount_to_balance', () => {
    VirtualEconomy.earn(500);
    expect(VirtualEconomy.getBalance()).toBe(2500.00);
  });

  it('test_ve_earn_can_exceed_starting_balance', () => {
    VirtualEconomy.earn(5000);
    expect(VirtualEconomy.getBalance()).toBe(7000.00);
  });

  it('test_ve_earn_from_zero_balance_succeeds', async () => {
    VirtualEconomy.spend(2000);
    expect(VirtualEconomy.getBalance()).toBe(0.00);
    VirtualEconomy.earn(1.50);
    expect(VirtualEconomy.getBalance()).toBe(1.50);
  });

  it('test_ve_earn_throws_economy_error_for_negative_amount', async () => {
    const { EconomyError } = await import('../../../src/core/virtual-economy.js');
    expect(() => VirtualEconomy.earn(-1)).toThrow(EconomyError);
    expect(() => VirtualEconomy.earn(-1)).toThrow('amount must be positive');
  });

  it('test_ve_earn_fires_balance_changed_event', () => {
    let received = null;
    document.addEventListener('balance-changed', e => { received = e.detail; }, { once: true });
    VirtualEconomy.earn(100);
    expect(received).toEqual({ balance: 2100.00 });
  });
});

describe('VirtualEconomy — canAfford', () => {
  let VirtualEconomy;

  beforeEach(async () => {
    vi.resetModules();
    ({ VirtualEconomy } = await import('../../../src/core/virtual-economy.js'));
  });

  it('test_ve_canAfford_returns_true_when_balance_sufficient', () => {
    expect(VirtualEconomy.canAfford(100)).toBe(true);
  });

  it('test_ve_canAfford_returns_false_when_balance_insufficient', () => {
    expect(VirtualEconomy.canAfford(9999)).toBe(false);
  });

  it('test_ve_canAfford_zero_always_returns_true', () => {
    expect(VirtualEconomy.canAfford(0)).toBe(true);
  });

  it('test_ve_canAfford_exact_balance_returns_true', () => {
    expect(VirtualEconomy.canAfford(2000.00)).toBe(true);
  });
});

describe('VirtualEconomy — reset', () => {
  let VirtualEconomy;

  beforeEach(async () => {
    vi.resetModules();
    ({ VirtualEconomy } = await import('../../../src/core/virtual-economy.js'));
  });

  it('test_ve_reset_restores_balance_to_2000', () => {
    VirtualEconomy.spend(500);
    VirtualEconomy.reset();
    expect(VirtualEconomy.getBalance()).toBe(2000.00);
  });

  it('test_ve_reset_works_when_balance_is_above_starting', () => {
    VirtualEconomy.earn(5000);
    VirtualEconomy.reset();
    expect(VirtualEconomy.getBalance()).toBe(2000.00);
  });

  it('test_ve_reset_persists_new_balance', () => {
    VirtualEconomy.spend(500);
    VirtualEconomy.reset();
    expect(localStorage.getItem('vault_balance')).toBe('2000');
  });

  it('test_ve_reset_fires_balance_changed_event', () => {
    let received = null;
    document.addEventListener('balance-changed', e => { received = e.detail; }, { once: true });
    VirtualEconomy.reset();
    expect(received).toEqual({ balance: 2000.00 });
  });
});
