import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('CapsuleDataStore standalone market items', () => {
  it('loads market-only items without adding a capsule', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async url => ({
      ok: true,
      json: async () => url === '/market-items.json'
        ? {
            items: [{
              id: 'sticker-test',
              name: 'Sticker | Test | Cologne 2026',
              market_hash_name: 'Sticker | Test | Cologne 2026',
              rarity: 'high_grade',
            }],
          }
        : { capsules: [] },
    })));

    const { CapsuleDataStore } = await import('../../../src/foundation/capsule-data-store.js');
    await CapsuleDataStore.init('/capsules.json', null, '/market-items.json');

    expect(CapsuleDataStore.getCapsuleList()).toEqual([]);
    expect(CapsuleDataStore.getMarketItems()).toEqual([
      expect.objectContaining({ id: 'sticker-test', isMarketOnly: true }),
    ]);
  });
});
