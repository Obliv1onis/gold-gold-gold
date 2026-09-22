import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const { cases, catalog } = JSON.parse(readFileSync('public/data/cases.json', 'utf8'));
const byId = new Map(cases.map(entry => [entry.id, entry]));
const itemNames = entry => Object.values(entry.items)
  .flat()
  .map(item => `${item.weapon} | ${item.skin.replace(/^★\s*/, '')}`);

describe('case catalogue', () => {
  it('contains the complete current case and terminal set', () => {
    expect(cases.filter(entry => entry.type === 'weapon_case')).toHaveLength(42);
    expect(cases.filter(entry => entry.type === 'terminal')).toHaveLength(2);
    expect(catalog).toMatchObject({ weapon_cases: 42, terminals: 2 });
  });

  it('includes Gallery Case with its full normal and rare pools', () => {
    const gallery = byId.get('gallery_case');
    expect(gallery).toBeTruthy();
    expect(itemNames(gallery)).toContain('M4A1-S | Vaporwave');
    expect(itemNames(gallery)).toContain('Glock-18 | Gold Toof');
    expect(gallery.items.rare_special).toHaveLength(13);
  });

  it('includes all Dead Hand weapon finishes and gloves', () => {
    const deadHand = byId.get('terminal_dead_hand');
    expect(itemNames(deadHand)).toContain('Glock-18 | Fully Tuned');
    expect(itemNames(deadHand)).toContain("AWP | Queen's Gambit");
    expect(deadHand.items.rare_special).toHaveLength(22);
    expect(deadHand.rarity_weights.rare_special).toBe(0.26);
  });

  it('includes the complete restored rare-special knife pools', () => {
    const dreams = byId.get('dreams_nightmares_case');
    const riptide = byId.get('operation_riptide_case');
    const fracture = byId.get('fracture_case');
    const shatteredWeb = byId.get('shattered_web_case');

    expect(itemNames(dreams)).toContain('Butterfly Knife | Bright Water');
    expect(itemNames(dreams)).toContain('Bowie Knife | Gamma Doppler');
    expect(dreams.items.rare_special).toHaveLength(30);
    expect(riptide.items.rare_special).toHaveLength(30);
    expect(fracture.items.rare_special).toHaveLength(52);
    expect(shatteredWeb.items.rare_special).toHaveLength(52);
  });

  it('has unique container ids and valid rarity totals', () => {
    expect(new Set(cases.map(entry => entry.id)).size).toBe(cases.length);
    for (const entry of cases) {
      const total = Object.values(entry.rarity_weights).reduce((sum, weight) => sum + weight, 0);
      expect(total).toBeCloseTo(100, 2);
    }
  });
});
