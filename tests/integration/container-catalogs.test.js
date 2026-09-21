import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readCatalogue = (file, key) => {
  const data = JSON.parse(readFileSync(`public/data/${file}.json`, 'utf8'));
  return { entries: data[key], catalog: data.catalog };
};

const capsules = readCatalogue('capsules', 'capsules');
const souvenirs = readCatalogue('souvenirs', 'cases');
const others = readCatalogue('others', 'capsules');
const allContainers = [...capsules.entries, ...souvenirs.entries, ...others.entries];
const byName = new Map(allContainers.map(entry => [entry.name, entry]));
const itemCount = entry => Object.values(entry.tiers ?? entry.items ?? {}).flat().length;

describe('secondary container catalogues', () => {
  it('contains the current audited container totals', () => {
    expect(capsules.entries).toHaveLength(122);
    expect(souvenirs.entries).toHaveLength(150);
    expect(others.entries).toHaveLength(26);
    expect(capsules.catalog).toMatchObject({ containers: 122, items: 7422, missing_images: 0 });
    expect(souvenirs.catalog).toMatchObject({ containers: 150, missing_images: 0 });
    expect(others.catalog).toMatchObject({ containers: 26, missing_images: 0 });
  });

  it('includes recent sticker capsules with complete item pools', () => {
    expect(itemCount(byName.get('Jackass Sticker Capsule'))).toBe(39);
    expect(itemCount(byName.get('Warhammer 40,000 Xenos Sticker Capsule'))).toBeGreaterThan(0);
    expect(itemCount(byName.get('Warhammer 40,000 Imperium Sticker Capsule'))).toBeGreaterThan(0);
    expect(itemCount(byName.get('Warhammer 40,000 Adeptus Astartes Sticker Capsule'))).toBeGreaterThan(0);
    expect(itemCount(byName.get('Warhammer 40,000 Traitor Astartes Sticker Capsule'))).toBeGreaterThan(0);
  });

  it('contains all seven Budapest 2025 souvenir map packages', () => {
    const maps = ['Inferno', 'Mirage', 'Overpass', 'Dust II', 'Ancient', 'Nuke', 'Train'];
    for (const map of maps) {
      const entry = byName.get(`Budapest 2025 ${map} Souvenir Package`);
      expect(entry, map).toBeTruthy();
      expect(itemCount(entry), map).toBeGreaterThan(0);
    }
  });

  it('includes the missing music, pin, and patch containers', () => {
    for (const name of [
      'Masterminds 2 Music Kit Box',
      'StatTrak™ Masterminds 2 Music Kit Box',
      'Half-Life: Alyx Collectible Pins Capsule',
      'Stockholm 2021 Legends Patch Pack',
      'Stockholm 2021 Challengers Patch Pack',
      'Stockholm 2021 Contenders Patch Pack',
    ]) {
      expect(byName.get(name), name).toBeTruthy();
    }
  });

  it('gives every music kit variant a playable preview', () => {
    const kits = others.entries
      .filter(entry => entry.type === 'music_kit_box')
      .flatMap(entry => Object.values(entry.tiers).flat());
    expect(kits).toHaveLength(93);
    expect(kits.filter(item => !item.youtube_id)).toEqual([]);
  });

  it('does not model Cologne 2026 as legacy random containers', () => {
    expect(allContainers.some(entry => /Cologne 2026/i.test(entry.name))).toBe(false);
  });

  it('has unique ids and valid weighted pools', () => {
    const capsuleStyle = [...capsules.entries, ...others.entries];
    expect(new Set(capsuleStyle.map(entry => entry.id)).size).toBe(capsuleStyle.length);

    for (const entry of allContainers) {
      const total = Object.values(entry.rarity_weights).reduce((sum, weight) => sum + weight, 0);
      expect(total, entry.name).toBeCloseTo(100, 2);
      const pools = entry.tiers ?? entry.items;
      for (const [tier, weight] of Object.entries(entry.rarity_weights)) {
        if (weight > 0) expect(pools[tier]?.length, `${entry.name}: ${tier}`).toBeGreaterThan(0);
      }
    }
  });
});
