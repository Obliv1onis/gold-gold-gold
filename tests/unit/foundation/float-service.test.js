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

// ─── generateFloat ────────────────────────────────────────────────────────────

describe('FloatService — generateFloat', () => {
  it('test_float_service_generateFloat_uses_injected_rng', () => {
    expect(FloatService.generateFloat(() => 0.5)).toBe(0.5);
  });
  it('test_float_service_generateFloat_default_in_0_to_1_range', () => {
    const f = FloatService.generateFloat();
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(1);
  });
  it('test_float_service_generateFloat_returns_rng_value_directly', () => {
    const value = 0.123456789;
    expect(FloatService.generateFloat(() => value)).toBe(value);
  });
});
