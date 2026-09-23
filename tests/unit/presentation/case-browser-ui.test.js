import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prefetch, entries } = vi.hoisted(() => ({
  prefetch: vi.fn(),
  entries: [{
    id: 'revolution_case',
    name: 'Revolution Case',
    type: 'weapon_case',
    release_date: '2023-02-09',
    image_url: null,
    market_price: 0.29,
  }],
}));

vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: {
    getCaseList: vi.fn(type => entries.filter(entry => !type || entry.type === type)),
  },
}));

vi.mock('../../../src/feature/price-api-layer.js', () => ({
  PriceAPILayer: {
    buildCaseHashName: vi.fn(name => name),
    getCachedPrice: vi.fn(() => null),
    prefetch,
  },
}));

import { CaseBrowserUI } from '../../../src/presentation/case-browser-ui.js';

describe('CaseBrowserUI lazy rendering', () => {
  beforeEach(() => prefetch.mockClear());

  it('does not build hidden cards until first shown and prefetches each card once', () => {
    const container = document.createElement('div');
    CaseBrowserUI.init(container, { onSelect: vi.fn() });

    expect(container.children).toHaveLength(0);
    expect(prefetch).not.toHaveBeenCalled();

    CaseBrowserUI.show('weapon_case');
    expect(container.querySelectorAll('.case-card')).toHaveLength(1);
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('renders historical Armory entries above regular weapon cases', () => {
    entries.push(
      {
        id: 'gallery_case', name: 'Gallery Case', type: 'weapon_case', armory: true,
        armory_image_url: '/assets/armory-pass.webp', market_price: 4.25,
      },
      {
        id: 'armory_spy_tech', name: 'The Spy Tech Collection', type: 'armory_collection',
        image_url: '/assets/armory-pass.webp', credits: 4, market_price: 1.60,
      },
    );
    const container = document.createElement('div');
    CaseBrowserUI.init(container, { onSelect: vi.fn() });

    CaseBrowserUI.show('weapon_case');

    expect([...container.querySelectorAll('.section-header')].map(el => el.textContent))
      .toEqual(['The Armory', 'Weapon Cases']);
    expect(container.querySelectorAll('.case-card')).toHaveLength(3);
    expect(container.textContent).toContain('1 pass draw');
    expect(prefetch).toHaveBeenCalledTimes(1);
    entries.splice(1);
  });
});
