import { describe, it, expect } from 'vitest';
import { FloatService } from '../../../src/foundation/float-service.js';

// ─── getWearTier ──────────────────────────────────────────────────────────────

describe('FloatService — getWearTier', () => {
  it('test_float_service_getWearTier_0_is_fn', () => {
    expect(FloatService.getWearTier(0.00)).toBe('fn');
  });
  it('test_float_service_getWearTier_0_069_is_fn', () => {
    expect(FloatService.getWearTier(0.069)).toBe('fn');
  });
  it('test_float_service_getWearTier_0_07_is_mw', () => {
    expect(FloatService.getWearTier(0.07)).toBe('mw');
  });
  it('test_float_service_getWearTier_0_14_is_mw', () => {
    expect(FloatService.getWearTier(0.14)).toBe('mw');
  });
  it('test_float_service_getWearTier_0_15_is_ft', () => {
    expect(FloatService.getWearTier(0.15)).toBe('ft');
  });
  it('test_float_service_getWearTier_0_37_is_ft', () => {
    expect(FloatService.getWearTier(0.37)).toBe('ft');
  });
  it('test_float_service_getWearTier_0_38_is_ww', () => {
    expect(FloatService.getWearTier(0.38)).toBe('ww');
  });
  it('test_float_service_getWearTier_0_44_is_ww', () => {
    expect(FloatService.getWearTier(0.44)).toBe('ww');
  });
  it('test_float_service_getWearTier_0_45_is_bs', () => {
    expect(FloatService.getWearTier(0.45)).toBe('bs');
  });
  it('test_float_service_getWearTier_0_99_is_bs', () => {
    expect(FloatService.getWearTier(0.99)).toBe('bs');
  });
  it('test_float_service_getWearTier_1_is_bs', () => {
    expect(FloatService.getWearTier(1.00)).toBe('bs');
  });
});

// ─── getWearLabel ─────────────────────────────────────────────────────────────

describe('FloatService — getWearLabel', () => {
  it('test_float_service_getWearLabel_fn', () => {
    expect(FloatService.getWearLabel('fn')).toBe('FN');
  });
  it('test_float_service_getWearLabel_mw', () => {
    expect(FloatService.getWearLabel('mw')).toBe('MW');
  });
  it('test_float_service_getWearLabel_ft', () => {
    expect(FloatService.getWearLabel('ft')).toBe('FT');
  });
  it('test_float_service_getWearLabel_ww', () => {
    expect(FloatService.getWearLabel('ww')).toBe('WW');
  });
  it('test_float_service_getWearLabel_bs', () => {
    expect(FloatService.getWearLabel('bs')).toBe('BS');
  });
});

// ─── getPriceMultiplier ───────────────────────────────────────────────────────

describe('FloatService — getPriceMultiplier', () => {
  it('test_float_service_multiplier_at_0_is_3', () => {
    expect(FloatService.getPriceMultiplier(0)).toBe(3.0);
  });
  it('test_float_service_multiplier_at_fn_mw_boundary_is_1_8', () => {
    expect(FloatService.getPriceMultiplier(0.07)).toBeCloseTo(1.8, 5);
  });
  it('test_float_service_multiplier_at_mw_ft_boundary_is_1_2', () => {
    expect(FloatService.getPriceMultiplier(0.15)).toBeCloseTo(1.2, 5);
  });
  it('test_float_service_multiplier_at_ft_ww_boundary_is_0_85', () => {
    expect(FloatService.getPriceMultiplier(0.38)).toBeCloseTo(0.85, 5);
  });
  it('test_float_service_multiplier_at_ww_bs_boundary_is_0_6', () => {
    expect(FloatService.getPriceMultiplier(0.45)).toBeCloseTo(0.6, 5);
  });
  it('test_float_service_multiplier_at_1_is_0_3', () => {
    expect(FloatService.getPriceMultiplier(1.0)).toBeCloseTo(0.3, 5);
  });
  it('test_float_service_multiplier_decreases_as_float_increases', () => {
    expect(FloatService.getPriceMultiplier(0.03))
      .toBeGreaterThan(FloatService.getPriceMultiplier(0.25));
    expect(FloatService.getPriceMultiplier(0.25))
      .toBeGreaterThan(FloatService.getPriceMultiplier(0.70));
  });
  it('test_float_service_multiplier_midpoint_fn_interpolated', () => {
    // Midpoint of FN segment (0.035) should be between 3.0 and 1.8
    const m = FloatService.getPriceMultiplier(0.035);
    expect(m).toBeGreaterThan(1.8);
    expect(m).toBeLessThan(3.0);
  });
});

// ─── formatFloat ─────────────────────────────────────────────────────────────

describe('FloatService — formatFloat', () => {
  it('test_float_service_formatFloat_returns_exactly_17_decimal_places', () => {
    const formatted = FloatService.formatFloat(0.5);
    const decimals = formatted.split('.')[1];
    expect(decimals.length).toBe(17);
  });
  it('test_float_service_formatFloat_zero_is_all_zeros', () => {
    expect(FloatService.formatFloat(0)).toBe('0.00000000000000000');
  });
  it('test_float_service_formatFloat_preserves_precision', () => {
    const f = 0.12345678901234567;
    expect(FloatService.formatFloat(f)).toMatch(/^0\.\d{17}$/);
  });
});

// ─── generateFloatForTier ─────────────────────────────────────────────────────

describe('FloatService — generateFloatForTier', () => {
  it('test_float_service_generateFloatForTier_fn_result_in_fn_range', () => {
    const f = FloatService.generateFloatForTier('fn');
    expect(f).toBeGreaterThanOrEqual(0.00);
    expect(f).toBeLessThan(0.07);
  });
  it('test_float_service_generateFloatForTier_mw_result_in_mw_range', () => {
    const f = FloatService.generateFloatForTier('mw');
    expect(f).toBeGreaterThanOrEqual(0.07);
    expect(f).toBeLessThan(0.15);
  });
  it('test_float_service_generateFloatForTier_ft_result_in_ft_range', () => {
    const f = FloatService.generateFloatForTier('ft');
    expect(f).toBeGreaterThanOrEqual(0.15);
    expect(f).toBeLessThan(0.38);
  });
  it('test_float_service_generateFloatForTier_ww_result_in_ww_range', () => {
    const f = FloatService.generateFloatForTier('ww');
    expect(f).toBeGreaterThanOrEqual(0.38);
    expect(f).toBeLessThan(0.45);
  });
  it('test_float_service_generateFloatForTier_bs_result_in_bs_range', () => {
    const f = FloatService.generateFloatForTier('bs');
    expect(f).toBeGreaterThanOrEqual(0.45);
    expect(f).toBeLessThanOrEqual(1.00);
  });
  it('test_float_service_generateFloatForTier_is_deterministic_for_same_rng', () => {
    const rng = () => 0.5;
    expect(FloatService.generateFloatForTier('ft', rng))
      .toBe(FloatService.generateFloatForTier('ft', rng));
  });
  it('test_float_service_generateFloatForTier_unknown_tier_falls_back_to_generateFloat', () => {
    const f = FloatService.generateFloatForTier('invalid');
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(1);
  });
});

// ─── generateFloat ────────────────────────────────────────────────────────────

describe('FloatService — generateFloat', () => {
  it('test_float_service_generateFloat_uses_injected_rng_and_applies_bias', () => {
    // Bias exponent > 1 means output < input for any value in (0, 1)
    const result = FloatService.generateFloat(() => 0.5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.5);
  });
  it('test_float_service_generateFloat_default_in_0_to_1_range', () => {
    const f = FloatService.generateFloat();
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(1);
  });
  it('test_float_service_generateFloat_is_deterministic_for_same_rng', () => {
    const rng = () => 0.42;
    expect(FloatService.generateFloat(rng)).toBe(FloatService.generateFloat(rng));
  });
  it('test_float_service_generateFloat_bias_skews_toward_lower_floats', () => {
    // For u in (0,1), u^k < u when k > 1 — better (lower) floats become more likely
    const samples = Array.from({ length: 50 }, (_, i) => FloatService.generateFloat(() => (i + 1) / 51));
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    // Biased mean should be noticeably below the uniform mean of 0.5
    expect(mean).toBeLessThan(0.45);
  });
});
