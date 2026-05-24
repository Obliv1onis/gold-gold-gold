# Skin Image Loader

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-20
> **Implements Pillar**: Faithful Over Flashy

## Overview

The Skin Image Loader is a stateful cache layer that wraps browser image loading for all skin and case artwork in the application. It receives image URLs from `ItemEntry.image_url` (sourced from the Case Data Store), pre-fetches them before the reel animation begins, holds loaded `Image` objects in memory, and returns them synchronously on demand. When a URL is `null`, empty, or fails to load, it generates a rarity-colored placeholder image instead.

Its contract is: by the time the Reel UI or Inventory UI needs to display a skin, the image is already loaded and ready. It does this through a `preloadCase(caseId)` call that fires all image fetches for a case's item pool in parallel and resolves when all settle. The Reel UI calls `preloadCase()` before enabling the Open button; every subsequent `getImage()` call during the animation is synchronous and hit-from-cache.

The placeholder strategy is the system's key resilience feature. Steam CDN image URLs are provided by the community-maintained `cases.json` data file. If any URL is stale, rate-limited, or missing, the loader substitutes a flat rarity-color card (Mil-Spec blue, Restricted purple, Classified pink, Covert red, Rare Special gold). Downstream systems receive the same `HTMLImageElement` interface regardless of whether the image is a real weapon render or a placeholder — they do not need to handle either case explicitly.

## Player Fantasy

The Skin Image Loader has no direct player-facing interface. Players never interact with it consciously — they see weapon renders in the reel and inventory. When this system works correctly, it is invisible: images are loaded before the player opens a case, the reel shows crisp weapon art, and there is no perceptible loading pause.

When it fails gracefully (network error, stale CDN URL), the player sees a flat rarity-colored card in place of the weapon art. This is not a fantasy in itself, but it is the system's contribution to the game's feel: a saturated red card during a covert reveal still conveys the rarity tier. The player may not get the authentic render, but they get a coherent signal. The placeholder is designed to be "obviously a fallback" rather than confusing or broken.

The fantasy this system *enables* lives in the Reel UI and Inventory UI — the crisp weapon renders scrolling past, the golden glow of a rare item locked center-screen. The Skin Image Loader makes that possible without surfacing itself.

## Detailed Design

### Core Rules

1. **Cache by URL**: The loader holds a `Map<string, HTMLImageElement>` keyed on image URL. A loaded `Image` object is stored once and returned on all subsequent requests for that URL. The cache is not evicted during a session — it grows monotonically.

2. **Preload-before-serve contract**: `preloadCase(caseId)` must be called and awaited before `getImage()` is called for any item in that case. The Reel UI enforces this contract — it awaits `preloadCase()` before enabling the Open button. `getImage()` called before preload returns a placeholder (not an error).

3. **All fetches parallel inside `preloadCase()`**: `preloadCase()` calls `CaseDataStore.getAllItems(caseId)` to get the full flat item array, then fires all image loads simultaneously using `Promise.allSettled()`. It resolves after all settle — loaded, failed, or skipped (null URL).

4. **Placeholder generation**: When `imageUrl` is `null` or a load fails, the loader generates a placeholder `HTMLImageElement` from a 250×250 canvas filled with the rarity's official color. The canvas is converted to a data URI and set as the `<img>` src. Placeholders are also cached by rarity key so they are only generated once.

5. **`getImage()` is synchronous**: Returns the cached `HTMLImageElement` for the given URL (if preloaded and succeeded), or the cached rarity placeholder (if URL was null or failed). Never triggers a new network request. Always returns an element — never `null` or `undefined`.

6. **Rarity colors** (used only for placeholder generation):

   | Rarity | Hex Color |
   |--------|-----------|
   | `mil_spec` | `#4B69FF` |
   | `restricted` | `#8847FF` |
   | `classified` | `#D32EE6` |
   | `covert` | `#EB4B4B` |
   | `rare_special` | `#E4AE39` |
   | `unknown` | `#808080` |

7. **One instance shared across the app**: The Skin Image Loader is a single module-level instance. Reel UI and Inventory UI both reference the same loader — they share the cache.

**Public API:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `preloadCase` | `(caseId: string): Promise<{ loaded: number, failed: number, skipped: number }>` | Fires all image fetches for a case's item pool in parallel. Resolves after all settle. Returns a summary of outcomes. |
| `getImage` | `(imageUrl: string \| null, rarity: string): HTMLImageElement` | Returns cached image or rarity placeholder. Synchronous. Never throws. |
| `getPlaceholder` | `(rarity: string): HTMLImageElement` | Returns (or generates and caches) a rarity-colored placeholder for the given rarity tier. |
| `clearCache` | `(): void` | Clears the URL cache and placeholder cache. Intended for testing only — not called at runtime. |

**Placeholder dimensions:**

| Property | Value | Source |
|----------|-------|--------|
| Width | 250px | `reel_card_width` constant (registry, owned by reel-animation-engine.md) |
| Height | 250px | Square — sufficient for inventory display and reel card rendering |

### States and Transitions

The Skin Image Loader has no global FSM. Each URL in the cache exists in one of three per-URL states:

| URL State | Description |
|-----------|-------------|
| **Pending** | `preloadCase()` was called but this URL's fetch hasn't settled yet |
| **Loaded** | Image fetched successfully; `HTMLImageElement` is in cache |
| **Failed** | Network error or load timeout; placeholder stored in cache for this URL |

`getImage()` always returns something. If the URL is still Pending (called before preload resolved), it returns the rarity placeholder. After preload resolves, it returns the loaded image.

### Interactions with Other Systems

| System | Direction | What Skin Image Loader calls | Notes |
|--------|-----------|------------------------------|-------|
| **Case Data Store** (#1) | ↑ depends on | `getAllItems(caseId)` — to get all image URLs for a case | Called inside `preloadCase()` |
| **Reel UI** (#12) | ↓ depended on by | — | Calls `preloadCase(caseId)` before spin; calls `getImage(item.image_url, rarity)` per card render |
| **Inventory UI** (#14) | ↓ depended on by | — | Calls `getImage(item.image_url, rarity)` per inventory row render |

## Formulas

This system contains no mathematical formulas. All logic is conditional (URL present / absent / failed) rather than numeric.

#### F1: Preload Outcome Counters

```
loaded  = count of items where imageUrl !== null AND fetch succeeded
failed  = count of items where imageUrl !== null AND fetch failed
skipped = count of items where imageUrl === null
```

These counters are returned by `preloadCase()` for diagnostic purposes only. They do not affect any system behavior.

#### F2: Placeholder Canvas Size

```
placeholder_width  = reel_card_width = 250px
placeholder_height = placeholder_width = 250px
```

Placeholders are square. The width is constrained to `reel_card_width` from the registry so the Reel UI card layout doesn't need to scale placeholder images.

## Edge Cases

**E1: `imageUrl` is `null` on an `ItemEntry`**
Case Data Store GDD specifies `image_url` defaults to `null` when missing from the JSON.
*Handling*: `preloadCase()` counts this URL as "skipped" (no fetch attempted). `getImage(null, rarity)` immediately returns the rarity placeholder.

**E2: Image fetch times out or returns a non-2xx response**
Steam CDN may be unreachable, rate-limited, or URL may have changed.
*Handling*: The `Image.onerror` callback fires. The URL is stored in the failed set. `getImage()` for this URL returns the rarity placeholder. The `preloadCase()` result increments `failed`.

**E3: `getImage()` called before `preloadCase()` has resolved**
Reel UI has a timing bug and calls `getImage()` during preload.
*Handling*: If the URL is still Pending (not yet in the cache), `getImage()` returns the rarity placeholder. No error thrown. After preload resolves, subsequent calls will return the loaded image.

**E4: `getImage()` called for a URL that was never preloaded (different case)**
Inventory UI requests an image for an item from a case opened in a previous session (already in Skin Inventory but not in current preload cache).
*Handling*: URL not found in cache → returns rarity placeholder. Acceptable in MVP — inventory renders on-demand without a preload step.

**E5: `preloadCase()` called multiple times for the same case**
Reel UI calls `preloadCase()` on each case selection change; same case is selected twice.
*Handling*: URLs already in cache (Loaded or Failed state) are skipped — no re-fetch. Only new URLs trigger fetches. The function always resolves to a valid result.

**E6: `preloadCase()` called with an unknown `caseId`**
`CaseDataStore.getAllItems(unknownId)` returns `[]`.
*Handling*: No fetches fired. Promise resolves immediately with `{ loaded: 0, failed: 0, skipped: 0 }`. No error thrown.

**E7: Canvas placeholder generation fails**
`canvas.getContext("2d")` returns `null` in a headless or restricted environment.
*Handling*: Falls back to an `<img>` element with an empty `src`. Renders as a broken image (browser default). Not expected in normal browser execution.

**E8: Very large item pool (50+ items across all tiers)**
`Promise.allSettled()` fires 50+ concurrent fetch requests.
*Handling*: Allowed. Browser connection pools handle concurrency; no artificial limit is imposed.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Case Data Store** (#1) | Provides the full item list (including `image_url` fields) for a given case | `getAllItems(caseId): ItemEntry[]` — called inside `preloadCase()` |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they call |
|--------|-----------------|----------------|
| **Reel UI** (#12) | Needs pre-loaded images for all reel card renders before the animation starts | `preloadCase(caseId)`, `getImage(imageUrl, rarity)` |
| **Inventory UI** (#14) | Renders skin images in the player's inventory list | `getImage(imageUrl, rarity)` |

**No other dependencies**: The Skin Image Loader wraps browser-native `Image` loading. It calls no other application systems at runtime — only Case Data Store at preload time.

## Tuning Knobs

| Knob | Default | Safe Range | Gameplay Effect |
|------|---------|------------|-----------------|
| `PLACEHOLDER_COLORS` | See rarity color table in Detailed Design | Any valid CSS hex | Changes the fallback card color per rarity tier. Should mirror CS2's official rarity palette — change only if the color system is redesigned. |
| `PLACEHOLDER_SIZE_PX` | 250px | 100px – 500px | Placeholder canvas dimensions. Must match `reel_card_width` (250px) — changing one without the other creates misaligned reel cards. |

No behavior-changing tuning knobs exist. The image loading strategy (parallel preload + synchronous serve) is fixed.

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-SIL-01 | `preloadCase("recoil_case")` called with a case that has 20 items, all with valid image URLs | Promise resolves with `{ loaded: 20, failed: 0, skipped: 0 }` after all fetches settle | BLOCKING |
| AC-SIL-02 | `preloadCase()` called for a case where 3 items have null `image_url` | `skipped = 3`; `getImage(null, rarity)` for those items returns a non-null `HTMLImageElement` | BLOCKING |
| AC-SIL-03 | `preloadCase()` called for a case where 2 items return a 404 from CDN | `failed = 2`; `getImage(brokenUrl, rarity)` returns the rarity placeholder, not null | BLOCKING |
| AC-SIL-04 | `getImage(url, "mil_spec")` called after successful preload | Returns the cached `HTMLImageElement` with `src` matching the original URL | BLOCKING |
| AC-SIL-05 | `getImage(null, "covert")` called (no preload needed) | Returns an `HTMLImageElement` with the covert rarity color (`#EB4B4B`); not null | BLOCKING |
| AC-SIL-06 | `getImage(url, rarity)` called before preload resolves | Returns the rarity placeholder (not null, not an error) | BLOCKING |
| AC-SIL-07 | `preloadCase()` called twice for the same case | Second call resolves immediately with same counts; no duplicate fetch requests | BLOCKING |
| AC-SIL-08 | `preloadCase("unknown_case")` called | Resolves with `{ loaded: 0, failed: 0, skipped: 0 }`; no error thrown | BLOCKING |
| AC-SIL-09 | `getPlaceholder("rare_special")` called | Returns an `HTMLImageElement` with the Rare Special gold color (`#E4AE39`) | BLOCKING |
| AC-SIL-10 | `getPlaceholder("rare_special")` called twice | Second call returns the same cached element (not a new canvas render) | ADVISORY |
| AC-SIL-11 | `getImage(url, rarity)` for an unknown URL (not preloaded) | Returns the rarity placeholder; no network request fired | BLOCKING |
