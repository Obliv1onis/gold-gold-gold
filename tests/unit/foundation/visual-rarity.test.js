import { describe, expect, it } from 'vitest';
import { visualRarity } from '../../../src/foundation/visual-rarity.js';

describe('visualRarity', () => {
  it('shows Gold-named stickers in red without rewriting their official rarity', () => {
    const sticker = {
      name: 'Last Vance (Gold)',
      capsuleType: 'sticker_capsule',
      rarity: 'exotic',
    };
    expect(visualRarity(sticker)).toBe('extraordinary');
    expect(sticker.rarity).toBe('exotic');
  });

  it('does not recolour Gold-named patches', () => {
    expect(visualRarity({
      name: 'Natus Vincere (Gold) | Stockholm 2021',
      capsuleType: 'patch_pack',
      rarity: 'remarkable',
    })).toBe('remarkable');
  });

  it('keeps M4A4 Howl Contraband gold', () => {
    expect(visualRarity({ weapon: 'M4A4', skin: 'Howl', rarity: 'contraband' })).toBe('contraband');
  });
});
