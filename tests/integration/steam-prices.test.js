import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const caseData = JSON.parse(readFileSync('public/data/cases.json', 'utf8'));
const souvenirData = JSON.parse(readFileSync('public/data/souvenirs.json', 'utf8'));
const steamData = JSON.parse(readFileSync('public/data/steam-prices.json', 'utf8'));
const fallbackData = JSON.parse(readFileSync('design/reference/market-price-fallbacks.json', 'utf8'));

const WEARS = { fn: 'Factory New', mw: 'Minimal Wear', ft: 'Field-Tested', ww: 'Well-Worn', bs: 'Battle-Scarred' };

function hashName(item, group, wear) {
  const suffix = wear === 'vanilla' ? '' : ` (${WEARS[wear]})`;
  if (item.skin.startsWith('★')) {
    const finish = item.skin.slice(1).trim();
    if (finish.toLowerCase() === 'vanilla') {
      return group === 'stattrak' ? `★ StatTrak™ ${item.weapon}` : `★ ${item.weapon}`;
    }
    const prefix = group === 'stattrak' ? '★ StatTrak™ ' : '★ ';
    return `${prefix}${item.weapon} | ${finish}${suffix}`;
  }
  if (group === 'souvenir') return `Souvenir ${item.weapon} | ${item.skin}${suffix}`;
  const prefix = group === 'stattrak' ? 'StatTrak™ ' : '';
  return `${prefix}${item.weapon} | ${item.skin}${suffix}`;
}

function allItems(entries) {
  return entries.flatMap(entry => Object.values(entry.items ?? {}).flat());
}

describe('Steam price catalogue', () => {
  it('contains the full market snapshot and all case/terminal prices', () => {
    expect(Object.keys(steamData.prices).length).toBeGreaterThan(10000);
    for (const entry of caseData.cases) {
      expect(steamData.prices[entry.name]?.price, entry.name).toBe(entry.market_price);
    }
    expect(steamData.prices['Revolution Case'].price).toBe(0.29);
    expect(steamData.prices['★ Bayonet | Crimson Web (Field-Tested)'].price).toBe(270.41);
  });

  it('keeps every embedded exact variant synchronized with the canonical reference', () => {
    const items = [...allItems(caseData.cases), ...allItems(souvenirData.cases)];
    let variants = 0;
    for (const item of items) {
      for (const [group, prices] of Object.entries(item.market_prices ?? {})) {
        for (const [wear, price] of Object.entries(prices)) {
          const name = hashName(item, group, wear);
          const fallback = fallbackData.items[`${item.weapon} | ${item.skin}`]?.market_prices?.[group]?.[wear];
          expect(steamData.prices[name]?.price ?? fallback, name).toBe(price);
          variants++;
        }
      }
    }
    expect(variants).toBeGreaterThan(25000);
  });

  it('gives every case and souvenir item a complete usable price record', () => {
    const items = [...allItems(caseData.cases), ...allItems(souvenirData.cases)];
    expect(items.every(item => item.market_price > 0)).toBe(true);
    expect(items.every(item => Object.keys(item.market_prices ?? {}).length > 0)).toBe(true);
  });
});
