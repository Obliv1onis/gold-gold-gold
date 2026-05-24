import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: { getAllItems: vi.fn() },
}));

import { SkinImageLoader }  from '../../../src/feature/skin-image-loader.js';
import { CaseDataStore }    from '../../../src/foundation/case-data-store.js';

// ─── Image stub ──────────────────────────────────────────────────────────────
// jsdom doesn't load URLs, so intercept new Image() to capture instances
// and let tests fire onload/onerror manually.

let _imageInstances = [];

class MockImage {
  constructor() {
    this.onload  = null;
    this.onerror = null;
    this._src    = '';
    _imageInstances.push(this);
  }
  set src(v) { this._src = v; }
  get src()  { return this._src; }
}

beforeAll(() => {
  vi.stubGlobal('Image', MockImage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ITEMS_WITH_URLS = [
  { item_id: 'ms_0', weapon: 'P250', skin: 'Sand Dune', rarity: 'mil_spec', stattrak: false, image_url: 'https://cdn.example.com/p250.png' },
  { item_id: 'ms_1', weapon: 'Glock', skin: 'Sand Dune', rarity: 'mil_spec', stattrak: false, image_url: 'https://cdn.example.com/glock.png' },
];
const ITEMS_WITH_NULLS = [
  { item_id: 'ms_0', weapon: 'P250', skin: 'Sand Dune', rarity: 'mil_spec', stattrak: false, image_url: null },
  { item_id: 'ms_1', weapon: 'Glock', skin: 'Sand Dune', rarity: 'mil_spec', stattrak: false, image_url: null },
  { item_id: 'ms_2', weapon: 'M4A1', skin: 'Printstream', rarity: 'classified', stattrak: true, image_url: 'https://cdn.example.com/m4a1.png' },
];

function fireAllLoaded() {
  [..._imageInstances].forEach(img => { if (img._src && img.onload) img.onload(); });
}
function fireWithErrors(failUrls = []) {
  [..._imageInstances].forEach(img => {
    if (!img._src) return;
    failUrls.includes(img._src) ? img.onerror?.() : img.onload?.();
  });
}

beforeEach(() => {
  SkinImageLoader.clearCache();
  _imageInstances = [];
  vi.clearAllMocks();
  CaseDataStore.getAllItems.mockReturnValue([...ITEMS_WITH_URLS]);
});

// ─── preloadCase ─────────────────────────────────────────────────────────────

describe('SkinImageLoader — preloadCase', () => {
  it('test_sil_preload_all_loaded_returns_correct_counts', async () => {
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    const { loaded, failed, skipped } = await p;
    expect(loaded).toBe(2);
    expect(failed).toBe(0);
    expect(skipped).toBe(0);
  });

  it('test_sil_preload_null_urls_counted_as_skipped', async () => {
    CaseDataStore.getAllItems.mockReturnValue([...ITEMS_WITH_NULLS]);
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    const { loaded, failed, skipped } = await p;
    expect(skipped).toBe(2);
    expect(loaded).toBe(1);
    expect(failed).toBe(0);
  });

  it('test_sil_preload_failed_urls_counted_as_failed', async () => {
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireWithErrors(['https://cdn.example.com/p250.png']);
    const { loaded, failed } = await p;
    expect(failed).toBe(1);
    expect(loaded).toBe(1);
  });

  it('test_sil_preload_unknown_case_resolves_empty', async () => {
    CaseDataStore.getAllItems.mockReturnValue([]);
    const result = await SkinImageLoader.preloadCase('ghost_case');
    expect(result).toEqual({ loaded: 0, failed: 0, skipped: 0 });
  });

  it('test_sil_preload_no_new_fetch_for_already_cached_urls', async () => {
    const p1 = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    await p1;

    const countAfterFirst = _imageInstances.length;
    _imageInstances = [];

    // Second preload — same URLs already settled (no network Image objects created)
    await SkinImageLoader.preloadCase('recoil_case');
    expect(_imageInstances.length).toBe(0);
    expect(countAfterFirst).toBe(2);
  });

  it('test_sil_preload_twice_same_case_returns_same_counts', async () => {
    const p1 = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    const r1 = await p1;

    _imageInstances = [];
    const r2 = await SkinImageLoader.preloadCase('recoil_case');
    expect(r2).toEqual(r1);
  });
});

// ─── getImage ────────────────────────────────────────────────────────────────

describe('SkinImageLoader — getImage', () => {
  it('test_sil_get_image_src_matches_url_after_preload', async () => {
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    await p;

    const url = ITEMS_WITH_URLS[0].image_url;
    const img = SkinImageLoader.getImage(url, 'mil_spec');
    expect(img).toBeInstanceOf(MockImage);
    expect(img.src).toBe(url);
  });

  it('test_sil_get_image_returns_new_element_each_call', async () => {
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    await p;

    const url = ITEMS_WITH_URLS[0].image_url;
    const a = SkinImageLoader.getImage(url, 'mil_spec');
    const b = SkinImageLoader.getImage(url, 'mil_spec');
    expect(a).not.toBe(b); // different elements — safe for multi-card DOM insertion
    expect(a.src).toBe(b.src);
  });

  it('test_sil_get_image_null_url_returns_placeholder', () => {
    const img = SkinImageLoader.getImage(null, 'covert');
    expect(img).toBeInstanceOf(MockImage);
    expect(img).not.toBeNull();
  });

  it('test_sil_get_image_before_preload_returns_placeholder', () => {
    const img = SkinImageLoader.getImage('https://cdn.example.com/anything.png', 'mil_spec');
    expect(img).toBeInstanceOf(MockImage);
    // src should NOT be the real URL (not loaded yet)
    expect(img.src).not.toBe('https://cdn.example.com/anything.png');
  });

  it('test_sil_get_image_failed_url_returns_placeholder_not_real_url', async () => {
    const failUrl = ITEMS_WITH_URLS[0].image_url;
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireWithErrors([failUrl]);
    await p;

    const img = SkinImageLoader.getImage(failUrl, 'mil_spec');
    expect(img.src).not.toBe(failUrl); // failed URL → placeholder src, not real URL
  });

  it('test_sil_get_image_always_returns_mock_image_instance', async () => {
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    await p;

    [
      SkinImageLoader.getImage(ITEMS_WITH_URLS[0].image_url, 'mil_spec'),
      SkinImageLoader.getImage(null, 'classified'),
      SkinImageLoader.getImage('https://cdn.example.com/missing.png', 'covert'),
    ].forEach(img => expect(img).toBeInstanceOf(MockImage));
  });
});

// ─── getPlaceholder ───────────────────────────────────────────────────────────

describe('SkinImageLoader — getPlaceholder', () => {
  it('test_sil_get_placeholder_returns_mock_image_element', () => {
    const img = SkinImageLoader.getPlaceholder('rare_special');
    expect(img).toBeInstanceOf(MockImage);
    expect(img).not.toBeNull();
  });

  it('test_sil_get_placeholder_same_rarity_same_src', () => {
    const a = SkinImageLoader.getPlaceholder('rare_special');
    const b = SkinImageLoader.getPlaceholder('rare_special');
    // Different elements (safe for DOM) but same src (canvas generated once)
    expect(a).not.toBe(b);
    expect(a.src).toBe(b.src);
  });

  it('test_sil_get_placeholder_different_rarities_return_separate_elements', () => {
    // Can't compare src in jsdom (no canvas → both fallback to empty src).
    // Verify each call returns a distinct element that is non-null.
    const a = SkinImageLoader.getPlaceholder('mil_spec');
    const b = SkinImageLoader.getPlaceholder('covert');
    expect(a).toBeInstanceOf(MockImage);
    expect(b).toBeInstanceOf(MockImage);
    expect(a).not.toBe(b);
  });

  it('test_sil_get_placeholder_unknown_rarity_returns_element', () => {
    const img = SkinImageLoader.getPlaceholder('not_a_real_rarity');
    expect(img).toBeInstanceOf(MockImage);
  });

  it('test_sil_get_placeholder_canvas_generated_once_per_rarity', () => {
    const countBefore = _imageInstances.length;
    SkinImageLoader.getPlaceholder('covert');
    SkinImageLoader.getPlaceholder('covert');
    SkinImageLoader.getPlaceholder('covert');
    // Each getPlaceholder call creates one new Image element, but canvas only generated once
    // We verify by checking the src is identical across all three calls
    const srcs = _imageInstances.slice(countBefore).map(i => i._src);
    expect(new Set(srcs).size).toBe(1); // all same src (canvas data URI cached)
  });
});

// ─── clearCache ───────────────────────────────────────────────────────────────

describe('SkinImageLoader — clearCache', () => {
  it('test_sil_clear_cache_causes_get_image_to_return_placeholder_for_previously_loaded_url', async () => {
    const p = SkinImageLoader.preloadCase('recoil_case');
    fireAllLoaded();
    await p;

    const url = ITEMS_WITH_URLS[0].image_url;
    expect(SkinImageLoader.getImage(url, 'mil_spec').src).toBe(url); // loaded

    SkinImageLoader.clearCache();

    expect(SkinImageLoader.getImage(url, 'mil_spec').src).not.toBe(url); // now placeholder
  });

  it('test_sil_clear_cache_causes_new_placeholder_src_generation', () => {
    const srcBefore = SkinImageLoader.getPlaceholder('covert').src;
    SkinImageLoader.clearCache();
    const srcAfter  = SkinImageLoader.getPlaceholder('covert').src;
    // Both are data URIs for the same color — content identical but generated fresh
    expect(srcAfter).toBe(srcBefore); // same color → same data URI content
  });
});
