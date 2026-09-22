import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/foundation/capsule-data-store.js', () => ({
  CapsuleDataStore: { getCapsule: vi.fn() },
}));

import { CapsuleDataStore } from '../../../src/foundation/capsule-data-store.js';
import { CapsuleReelUI } from '../../../src/presentation/capsule-reel-ui.js';
import { i18n } from '../../../src/foundation/i18n.js';

const ITEMS = {
  high_grade: [{ name: 'Blue', market_hash_name: 'Sticker | Blue', image_url: 'blue.png' }],
  remarkable: [{ name: 'Purple', market_hash_name: 'Sticker | Purple', image_url: 'purple.png' }],
  exotic: [{ name: 'Pink', market_hash_name: 'Sticker | Pink', image_url: 'pink.png' }],
  extraordinary: [{ name: 'Red', market_hash_name: 'Sticker | Red', image_url: 'red.png' }],
};

function makeContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

beforeEach(() => {
  i18n.setLocale('en-US');
  vi.useRealTimers();
  vi.clearAllMocks();
  CapsuleDataStore.getCapsule.mockReturnValue({
    id: 'test_capsule',
    name: 'Test Capsule',
    type: 'sticker_capsule',
    image_url: 'capsule.png',
    rarity_weights: { high_grade: 100 },
    tiers: ITEMS,
  });
});

describe('CapsuleReelUI preview flow', () => {
  it('shows the container and contents preview before the reel', () => {
    const container = makeContainer();
    CapsuleReelUI.initialize(container, 'test_capsule');

    expect(container.querySelector('.case-opening-hero__title').textContent).toBe('Test Capsule');
    expect(container.querySelectorAll('.case-content-card')).toHaveLength(4);
    expect(container.querySelector('.reel-roll-stage').getAttribute('aria-hidden')).toBe('true');
    expect(container.classList.contains('is-roll-mode')).toBe(false);
    container.remove();
  });

  it('orders preview contents from low to high rarity', () => {
    const container = makeContainer();
    CapsuleReelUI.initialize(container, 'test_capsule');

    const rarities = [...container.querySelectorAll('.case-content-card')]
      .map(card => [...card.classList].find(name => name.startsWith('rarity-')));
    expect(rarities).toEqual([
      'rarity-high_grade',
      'rarity-remarkable',
      'rarity-exotic',
      'rarity-extraordinary',
    ]);
    container.remove();
  });

  it('transitions to the centered roll stage and returns to preview', async () => {
    vi.useFakeTimers();
    const container = makeContainer();
    CapsuleReelUI.initialize(container, 'test_capsule');

    const transition = CapsuleReelUI.transitionToRoll();
    await Promise.resolve();
    await Promise.resolve();
    expect(container.classList.contains('is-roll-mode')).toBe(true);
    expect(container.querySelector('.reel-roll-stage').getAttribute('aria-hidden')).toBe('false');

    vi.advanceTimersByTime(420);
    await transition;
    expect(container.querySelector('.case-opening-preview').getAttribute('aria-hidden')).toBe('true');

    CapsuleReelUI.returnToPreview();
    expect(container.classList.contains('is-roll-mode')).toBe(false);
    expect(container.querySelector('.case-opening-preview').getAttribute('aria-hidden')).toBe('false');
    expect(container.querySelector('.reel-roll-stage').getAttribute('aria-hidden')).toBe('true');
    container.remove();
  });

  it('immediately retranslates preview labels and item prefixes', () => {
    const container = makeContainer();
    CapsuleReelUI.initialize(container, 'test_capsule');

    i18n.setLocale('zh-CN');

    expect(container.querySelector('.case-contents-preview__title').textContent).toBe('可能开出的物品');
    expect(container.querySelector('.case-content-card__name').textContent).toBe('印花 | Blue');
    expect(container.querySelector('.case-content-card__rarity').textContent).toBe('高级');
    container.remove();
  });
});
