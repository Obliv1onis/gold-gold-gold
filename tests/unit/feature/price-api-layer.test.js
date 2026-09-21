import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function response(body) {
  return { ok: true, json: vi.fn().mockResolvedValue(body) };
}

describe('PriceAPILayer snapshot cache', () => {
  it('serves a fresh bundled quote without making a live request', async () => {
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(response({
      catalog: { items: 1, verified_at: new Date().toISOString() },
      prices: {
        'Revolution Case': { price: 0.29, updated_at: new Date().toISOString() },
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { PriceAPILayer } = await import('../../../src/feature/price-api-layer.js');
    await expect(PriceAPILayer.getPrice('Revolution Case')).resolves.toBe(0.29);
    expect(PriceAPILayer.getCachedPrice('Revolution Case', 'steam')).toBe(0.29);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes a stale bundled quote and caches the live lowest price', async () => {
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        catalog: { items: 1, verified_at: '2025-01-01T00:00:00Z' },
        prices: {
          'Revolution Case': { price: 0.25, updated_at: '2025-01-01T00:00:00Z' },
        },
      }))
      .mockResolvedValueOnce(response({ success: true, lowest_price: '$0.29' }));
    vi.stubGlobal('fetch', fetchMock);

    const { PriceAPILayer } = await import('../../../src/feature/price-api-layer.js');
    await expect(PriceAPILayer.getPrice('Revolution Case')).resolves.toBe(0.29);
    expect(PriceAPILayer.getCachedPrice('Revolution Case')).toBe(0.29);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
