import { beforeEach, describe, expect, it } from 'vitest';
import { SkinInventory } from '../../../src/core/skin-inventory.js';
import { MusicKitPlayer } from '../../../src/feature/music-kit-player.js';
import { InventoryUI } from '../../../src/presentation/inventory-ui.js';

beforeEach(() => {
  MusicKitPlayer.close();
  SkinInventory.clearInventory();
  document.body.innerHTML = '<div id="inventory"></div>';
});

describe('InventoryUI music-kit playback', () => {
  it('opens the preview modal when a direct-market music kit card is clicked', () => {
    SkinInventory.addItem({
      id: 'music_kit-98',
      name: 'Music Kit | ALRT, DOPAMINE HIT',
      market_hash_name: 'Music Kit | ALRT, DOPAMINE HIT',
      image_url: 'https://example.com/dopamine-hit.png',
      rarity: 'high_grade',
      market_price: 5.13,
      capsuleType: 'music_kit_box',
      isCapsuleItem: true,
    });
    InventoryUI.init(document.querySelector('#inventory'));
    InventoryUI.show();

    const card = document.querySelector('.music-kit-card');
    expect(card).not.toBeNull();
    card.querySelector('.card-image').click();

    const modal = document.querySelector('.music-kit-modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('iframe').src).toContain('/embed/fehhzTMUvQ0');
  });
});
