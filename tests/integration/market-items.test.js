import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMusicKitPreviewId } from '../../src/foundation/music-kit-previews.js';

const data = JSON.parse(fs.readFileSync('public/data/market-items.json', 'utf8'));
const items = data.items ?? [];
const stickers = items.filter(item => item.capsuleType === 'sticker_capsule');
const musicKits = items.filter(item => item.capsuleType === 'music_kit_box');

describe('Standalone market catalogue', () => {
  it('contains every Cologne 2026 sticker exactly once', () => {
    expect(stickers).toHaveLength(1371);
    expect(new Set(stickers.map(item => item.market_hash_name)).size).toBe(1371);
    expect(stickers.every(item => item.market_hash_name.endsWith('| Cologne 2026'))).toBe(true);
  });

  it('contains every direct-market music kit in Normal and StatTrak variants', () => {
    expect(musicKits).toHaveLength(92);
    expect(new Set(musicKits.map(item => item.market_hash_name)).size).toBe(92);
    expect(musicKits.every(item => item.rarity === 'high_grade')).toBe(true);
    expect(musicKits.map(item => item.market_hash_name)).toEqual(expect.arrayContaining([
      'Music Kit | The Verkkars, EZ4ENCE',
      'StatTrak™ Music Kit | The Verkkars, EZ4ENCE',
      'Music Kit | ALRT, DOPAMINE HIT',
      'StatTrak™ Music Kit | ALRT, DOPAMINE HIT',
      'Music Kit | Starjunk 95, Industrial Sunset Memories',
      'StatTrak™ Music Kit | Starjunk 95, Industrial Sunset Memories',
    ]));
    expect(musicKits.find(item => item.id === 'music_kit-104')).toMatchObject({
      market_price: 4.99,
      price_basis: 'CS2 Store listing',
    });
    expect(musicKits.find(item => item.id === 'music_kit-104_st')).toMatchObject({
      market_price: 7.99,
      price_basis: 'CS2 Store listing',
    });
  });

  it('provides a playable preview for every direct-market music kit', () => {
    expect(musicKits.filter(item => !getMusicKitPreviewId(item.name))).toEqual([]);
  });

  it('contains complete market metadata and Steam prices', () => {
    expect(data.catalog.price_source).toContain('Steam Community Market');
    expect(items.every(item => item.id && item.image_url && item.rarity)).toBe(true);
    expect(items.every(item => item.market_price > 0)).toBe(true);
    expect(musicKits.every(item => item.market_price > 0)).toBe(true);
    expect(data.catalog.estimated_items).toBe(35);
  });

  it('uses only supported sticker rarities', () => {
    const supported = new Set(['high_grade', 'remarkable', 'exotic', 'extraordinary']);
    expect(items.every(item => supported.has(item.rarity))).toBe(true);
  });
});
