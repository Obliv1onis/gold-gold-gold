import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const armoryData = JSON.parse(readFileSync('public/data/armory.json', 'utf8'));
const caseData = JSON.parse(readFileSync('public/data/cases.json', 'utf8'));
const entries = armoryData.cases;

describe('Armory catalogue', () => {
  it('contains every historical weapon collection and limited edition', () => {
    expect(entries.filter(entry => entry.type === 'armory_collection')).toHaveLength(6);
    expect(entries.filter(entry => entry.type === 'armory_limited')).toHaveLength(4);
    expect(armoryData.catalog).toMatchObject({ collections: 6, limited_editions: 4, weapon_cases: 2, items: 102 });
  });

  it('keeps each Armory generation separate and complete', () => {
    const counts = new Map(entries.map(entry => [entry.name, Object.values(entry.items).flat().length]));
    expect(counts.get('The Graphic Design Collection')).toBe(16);
    expect(counts.get('The Overpass 2024 Collection')).toBe(16);
    expect(counts.get('The Sport & Field Collection')).toBe(16);
    expect(counts.get('The Train 2025 Collection')).toBe(16);
    expect(counts.get('The Spy Tech Collection')).toBe(17);
    expect(counts.get('The Arabesque Collection')).toBe(17);
  });

  it('uses the Armory Pass artwork and Steam-priced item variants', () => {
    for (const entry of entries) {
      expect(entry.image_url).toBe('/assets/armory-pass.webp');
      for (const item of Object.values(entry.items).flat()) {
        expect(item.market_price, item.item_id).toBeGreaterThan(0);
        expect(Object.keys(item.market_prices?.normal ?? {}).length, item.item_id).toBeGreaterThan(0);
      }
    }
  });

  it('marks Gallery and Fever as historical Armory cases', () => {
    const armoryCases = caseData.cases.filter(entry => entry.armory);
    expect(armoryCases.map(entry => entry.id).sort()).toEqual(['fever_case', 'gallery_case']);
    expect(armoryCases.every(entry => entry.armory_image_url === '/assets/armory-pass.webp')).toBe(true);
  });
});
