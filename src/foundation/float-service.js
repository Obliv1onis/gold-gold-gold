/**
 * CS2-style skin float generation and classification.
 *
 * Wear tiers (standard CS2 boundaries):
 *   FN  Factory New    [0.00, 0.07)  — dark green
 *   MW  Minimal Wear   [0.07, 0.15)  — light green
 *   FT  Field-Tested   [0.15, 0.38)  — yellow
 *   WW  Well-Worn      [0.38, 0.45)  — red
 *   BS  Battle-Scarred [0.45, 1.00]  — dark red
 *
 * Price multiplier follows a piecewise-linear curve: FN items command a
 * premium; BS items sell at a discount relative to the case's base market price.
 */

const WEAR_SEGMENTS = [
  { tier: 'fn', min: 0.00, max: 0.07, label: 'FN' },
  { tier: 'mw', min: 0.07, max: 0.15, label: 'MW' },
  { tier: 'ft', min: 0.15, max: 0.38, label: 'FT' },
  { tier: 'ww', min: 0.38, max: 0.45, label: 'WW' },
  { tier: 'bs', min: 0.45, max: 1.01, label: 'BS' }, // 1.01 cap catches f === 1.00
];

// Control points [float, multiplier] for piecewise-linear price curve.
const PRICE_CURVE = [
  [0.00, 3.00],
  [0.07, 1.80],
  [0.15, 1.20],
  [0.38, 0.85],
  [0.45, 0.60],
  [1.00, 0.30],
];

export const FloatService = {
  /**
   * Generates a random float in [0, 1) with float64 precision.
   * @param {function} [rng=Math.random] - injectable for deterministic tests
   * @returns {number}
   */
  generateFloat(rng = Math.random) {
    return rng();
  },

  /**
   * Returns the wear tier key for a given float value.
   * @param {number} f
   * @returns {'fn'|'mw'|'ft'|'ww'|'bs'}
   */
  getWearTier(f) {
    for (const seg of WEAR_SEGMENTS) {
      if (f >= seg.min && f < seg.max) return seg.tier;
    }
    return 'bs';
  },

  /**
   * Returns the short display label for a wear tier key.
   * @param {'fn'|'mw'|'ft'|'ww'|'bs'} tier
   * @returns {string}  e.g. 'FN'
   */
  getWearLabel(tier) {
    return WEAR_SEGMENTS.find(s => s.tier === tier)?.label ?? tier.toUpperCase();
  },

  /**
   * Price multiplier relative to the base market price, derived from the float.
   * Lower float → higher multiplier (FN premium); higher float → discount.
   * @param {number} f
   * @returns {number}
   */
  getPriceMultiplier(f) {
    for (let i = 0; i < PRICE_CURVE.length - 1; i++) {
      const [x0, y0] = PRICE_CURVE[i];
      const [x1, y1] = PRICE_CURVE[i + 1];
      if (f <= x1) {
        const t = (f - x0) / (x1 - x0);
        return y0 + t * (y1 - y0);
      }
    }
    return PRICE_CURVE[PRICE_CURVE.length - 1][1];
  },

  /**
   * Formats a float for display with exactly 17 decimal places.
   * @param {number} f
   * @returns {string}  e.g. '0.12345678901234567'
   */
  formatFloat(f) {
    return f.toFixed(17);
  },
};
