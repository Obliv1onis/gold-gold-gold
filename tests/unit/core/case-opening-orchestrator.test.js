import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/core/virtual-economy.js', () => ({
  VirtualEconomy: { canAfford: vi.fn(), spend: vi.fn(), getBalance: vi.fn() },
  KEY_COST_USD: 2.49,
}));
vi.mock('../../../src/core/case-inventory.js', () => ({
  CaseInventory: { hasCase: vi.fn(), removeCase: vi.fn() },
}));
vi.mock('../../../src/core/skin-inventory.js', () => ({
  SkinInventory: { addItem: vi.fn() },
}));
vi.mock('../../../src/core/drop-rate-engine.js', () => ({
  DropRateEngine: { roll: vi.fn() },
  RollError: class RollError extends Error { constructor(m) { super(m); this.name = 'RollError'; } },
}));
vi.mock('../../../src/core/reel-animation-engine.js', () => ({
  ReelAnimationEngine: { spin: vi.fn() },
}));
vi.mock('../../../src/core/audio-system.js', () => ({
  AudioSystem: { playTick: vi.fn(), playReveal: vi.fn() },
}));

import { CaseOpeningOrchestrator, CHORD_DECAY_MS } from '../../../src/core/case-opening-orchestrator.js';
import { VirtualEconomy }    from '../../../src/core/virtual-economy.js';
import { CaseInventory }     from '../../../src/core/case-inventory.js';
import { SkinInventory }     from '../../../src/core/skin-inventory.js';
import { DropRateEngine, RollError } from '../../../src/core/drop-rate-engine.js';
import { ReelAnimationEngine }       from '../../../src/core/reel-animation-engine.js';
import { AudioSystem }               from '../../../src/core/audio-system.js';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const CASE_ID       = 'recoil_case';
const CASE_PRICE    = 0.50;
const VIEWPORT      = 1280;
const TOTAL_COST    = 2.99; // 0.50 + 2.49

const SELECTED_ITEM = { item_id: 'ms_0', weapon: 'P250', skin: 'Sand Dune', stattrak: false };
const SKIN_ENTRY    = { instanceId: 'uuid-abc', item: SELECTED_ITEM, acquiredAt: Date.now() };

// Capture spin callbacks so tests can trigger onComplete manually
let _spinCallbacks = null;

function setupMocks() {
  CaseInventory.hasCase.mockReturnValue(true);
  CaseInventory.removeCase.mockReturnValue(true);
  VirtualEconomy.canAfford.mockReturnValue(true);
  VirtualEconomy.spend.mockReturnValue(true);
  DropRateEngine.roll.mockReturnValue(SELECTED_ITEM);
  SkinInventory.addItem.mockReturnValue(SKIN_ENTRY);
  ReelAnimationEngine.spin.mockImplementation((_caseId, _item, _vp, callbacks) => {
    _spinCallbacks = callbacks;
  });
}

function CALLBACKS() {
  return { onFrame: vi.fn(), onReveal: vi.fn(), onBlocked: vi.fn(), onReady: vi.fn() };
}

// Drain any in-progress open so the next test starts with isAnimating = false.
function drainOrchestrator() {
  if (CaseOpeningOrchestrator.isAnimating && _spinCallbacks) {
    _spinCallbacks.onComplete();
    vi.runAllTimers();
    _spinCallbacks = null;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  drainOrchestrator();
  _spinCallbacks = null;
  vi.clearAllMocks();
  setupMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Re-entry guard ───────────────────────────────────────────────────────────

describe('CaseOpeningOrchestrator — re-entry guard', () => {
  it('test_coo_open_while_animating_is_silent_noop', () => {
    const cb1 = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb1);
    expect(CaseOpeningOrchestrator.isAnimating).toBe(true);

    const cb2 = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb2);
    // second call must be ignored completely
    expect(cb2.onBlocked).not.toHaveBeenCalled();
    expect(cb2.onReveal).not.toHaveBeenCalled();
    expect(VirtualEconomy.spend).toHaveBeenCalledTimes(1); // only first call spent
  });

  it('test_coo_is_animating_is_true_after_spin_starts', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(CaseOpeningOrchestrator.isAnimating).toBe(true);
  });
});

// ─── Validation failures ──────────────────────────────────────────────────────

describe('CaseOpeningOrchestrator — validation failures', () => {
  it('test_coo_no_case_emits_blocked_no_case', () => {
    CaseInventory.hasCase.mockReturnValue(false);
    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);
    expect(cb.onBlocked).toHaveBeenCalledWith('no_case');
    expect(VirtualEconomy.spend).not.toHaveBeenCalled();
    expect(ReelAnimationEngine.spin).not.toHaveBeenCalled();
  });

  it('test_coo_no_case_does_not_set_is_animating', () => {
    CaseInventory.hasCase.mockReturnValue(false);
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(CaseOpeningOrchestrator.isAnimating).toBe(false);
  });

  it('test_coo_insufficient_funds_emits_blocked_insufficient_funds', () => {
    VirtualEconomy.canAfford.mockReturnValue(false);
    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);
    expect(cb.onBlocked).toHaveBeenCalledWith('insufficient_funds');
    expect(VirtualEconomy.spend).not.toHaveBeenCalled();
    expect(ReelAnimationEngine.spin).not.toHaveBeenCalled();
  });

  it('test_coo_insufficient_funds_does_not_consume_case', () => {
    VirtualEconomy.canAfford.mockReturnValue(false);
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(CaseInventory.removeCase).not.toHaveBeenCalled();
  });

  it('test_coo_roll_error_emits_blocked_roll_error', () => {
    DropRateEngine.roll.mockImplementation(() => { throw new RollError('Empty item pool'); });
    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);
    expect(cb.onBlocked).toHaveBeenCalledWith('roll_error');
  });

  it('test_coo_roll_error_leaves_balance_unchanged', () => {
    DropRateEngine.roll.mockImplementation(() => { throw new RollError('Empty item pool'); });
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(VirtualEconomy.spend).not.toHaveBeenCalled();
    expect(CaseInventory.removeCase).not.toHaveBeenCalled();
  });

  it('test_coo_roll_error_does_not_set_is_animating', () => {
    DropRateEngine.roll.mockImplementation(() => { throw new RollError('Empty item pool'); });
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(CaseOpeningOrchestrator.isAnimating).toBe(false);
  });
});

// ─── Happy-path call ordering ─────────────────────────────────────────────────

describe('CaseOpeningOrchestrator — call ordering', () => {
  it('test_coo_roll_called_before_spend', () => {
    const callOrder = [];
    DropRateEngine.roll.mockImplementation(() => { callOrder.push('roll'); return SELECTED_ITEM; });
    VirtualEconomy.spend.mockImplementation(() => { callOrder.push('spend'); });

    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(callOrder.indexOf('roll')).toBeLessThan(callOrder.indexOf('spend'));
  });

  it('test_coo_remove_case_called_after_spend', () => {
    const callOrder = [];
    VirtualEconomy.spend.mockImplementation(() => { callOrder.push('spend'); });
    CaseInventory.removeCase.mockImplementation(() => { callOrder.push('remove'); return true; });

    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(callOrder.indexOf('spend')).toBeLessThan(callOrder.indexOf('remove'));
  });

  it('test_coo_spend_amount_is_case_price_plus_key_cost', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(VirtualEconomy.spend).toHaveBeenCalledWith(TOTAL_COST);
  });

  it('test_coo_canAfford_amount_is_case_price_plus_key_cost', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    expect(VirtualEconomy.canAfford).toHaveBeenCalledWith(TOTAL_COST);
  });

  it('test_coo_spin_receives_selected_item_from_roll', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    const [, item] = ReelAnimationEngine.spin.mock.calls[0];
    // Item is spread from SELECTED_ITEM with float fields added
    expect(item).toMatchObject(SELECTED_ITEM);
    expect(typeof item.float).toBe('number');
    expect(typeof item.wear_tier).toBe('string');
  });

  it('test_coo_spin_receives_correct_viewport_width', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    const [,, vp] = ReelAnimationEngine.spin.mock.calls[0];
    expect(vp).toBe(VIEWPORT);
  });
});

// ─── onComplete sequence ──────────────────────────────────────────────────────

describe('CaseOpeningOrchestrator — onComplete sequence', () => {
  it('test_coo_play_reveal_called_before_add_item', () => {
    const callOrder = [];
    AudioSystem.playReveal.mockImplementation(() => { callOrder.push('reveal'); });
    SkinInventory.addItem.mockImplementation(() => { callOrder.push('addItem'); return SKIN_ENTRY; });

    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    _spinCallbacks.onComplete();

    expect(callOrder.indexOf('reveal')).toBeLessThan(callOrder.indexOf('addItem'));
  });

  it('test_coo_on_reveal_fires_with_skin_entry', () => {
    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);
    _spinCallbacks.onComplete();
    expect(cb.onReveal).toHaveBeenCalledWith(SKIN_ENTRY);
  });

  it('test_coo_add_item_called_with_item_containing_float_fields', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    _spinCallbacks.onComplete();
    const [calledItem] = SkinInventory.addItem.mock.calls[0];
    expect(calledItem).toMatchObject(SELECTED_ITEM);
    expect(typeof calledItem.float).toBe('number');
    expect(typeof calledItem.wear_tier).toBe('string');
  });

  it('test_coo_add_item_called_with_stat_trak_boolean', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    _spinCallbacks.onComplete();
    const [calledItem] = SkinInventory.addItem.mock.calls[0];
    expect(typeof calledItem.stat_trak).toBe('boolean');
  });

  it('test_coo_add_item_called_with_case_id', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    _spinCallbacks.onComplete();
    const [calledItem] = SkinInventory.addItem.mock.calls[0];
    expect(calledItem.case_id).toBe(CASE_ID);
  });

  it('test_coo_is_animating_true_immediately_after_on_complete', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    _spinCallbacks.onComplete();
    // CHORD_DECAY_MS has not elapsed yet
    expect(CaseOpeningOrchestrator.isAnimating).toBe(true);
  });

  it('test_coo_is_animating_false_after_chord_decay_ms', () => {
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, CALLBACKS());
    _spinCallbacks.onComplete();
    vi.advanceTimersByTime(CHORD_DECAY_MS);
    expect(CaseOpeningOrchestrator.isAnimating).toBe(false);
  });

  it('test_coo_on_ready_fires_after_chord_decay_ms', () => {
    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);
    _spinCallbacks.onComplete();
    expect(cb.onReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CHORD_DECAY_MS);
    expect(cb.onReady).toHaveBeenCalledTimes(1);
  });
});

// ─── Error recovery (E6) ──────────────────────────────────────────────────────

describe('CaseOpeningOrchestrator — error recovery', () => {
  it('test_coo_add_item_throws_still_fires_on_ready', () => {
    SkinInventory.addItem.mockImplementation(() => { throw new Error('corrupt state'); });
    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);
    _spinCallbacks.onComplete();
    vi.advanceTimersByTime(CHORD_DECAY_MS);
    expect(cb.onReady).toHaveBeenCalledTimes(1);
    expect(CaseOpeningOrchestrator.isAnimating).toBe(false);
  });

  it('test_coo_add_item_throws_does_not_fire_on_reveal', () => {
    SkinInventory.addItem.mockImplementation(() => { throw new Error('corrupt state'); });
    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);
    _spinCallbacks.onComplete();
    expect(cb.onReveal).not.toHaveBeenCalled();
  });
});

// ─── Re-enable after complete ─────────────────────────────────────────────────

describe('CaseOpeningOrchestrator — re-enable', () => {
  it('test_coo_second_open_accepted_after_on_ready', () => {
    const cb1 = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb1);
    _spinCallbacks.onComplete();
    vi.advanceTimersByTime(CHORD_DECAY_MS);

    // Re-arm mocks for the second open
    _spinCallbacks = null;
    setupMocks();

    const cb2 = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb2);
    // Both opens went through — spin called once per open = 2 total
    expect(ReelAnimationEngine.spin).toHaveBeenCalledTimes(2);
    expect(CaseOpeningOrchestrator.isAnimating).toBe(true);
  });
});

// ─── Full end-to-end ──────────────────────────────────────────────────────────

describe('CaseOpeningOrchestrator — end-to-end', () => {
  it('test_coo_full_open_loop_idle_reveal_ready', () => {
    expect(CaseOpeningOrchestrator.isAnimating).toBe(false);

    const cb = CALLBACKS();
    CaseOpeningOrchestrator.open(CASE_ID, CASE_PRICE, VIEWPORT, cb);

    // Mid-spin state
    expect(CaseOpeningOrchestrator.isAnimating).toBe(true);
    expect(cb.onReveal).not.toHaveBeenCalled();

    // Animation completes
    _spinCallbacks.onComplete();
    expect(cb.onReveal).toHaveBeenCalledWith(SKIN_ENTRY);
    expect(CaseOpeningOrchestrator.isAnimating).toBe(true); // chord still decaying

    // Chord decays
    vi.advanceTimersByTime(CHORD_DECAY_MS);
    expect(CaseOpeningOrchestrator.isAnimating).toBe(false);
    expect(cb.onReady).toHaveBeenCalledTimes(1);

    // onReveal carries the correct item
    const [entry] = cb.onReveal.mock.calls[0];
    expect(entry.item).toBe(SELECTED_ITEM);
  });
});
