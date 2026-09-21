import { describe, expect, it } from 'vitest';
import { getCatalogMarketPrice } from '../../../src/foundation/market-price.js';

const item = {
  market_prices: {
    normal: { fn: 12.34, ft: 5.67 },
    stattrak: { fn: 25.5 },
    souvenir: { ft: 40 },
  },
};

describe('getCatalogMarketPrice', () => {
  it('selects exact normal, StatTrak, and souvenir variants', () => {
    expect(getCatalogMarketPrice(item, 'fn')).toBe(12.34);
    expect(getCatalogMarketPrice(item, 'fn', { statTrak: true })).toBe(25.5);
    expect(getCatalogMarketPrice(item, 'ft', { souvenir: true })).toBe(40);
  });

  it('returns null instead of inventing a price for a missing variant', () => {
    expect(getCatalogMarketPrice(item, 'bs', { statTrak: true })).toBeNull();
  });
});
