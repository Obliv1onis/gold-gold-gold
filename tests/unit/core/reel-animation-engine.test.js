import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: { getCase: vi.fn(), getItems: vi.fn() },
}));

import { ReelAnimationEngine, ReelError, CARD_WIDTH, SPIN_DURATION_MS } from '../../../src/core/reel-animation-engine.js';
import { CaseDataStore }                                                  from '../../../src/foundation/case-data-store.js';

// ─── RAF harness ─────────────────────────────────────────────────────────────
// Stubbed once for the whole file so pending callbacks survive between
// beforeEach and the test itself. We reset the queue in beforeEach.

let _rafQueue = [];
let _rafId    = 0;

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', cb => { _rafQueue.push(cb); return ++_rafId; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function advanceFrame(timestamp) {
  const pending = [..._rafQueue];
  _rafQueue = [];
  pending.forEach(cb => cb(timestamp));
}

function runFrames(endMs, stepMs = 100, startOffset = 0) {
  for (let t = startOffset + stepMs; t <= endMs; t += stepMs) advanceFrame(t);
}

// Drain any in-progress animation. May need multiple passes when startTime
// hasn't been set yet (spin started but no frames advanced). Each pass uses
// a strictly increasing timestamp so elapsed eventually exceeds SPIN_DURATION_MS.
function drainSpin() {
  for (let pass = 1; pass <= 3 && ReelAnimationEngine.getState() === 'spinning'; pass++) {
    const pending = [..._rafQueue];
    _rafQueue = [];
    pending.forEach(cb => cb(SPIN_DURATION_MS * pass * 2));
  }
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const POOL = Array.from({ length: 10 }, (_, i) => ({
  item_id: `item_${i}`, weapon: 'P250', skin: `Skin${i}`, stattrak: false,
}));
const SELECTED = { ...POOL[0], rarity: 'mil_spec' };
const VIEWPORT = 1280;

const CASE_ENTRY = {
  id: 'recoil_case',
  rarity_weights: { mil_spec: 79.92, restricted: 15.98, classified: 3.20, covert: 0.64, rare_special: 0.26 },
};

function setupPool() {
  CaseDataStore.getCase.mockReturnValue({ ...CASE_ENTRY });
  CaseDataStore.getItems.mockReturnValue([...POOL]);
}

const CALLBACKS = () => ({ onFrame: vi.fn(), onTick: vi.fn(), onComplete: vi.fn() });

beforeEach(() => {
  drainSpin();       // complete any animation left by the previous test
  _rafQueue = [];    // fresh queue for this test
  _rafId    = 0;
  vi.clearAllMocks();
  setupPool();
});

// ─── Strip construction ───────────────────────────────────────────────────────

describe('ReelAnimationEngine — strip construction', () => {
  it('test_rae_strip_has_length_60', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0); // first frame
    const [, strip] = cb.onFrame.mock.calls[0];
    expect(strip).toHaveLength(60);
  });

  it('test_rae_strip_selected_item_is_at_index_55', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    const [, strip] = cb.onFrame.mock.calls[0];
    expect(strip[55]).toBe(SELECTED);
  });

  it('test_rae_strip_all_positions_are_filled', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    const [, strip] = cb.onFrame.mock.calls[0];
    strip.forEach((item, i) => expect(item, `index ${i} should not be undefined`).toBeDefined());
  });

  it('test_rae_strip_same_reference_on_every_frame', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    advanceFrame(500);
    advanceFrame(1000);
    const strips = cb.onFrame.mock.calls.map(([, s]) => s);
    expect(strips[1]).toBe(strips[0]);
    expect(strips[2]).toBe(strips[0]);
  });
});

// ─── Animation progression ────────────────────────────────────────────────────

describe('ReelAnimationEngine — animation progression', () => {
  it('test_rae_offset_starts_at_zero_on_first_frame', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0); // startTime = 0, elapsed = 0
    const [offset] = cb.onFrame.mock.calls[0];
    expect(offset).toBe(0);
  });

  it('test_rae_offset_is_monotonically_non_decreasing', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    runFrames(8500, 100, 0);

    const offsets = cb.onFrame.mock.calls.map(([o]) => o);
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]).toBeGreaterThanOrEqual(offsets[i - 1]);
    }
  });

  it('test_rae_progress_clamps_at_1_for_timestamps_far_past_duration', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);     // startTime = 0
    advanceFrame(99999); // elapsed clamped → t = 1 → completes
    expect(cb.onComplete).toHaveBeenCalledTimes(1);
    expect(ReelAnimationEngine.getState()).toBe('idle');
  });

  it('test_rae_final_offset_greater_than_initial_offset', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    runFrames(8500, 100, 0);

    const offsets = cb.onFrame.mock.calls.map(([o]) => o);
    expect(offsets[offsets.length - 1]).toBeGreaterThan(offsets[0]);
  });
});

// ─── onComplete ──────────────────────────────────────────────────────────────

describe('ReelAnimationEngine — onComplete', () => {
  it('test_rae_onComplete_fires_exactly_once_per_spin', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    runFrames(8500, 100, 0);
    expect(cb.onComplete).toHaveBeenCalledTimes(1);
  });

  it('test_rae_state_is_idle_after_onComplete', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    runFrames(8500, 100, 0);
    expect(ReelAnimationEngine.getState()).toBe('idle');
  });

  it('test_rae_second_spin_accepted_after_onComplete', () => {
    const cb1 = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb1);
    advanceFrame(0);
    runFrames(8500, 100, 0);

    const cb2 = CALLBACKS();
    expect(() => ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb2)).not.toThrow();
    drainSpin(); // clean up
  });
});

// ─── onTick ──────────────────────────────────────────────────────────────────

describe('ReelAnimationEngine — onTick', () => {
  it('test_rae_onTick_fires_at_least_52_times_across_full_spin', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    runFrames(8500, 16, 0); // ~60fps simulation

    expect(cb.onTick.mock.calls.length).toBeGreaterThanOrEqual(52);
  });

  it('test_rae_onTick_pitch_is_always_in_valid_range', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0);
    runFrames(8500, 16, 0);

    for (const [pitch] of cb.onTick.mock.calls) {
      expect(pitch).toBeGreaterThanOrEqual(220);
      expect(pitch).toBeLessThanOrEqual(880);
    }
  });

  it('test_rae_onTick_fires_more_in_first_half_than_second_half', () => {
    let firstHalfTicks = 0;
    let secondHalfTicks = 0;
    let elapsed = 0;

    const cb = {
      onFrame: vi.fn(),
      onTick: vi.fn(() => {
        if (elapsed <= SPIN_DURATION_MS / 2) firstHalfTicks++;
        else secondHalfTicks++;
      }),
      onComplete: vi.fn(),
    };

    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0); // startTime = 0

    for (let t = 100; t <= 8500; t += 100) {
      elapsed = t;
      advanceFrame(t);
    }

    expect(firstHalfTicks).toBeGreaterThan(secondHalfTicks);
  });

  it('test_rae_no_tick_fires_on_frame_zero_when_offset_is_zero', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    advanceFrame(0); // elapsed=0 → offset=0 → no card boundary crossed
    expect(cb.onTick).not.toHaveBeenCalled();
  });
});

// ─── Error cases ─────────────────────────────────────────────────────────────

describe('ReelAnimationEngine — errors', () => {
  it('test_rae_spin_while_spinning_throws_reel_error', () => {
    const cb1 = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb1);
    advanceFrame(0); // animation in progress

    const cb2 = CALLBACKS();
    expect(() => ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb2))
      .toThrow(ReelError);
    expect(() => ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb2))
      .toThrow('Animation already in progress');
  });

  it('test_rae_spin_with_empty_item_pool_throws_reel_error', () => {
    CaseDataStore.getCase.mockReturnValue(null);
    expect(() => ReelAnimationEngine.spin('ghost_case', SELECTED, VIEWPORT, CALLBACKS()))
      .toThrow(ReelError);
    // State must remain idle — the throw happens before _state = 'spinning'
    expect(ReelAnimationEngine.getState()).toBe('idle');
  });

  it('test_rae_spin_error_does_not_fire_onComplete', () => {
    const cb = CALLBACKS();
    CaseDataStore.getCase.mockReturnValue(null);
    try { ReelAnimationEngine.spin('ghost_case', SELECTED, VIEWPORT, cb); } catch (_) {}
    expect(cb.onComplete).not.toHaveBeenCalled();
  });

  it('test_rae_zero_delta_frame_does_not_throw', () => {
    const cb = CALLBACKS();
    ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
    expect(() => {
      advanceFrame(0); // startTime=0, prevTime=0, frameDeltaMs=0
      advanceFrame(0); // frameDeltaMs still 0
    }).not.toThrow();
  });
});

// ─── stopOffset variance ─────────────────────────────────────────────────────

describe('ReelAnimationEngine — stopOffset variance', () => {
  it('test_rae_final_offsets_vary_across_spins', () => {
    const finalOffsets = [];

    for (let i = 0; i < 20; i++) {
      const cb = CALLBACKS();
      ReelAnimationEngine.spin('recoil_case', SELECTED, VIEWPORT, cb);
      advanceFrame(0);
      runFrames(8500, 200, 0);

      const frames = cb.onFrame.mock.calls;
      finalOffsets.push(Math.round(frames[frames.length - 1][0]));
    }

    const unique = new Set(finalOffsets);
    expect(unique.size).toBeGreaterThan(1);
  });
});
