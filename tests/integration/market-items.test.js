import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const data = JSON.parse(fs.readFileSync('public/data/market-items.json', 'utf8'));
const items = data.items ?? [];

describe('Standalone market catalogue', () => {
  it('contains every Cologne 2026 sticker exactly once', () => {
    expect(items).toHaveLength(1371);
    expect(new Set(items.map(item => item.market_hash_name)).size).toBe(1371);
    expect(items.every(item => item.market_hash_name.endsWith('| Cologne 2026'))).toBe(true);
  });

  it('contains complete market metadata and Steam prices', () => {
    expect(data.catalog.price_source).toContain('Steam Community Market');
    expect(items.every(item => item.id && item.image_url && item.rarity)).toBe(true);
    expect(items.every(item => item.market_price === null || item.market_price > 0)).toBe(true);
  });

  it('uses only supported sticker rarities', () => {
    const supported = new Set(['high_grade', 'remarkable', 'exotic', 'extraordinary']);
    expect(items.every(item => supported.has(item.rarity))).toBe(true);
  });
});
