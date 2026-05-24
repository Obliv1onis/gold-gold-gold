# ADR-0007: Skin Image Loading and Placeholder Strategy

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Rendering / Asset Loading |
| **Knowledge Risk** | LOW — `Image`, `Canvas 2D`, `Promise.allSettled` are stable and pre-training-data |
| **References Consulted** | skin-image-loader.md GDD, reel-ui.md GDD, case-opening-orchestrator.md GDD, ADR-0001 (module system), ADR-0002 (file structure) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm `canvas.getContext('2d')` is available in all target browsers; confirm `canvas.toDataURL()` works without CORS restrictions for data URI generation |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (ES modules), ADR-0002 (Foundation layer structure) |
| **Enables** | ReelUI (`src/presentation/reel-ui.js`), InventoryUI (`src/presentation/inventory-ui.js`) — both require `getImage()` before rendering skin art |
| **Blocks** | Reel UI and Inventory UI cannot render skin images until this ADR is Accepted |
| **Ordering Note** | Foundation layer — must be Accepted before any Presentation module that renders skin images is implemented. |

## Context

### Problem Statement
Skin image URLs come from a community-maintained `cases.json` file pointing to Steam CDN. These URLs are not guaranteed to be valid — they may be stale, rate-limited, or return 404. The Reel UI performs a per-frame CSS transform on 60 card elements during the spin animation; any blocking image request or `null` return from the image layer would crash or corrupt the render. Two Presentation modules (ReelUI, InventoryUI) both need images from the same source, so loading must be shared and not duplicated.

### Constraints
- Images must be pre-fetched before the reel animation starts — no lazy-loading mid-animation
- `getImage()` must be synchronous — called 60 times per strip build inside the render path
- When an image URL is null, empty, or fails to load, a fallback must be returned that is visually coherent (not a broken `<img>` icon)
- The placeholder must use the item's rarity color — the 6 official rarity colors are specified in the GDD and the art bible
- Both ReelUI and InventoryUI share the same cache — no duplicate fetches for the same URL
- The module must be testable in Vitest: `Image` loading and `Canvas` can be mocked

### Requirements
- `preloadCase(caseId)`: fires all image fetches for a case's item pool in parallel; resolves with `{ loaded, failed, skipped }` after all settle
- `getImage(imageUrl, rarity)`: synchronous, always returns an `HTMLImageElement`, never `null`
- `getPlaceholder(rarity)`: generates and caches a 250×250 canvas placeholder per rarity tier
- `clearCache()`: resets all caches — for testing only, not called at runtime
- Cache by URL: `Map<string, HTMLImageElement>` — loaded once, returned on all subsequent calls

## Decision

**Implement `src/foundation/skin-image-loader.js` as a module-level singleton with an in-memory `Map` cache. Placeholders are Canvas-generated data URIs, cached per rarity tier.**

- **Caching**: `Map<url, HTMLImageElement>` for real images; `Map<rarity, HTMLImageElement>` for placeholders. Both caches persist for the session lifetime.
- **Preload strategy**: `Promise.allSettled()` over all `new Image()` instances — never rejects; failed fetches fall through to placeholder.
- **Placeholder generation**: `<canvas>` 250×250 filled with the rarity hex color → `canvas.toDataURL()` → `<img>` with data URI src. Generated once per rarity, cached.
- **Singleton**: Module-level `_cache` and `_placeholders` Maps — one instance shared by all callers.

### Rarity Color Constants

| Rarity | CSS Class Suffix | Hex Color |
|--------|-----------------|-----------|
| `consumer_grade` | `consumer` | `#B0C3D9` |
| `mil_spec` | `mil-spec` | `#4B69FF` |
| `restricted` | `restricted` | `#8847FF` |
| `classified` | `classified` | `#D32EE6` |
| `covert` | `covert` | `#EB4B4B` |
| `rare_special` | `rare-special` | `#E4AE39` |

### Key Interfaces

```js
// src/foundation/skin-image-loader.js

const _cache        = new Map(); // url → HTMLImageElement
const _placeholders = new Map(); // rarity → HTMLImageElement

export const SkinImageLoader = {

  async preloadCase(caseId) {
    const items = CaseDataStore.getAllItems(caseId);
    let loaded = 0, failed = 0, skipped = 0;

    const fetches = items.map(item => {
      if (!item.image_url) { skipped++; return Promise.resolve(); }
      if (_cache.has(item.image_url)) { loaded++; return Promise.resolve(); }

      return new Promise(resolve => {
        const img = new Image();
        img.onload  = () => { _cache.set(item.image_url, img); loaded++; resolve(); };
        img.onerror = () => {
          _cache.set(item.image_url, this.getPlaceholder(item.rarity));
          failed++;
          resolve();
        };
        img.src = item.image_url;
      });
    });

    await Promise.allSettled(fetches);
    return { loaded, failed, skipped };
  },

  getImage(imageUrl, rarity) {
    if (!imageUrl)              return this.getPlaceholder(rarity);
    if (_cache.has(imageUrl))   return _cache.get(imageUrl);
    return this.getPlaceholder(rarity); // not yet preloaded — return placeholder
  },

  getPlaceholder(rarity) {
    if (_placeholders.has(rarity)) return _placeholders.get(rarity);

    const COLORS = {
      consumer_grade: '#B0C3D9', mil_spec: '#4B69FF',
      restricted: '#8847FF',     classified: '#D32EE6',
      covert: '#EB4B4B',         rare_special: '#E4AE39',
    };
    const color = COLORS[rarity] ?? '#B0C3D9';

    const canvas = document.createElement('canvas');
    canvas.width = 250; canvas.height = 250;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 250, 250);
    }

    const img = new Image();
    img.src = canvas.toDataURL();
    _placeholders.set(rarity, img);
    return img;
  },

  clearCache() {
    _cache.clear();
    _placeholders.clear();
  },
};
```

### Architecture Diagram

```
ReelUI.initialize(caseId)
  └─▶ SkinImageLoader.preloadCase(caseId)
        └─▶ CaseDataStore.getAllItems(caseId)  [get all image URLs]
        └─▶ Promise.allSettled([new Image() × N])
              ├─ onload:  _cache.set(url, img)
              └─ onerror: _cache.set(url, getPlaceholder(rarity))

ReelUI.render() — called per frame
  └─▶ SkinImageLoader.getImage(item.image_url, item.rarity)
        ├─ cache hit:    return _cache.get(url)    [synchronous, O(1)]
        └─ cache miss:   return getPlaceholder(rarity)

InventoryUI.renderItem(item)
  └─▶ SkinImageLoader.getImage(item.image_url, item.rarity)
        └─ same cache — shared singleton, no re-fetch
```

## Alternatives Considered

### Alternative A: Lazy loading (fetch on demand, show spinner)
- **Description**: No preload phase. `getImage()` triggers a network request if the image is not cached, returning a placeholder until it loads, then swapping to the real image.
- **Pros**: No upfront wait; images load progressively.
- **Cons**: During the reel animation, cards enter the viewport at 60fps. A network request per card fires 60 concurrent requests in the first strip build. The Reel UI's DOM transform path would need to handle async image swaps, adding state management to the render loop. The GDD explicitly requires preload-before-animate to satisfy Pillar 2 ("Zero Friction" — animation starts instantly, no load gap).
- **Rejection Reason**: Violates Pillar 2 and the GDD's preload contract.

### Alternative B: CSS gradient placeholders instead of Canvas
- **Description**: Rather than generating Canvas images, return an `HTMLImageElement` with `src=""` and let CSS handle the fallback (e.g., `background-color: [rarity-color]` on the card container).
- **Pros**: No canvas element creation.
- **Cons**: `getImage()` must always return an `HTMLImageElement` — this is the contract both ReelUI and InventoryUI depend on. CSS fallbacks would require both UI modules to know about the placeholder strategy and apply CSS conditionally. The GDD specifies that `getImage()` returns the same interface regardless of whether the image loaded.
- **Rejection Reason**: Breaks the uniform `HTMLImageElement` contract that downstream modules rely on.

### Alternative C: IndexedDB image cache (persist across sessions)
- **Description**: Store loaded images as Blob URLs in IndexedDB so they survive page reload.
- **Pros**: Faster load on second visit; reduced CDN calls.
- **Cons**: IndexedDB adds async complexity to `getImage()` (which must be synchronous); Blob URL lifecycle management adds significant complexity; Steam CDN has its own CDN caching — browser HTTP cache already handles repeat visits effectively; this feature is not in the GDD.
- **Rejection Reason**: Out of GDD scope; synchronous `getImage()` requirement makes in-memory Map the correct choice.

## Consequences

### Positive
- `getImage()` is always synchronous and always returns an `HTMLImageElement` — the render path has no branching on image availability
- ReelUI and InventoryUI share the same cache — each skin URL is fetched at most once per session regardless of how many modules reference it
- Placeholder strategy means network errors produce a coherent rarity-colored card, not a broken image icon
- Canvas placeholder is generated once per rarity tier and cached — 6 placeholders maximum

### Negative
- All images for a case are fetched before the Open button activates — the user waits for preload to complete. Mitigation: `preloadCase()` is called at case selection, not at Open click, so the wait happens while the user reads the case contents, not at the moment of action.
- In-memory cache grows monotonically during the session — a player who opens many different cases will hold more images in memory. At ~100KB per skin image × 20 items per case × 5 cases = ~10MB, well within browser limits.

### Risks
- **Steam CDN CORS restrictions**: If Steam CDN returns `Access-Control-Allow-Origin` headers that block the `<img>` load, `onerror` fires and the placeholder is returned. No crash — but all images may silently fail. Mitigation: test CDN URLs before release; Steam CDN historically allows image loads from any origin.
- **Canvas not available in test environment**: Vitest runs in jsdom which does not implement Canvas 2D. Mitigation: mock `document.createElement('canvas')` in tests, or use `happy-dom` which implements Canvas.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| skin-image-loader.md | `preloadCase(caseId)`: parallel fetch, resolves with `{ loaded, failed, skipped }` | `Promise.allSettled()` over all `Image()` instances |
| skin-image-loader.md | `getImage()` synchronous, always returns `HTMLImageElement` | `Map` cache lookup, O(1); placeholder fallback for misses |
| skin-image-loader.md | Canvas placeholder: 250×250, filled with rarity hex color | `<canvas>` 250×250 + `fillRect` + `toDataURL()` → `<img>` |
| skin-image-loader.md | Placeholders cached per rarity (not re-generated) | `_placeholders Map<rarity, HTMLImageElement>` |
| skin-image-loader.md | One instance shared across app | Module-level `_cache` and `_placeholders` (singleton pattern) |
| reel-ui.md | `preloadCase(caseId)` awaited before reel-ready event | ReelUI awaits `SkinImageLoader.preloadCase()` in `initialize()` |
| reel-ui.md | Cards with null image_url render with rarity placeholder | `getImage(null, rarity)` returns `getPlaceholder(rarity)` |
| reel-ui.md | Rarity colors match official CS2 values | 6-entry COLORS constant with hex values from GDD/art bible |

## Performance Implications
- **CPU**: `getImage()` is a `Map.get()` — O(1), <0.01ms. Canvas placeholder generated once per rarity.
- **Memory**: In-memory image cache; ~100KB/image × N case items. For a typical session (3-5 cases), ~5-10MB total.
- **Load Time**: `preloadCase()` fires N parallel `Image` loads. Network-bound; depends on CDN latency. Typical: 20 items × ~50ms = ~50ms total (parallel). Shown as a loading state by ReelUI before `reel-ready` fires.
- **Network**: One request per unique image URL per session. Browser HTTP cache handles repeat session loads.

## Migration Plan
No existing source code — greenfield. `src/foundation/skin-image-loader.js` is written to this spec.

## Validation Criteria
- `preloadCase("recoil_case")` resolves with `{ loaded: N, failed: 0, skipped: 0 }` when all URLs are valid
- `getImage(null, "covert")` returns a non-null `HTMLImageElement` (not an error)
- `getImage(url, rarity)` called twice for the same URL returns the same cached element (identity equality)
- `getPlaceholder("mil_spec")` returns an element; second call returns the same cached element
- `preloadCase()` called twice for the same case does not duplicate network requests
- `clearCache()` causes subsequent `getImage()` calls to return placeholders (cache empty)

## Related Decisions
- ADR-0001: Skin Image Loader is a plain ES module, no npm dependencies
- ADR-0002: Foundation layer at `src/foundation/skin-image-loader.js`; consumed by Presentation layer
- ADR-0006: ReelUI calls `getImage()` synchronously in the render path (onFrame callback)
- skin-image-loader.md: GDD defining the full API contract and fallback strategy
