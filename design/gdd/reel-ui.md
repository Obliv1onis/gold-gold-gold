# Reel UI

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-20
> **Implements Pillar**: Faithful Over Flashy · Zero Friction

## Overview

The Reel UI is the visual rendering layer for the case opening animation. It translates per-frame offset data from the Reel Animation Engine into DOM mutations — applying CSS transforms to scroll a horizontal strip of item cards across a fixed viewport window. It owns the card structure (skin image, item name, rarity border), the viewport container, and the pre-spin idle state. It does not own any animation math or timing; all of that lives in the engine.

The Reel UI lifecycle has three phases: **initialize** (build a static strip of cards for the selected case, preload all images via Skin Image Loader, center a sample item in the viewport), **animate** (receive per-frame offset values via `onFrame` callback and apply `transform: translateX(-offset)` to the strip), and **idle** (strip locked at post-spin position, selected item centered, awaiting next open).

The `onFrame(offset, strip)` callback is the interface between the engine and this UI. The Reel Animation Engine calls it on every animation frame; the Reel UI reads `offset` to update the strip's CSS transform and uses `strip` (on the first call) to build or rebuild the card elements. This design keeps the engine entirely DOM-free and the Reel UI decoupled from animation math.

**Pending engine GDD update**: The `ReelCallbacks` interface in the Reel Animation Engine GDD must be updated to include `onFrame(offset: number, strip: ItemEntry[]): void`. The Orchestrator GDD must be updated to wire `onFrame: (offset, strip) => ReelUI.render(offset, strip)`.

## Player Fantasy

The reel is what players came for. Every card that scrolls past is a possibility — a knife, a classified skin, another blue. The blur of cards at full speed creates pure anticipation; the slow-down phase is when players lean forward. They know the selected item is already determined — the simulation chose it before the reel started — but the eyes still track, still search, still hope for a rarity-colored border to drift into the center window.

The Reel UI owns the moment between click and reveal. Three visual details define whether it feels authentic:

1. **Card legibility at speed.** At peak velocity, cards move too fast to read — this is correct. Slowing to the point where individual skins are visible is the arrival of "almost there" tension.
2. **The center marker.** The notch or highlight at the viewport's center tells the player exactly where the result will land. Their eye locks onto it in the final seconds.
3. **The landing.** The item easing to a stop — not snapping — at a slightly random position within the center window is what separates a natural stop from a programmatic one. The small random offset (`stopOffset`) makes the reel feel physical.

This system serves **Pillar 1: Faithful Over Flashy** — it must reproduce the exact visual cadence of CS2's reel, not invent a better one. And **Pillar 2: Zero Friction** — the animation starts the instant Open is clicked, with no loading gap, because images are preloaded before the button activates.

## Detailed Design

### Core Rules

**DOM Structure:**

```html
<div class="reel-viewport">              <!-- overflow: hidden; fixed width -->
  <div class="reel-strip">              <!-- transform: translateX(-offset)px -->
    <div class="reel-card rarity-[tier]">  <!-- × 60 -->
      <img class="card-image" />
      <span class="card-name">[Weapon | Skin]</span>
    </div>
  </div>
  <div class="reel-center-marker" />   <!-- visual indicator at viewport center -->
</div>
```

**Card Structure (per card):**

| Element | Content | Source |
|---------|---------|--------|
| Container (`reel-card`) | CSS class `rarity-[tier]` for rarity-colored border | `item.rarity` |
| Image (`card-image`) | Loaded `HTMLImageElement` or rarity placeholder | `SkinImageLoader.getImage(item.image_url, item.rarity)` |
| Name (`card-name`) | `"[item.weapon] | [item.skin]"` | `item.weapon`, `item.skin` |

Each card is exactly **250px wide** (matches `reel_card_width` registry constant).

**Rarity border colors (CSS class → color):**

| Class | Color |
|-------|-------|
| `.rarity-mil_spec` | `#4B69FF` |
| `.rarity-restricted` | `#8847FF` |
| `.rarity-classified` | `#D32EE6` |
| `.rarity-covert` | `#EB4B4B` |
| `.rarity-rare_special` | `#E4AE39` |

**Lifecycle:**

1. **Initialize** (`initialize(caseId)`):
   - Call `SkinImageLoader.preloadCase(caseId)` — async; awaited before rendering.
   - On preload resolve: build a static 60-card strip using the case's item pool (shuffle the pool; repeat to fill 60 slots).
   - Center the strip so a sample item sits at the viewport center (offset = index ~30 × 250 = 7500px).
   - Render the strip to the DOM. Reel is now in the **Idle** visual state.
   - Emit a `reel-ready` DOM event so the App Shell knows preloading is complete.

2. **Animate** (`render(offset, strip)` — called by engine via `onFrame` callback):
   - First `render()` call of a spin: rebuild all 60 card DOM elements using the provided `strip` (60-item array with selected item at index 55).
   - All subsequent `render()` calls: set `reel-strip.style.transform = "translateX(-[offset]px)"`.
   - Do not rebuild card DOM elements on every frame — only on the first call of each spin.

3. **Post-spin Idle**:
   - After `onComplete` fires, the Reel UI does nothing — the strip remains at `currentOffset = targetOffset`, selected item locked at center.
   - The reel stays in this state until the next `initialize()` or spin begins.

**Pre-spin visual state:**
The reel displays a static strip of the case's items at rest, with a random item from the pool centered in the viewport. This is visible after `initialize()` completes, before any open has occurred.

**Viewport width:**
The Reel UI measures its own container's width (`reelViewport.offsetWidth`) and exposes it as a readable property `viewportWidth`. The Orchestrator reads this to pass to the engine at `spin()` time.

### States and Transitions

| State | Visual | Entry |
|-------|--------|-------|
| **Uninitialized** | Empty container | App load, before `initialize()` |
| **Loading** | Placeholder while preloading | `initialize()` called, awaiting preload |
| **Idle** | Static strip, sample item centered | Preload complete; or post-spin locked on result |
| **Animating** | Strip moving left via CSS transform | `render()` called with increasing offset values |

**Transitions:**
- `Uninitialized → Loading`: `initialize(caseId)` called
- `Loading → Idle`: preload resolves; static strip rendered; `reel-ready` emitted
- `Idle → Animating`: first `render()` call from engine (cards rebuilt, transforms begin)
- `Animating → Idle`: engine reaches `onComplete`; `render()` stops; strip stays at final offset

### Interactions with Other Systems

| System | Direction | Interface | Notes |
|--------|-----------|-----------|-------|
| **Reel Animation Engine** (#5) | ↑ depends on | Provides `render(offset, strip)` as `onFrame` callback | Called on every RAF frame during spin |
| **Skin Image Loader** (#10) | ↑ depends on | `preloadCase(caseId)`, `getImage(imageUrl, rarity)` | Preload called in `initialize()`; getImage per card build |
| **Case Opening Orchestrator** (#9) | ↑ depends on | Provides `render` for `onFrame`; exposes `viewportWidth` | Orchestrator reads `viewportWidth` and passes `render` to engine |
| **App Shell / HUD** (#11) | ↓ depended on by | Listens for `reel-ready` DOM event | App Shell waits for `reel-ready` before allowing first open |

## Formulas

This system contains no mathematical formulas. Rendering is a direct CSS transform application.

#### F1: Strip Transform

```
reel-strip.style.transform = "translateX(-[offset]px)"
```

`offset` is provided per-frame by the Reel Animation Engine. No calculation occurs in the Reel UI.

#### F2: Pre-spin Center Offset

```
idle_offset = IDLE_CENTER_INDEX * reel_card_width
idle_offset = 30 * 250 = 7500px
```

Used to center the static strip on a mid-strip item during the pre-spin idle state.

## Edge Cases

**E1: `initialize()` called before container is mounted**
*Handling*: `preloadCase()` proceeds (network independent of DOM). Card DOM build waits until the container is available. `reel-ready` fires when both preload and DOM build complete.

**E2: `render()` called before `initialize()` completes**
Open button should be disabled until `reel-ready` fires, making this a UI bug path.
*Handling*: `render()` builds cards using `SkinImageLoader.getImage()` calls, which return rarity placeholders for un-preloaded images. Animation proceeds with placeholder art. No crash.

**E3: `render()` receives a strip of length !== 60**
*Handling*: Reel UI renders however many cards are provided. Logs a warning. No crash.

**E4: `reelViewport.offsetWidth` returns 0 (container not yet in DOM)**
*Handling*: Returns a fallback of 800px. The engine computes `targetOffset` using this value. Offset will be slightly off but animation completes.

**E5: Player resizes the browser window mid-spin**
`viewportWidth` is captured at spin start; resize changes the container width mid-animation.
*Handling*: Engine uses the captured width for the full spin. The selected item may not land precisely at the new center. Accepted MVP behavior.

**E6: Two consecutive spins (second spin's `render()` begins without a reset)**
*Handling*: On the first `render()` call of the new spin, the strip DOM is rebuilt using the new strip. Old card elements are replaced immediately. No visual gap.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Reel Animation Engine** (#5) | Provides per-frame `currentOffset` and `ReelStrip` | `render(offset, strip)` registered as `onFrame` callback |
| **Skin Image Loader** (#10) | Provides skin images for card rendering | `preloadCase(caseId)`, `getImage(imageUrl, rarity)` |
| **Case Opening Orchestrator** (#9) | Wires `onFrame` to the engine; reads `viewportWidth` | Orchestrator passes `ReelUI.render` to engine and reads `ReelUI.viewportWidth` at spin time |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they rely on |
|--------|-----------------|------------------|
| **App Shell / HUD** (#11) | Must know when images are preloaded before evaluating Open button | `reel-ready` DOM event |

**Pending GDD updates surfaced by this design:**
- **Reel Animation Engine GDD**: Add `onFrame(offset: number, strip: ItemEntry[]): void` to `ReelCallbacks` interface.
- **Case Opening Orchestrator GDD**: Add `onFrame: (offset, strip) => ReelUI.render(offset, strip)` to the `spin()` call; pass `viewportWidth: ReelUI.viewportWidth` to `spin()`.
- **App Shell / HUD GDD**: Add `reel-ready` event handling to the Open button evaluation notes.

## Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|------------|--------|
| `CARD_WIDTH_PX` | 250px | Must match `reel_card_width` (250px) | Card CSS width. Must stay in sync with the engine's `CARD_WIDTH` constant — changing one without the other breaks the stop position formula. |
| `IDLE_CENTER_INDEX` | 30 | 20–40 | Which card index is centered in the pre-spin idle state. Does not affect animation. |
| `CENTER_MARKER_VISIBLE` | true | true / false | Shows the notch/arrow at the viewport center. Disable only for screenshots — it is part of the authentic CS2 reel feel. |

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-RUI-01 | `initialize("recoil_case")` called | `preloadCase("recoil_case")` fires; on resolve, 60 card elements rendered in the DOM | BLOCKING |
| AC-RUI-02 | After `initialize()` completes | `reel-ready` DOM event fires; Reel UI shows static strip in Idle state | BLOCKING |
| AC-RUI-03 | `render(offset, strip)` called for the first time in a spin | 60 card DOM elements rebuilt using the provided `strip`; `transform: translateX(-[offset]px)` applied | BLOCKING |
| AC-RUI-04 | `render(500, strip)` called | `reel-strip.style.transform === "translateX(-500px)"` | BLOCKING |
| AC-RUI-05 | `render()` called 60 times with increasing offsets | Transform updates each call; card DOM elements are not rebuilt after the first call | BLOCKING |
| AC-RUI-06 | Card at index 0 | Has CSS class `rarity-[item.rarity]`; image src matches the item's image URL | BLOCKING |
| AC-RUI-07 | Card for an item with `null` image URL | Card renders with a rarity-colored placeholder (not broken image icon) | BLOCKING |
| AC-RUI-08 | `reelViewport.offsetWidth` when container is 1280px wide | Returns 1280 | BLOCKING |
| AC-RUI-09 | `reelViewport.offsetWidth` when container is not in DOM | Returns 800 (fallback) | BLOCKING |
| AC-RUI-10 | Each card's CSS width | Exactly 250px | BLOCKING |
