# Reel Animation Engine

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Faithful Over Flashy · Zero Friction

## Overview

The Reel Animation Engine drives the horizontal scrolling item strip that is the visual centerpiece of every case open. It is a pure animation system: given a selected `ItemEntry` (from the Drop Rate Engine) and a full item pool (from the Case Data Store), it constructs a shuffled reel strip, calculates where the selected item must land, then drives a time-based ease-out animation from full speed to stop — firing tick events as it runs and a completion event when the selected item reaches the center window.

The engine owns the animation math but not the rendering. The Reel UI translates engine state (current strip offset, per-frame position) into DOM mutations and CSS transforms. This separation means the engine is testable independently of the browser, and the rendering layer can be swapped without touching the animation logic.

At the player level, this system is the simulator. The reel's initial speed creates anticipation; the long deceleration tail produces the "will it land on something rare?" tension; the precise stop on the selected item delivers the reveal. Every timing parameter — duration, easing curve, stop offset randomization — was validated in the concept prototype using ease-out-quint easing over a ~7.8 s spin. Those values are built into the engine's defaults.

**MVP scope**: Single reel strip, one case open at a time. No simultaneous animations, no multi-case parallel opening.

## Player Fantasy

The reel animation is the moment every CS2 player is opening the simulator to experience. Not the menu. Not the inventory. The reel. The blur of item cards at full speed, the gradual deceleration as items slow to legibility, the drawn-out final seconds where the selected item crawls into the center window — this is the specific feeling the simulator promises and must deliver.

Players who've opened real CS2 cases carry a precise internal model of how this animation feels. They know the speed, the deceleration curve, the final slowdown. An animation that's too fast feels cheap; too slow feels padded; a different easing curve feels wrong in a way most players can't name but everyone notices. The bar is not "a reel animation" — it is *that* reel animation.

The engine succeeds when a CS2 veteran opens their first case in the simulator, says nothing, and immediately clicks Open again. It fails the moment someone says "the animation feels off." Any deviation from CS2's authentic timing pattern breaks the core promise of "Faithful Over Flashy" at the simulator's most visible moment.

## Detailed Design

### Core Rules

1. **Entry point**: The engine exposes one method to start an animation:
   `spin(caseId: string, selectedItem: ItemEntry, viewportWidth: number, callbacks: ReelCallbacks): void`

   `viewportWidth` is the pixel width of the reel viewport container, read from `ReelUI.viewportWidth` at call time. It is used to calculate `targetOffset` (see Rule 4). Passing the correct value is the Orchestrator's responsibility.

   `ReelCallbacks` is an object with three functions:
   ```
   {
     onFrame: (offset: number, strip: ItemEntry[]) => void, // fires every RAF frame; pass to ReelUI.render
     onTick: (pitch: number) => void,    // fires on each reel tick; pitch in [220, 880] Hz
     onComplete: () => void              // fires when animation is fully stopped
   }
   ```

   `onFrame` is called once per `requestAnimationFrame` tick with the current `currentOffset` and the full `ReelStrip` array. The first call of each spin passes the full strip (so the Reel UI can rebuild card DOM elements); all subsequent calls pass the same strip reference. The Reel UI wires `ReelUI.render` as `onFrame`.

2. **Strip construction**: Before animation begins, the engine builds a `ReelStrip` — an ordered array of `ItemEntry` objects to display left-to-right on the reel:
   - Fetch all items via `getAllItems(caseId)` from the Case Data Store (flat array across all tiers).
   - Shuffle the flat pool randomly.
   - The selected item is placed at a fixed index near the end of the strip: index 55 (of a 60-item strip). This ensures ample visual scroll distance before the selected item arrives.
   - Positions [0–54] are filled by cycling the shuffled pool (repeating items is acceptable and expected — the strip is longer than the unique item pool).
   - Positions [56–59] are padding items (any items from the pool) to ensure the strip extends past the window after the selected item.

3. **Card width**: Each item card on the reel is **250 px wide**, including its border and spacing. This is a layout constant shared with the Reel UI.

4. **Stop position**: The selected item (at index 55) must stop at the **center of the viewport window**. The target strip offset in pixels is:
   ```
   targetOffset = (selectedIndex * cardWidth) - (viewportWidth / 2 - cardWidth / 2) + stopOffset
   ```
   Where `stopOffset` is a random value in `[-30, +30]` px to prevent the item from always landing perfectly at center (adds realism). This value is chosen once per `spin()` call and held fixed.

5. **Animation loop**: Runs via `requestAnimationFrame`. On each frame:
   ```
   elapsed = currentTime - startTime   // ms
   progress = min(elapsed / duration, 1.0)
   easedProgress = easeOutQuint(progress)
   currentOffset = easedProgress * targetOffset
   ```
   The Reel UI reads `currentOffset` to position the strip. The animation loop continues until `progress >= 1.0`.

6. **Ease-out-quint function**:
   ```
   easeOutQuint(t) = 1 - (1 - t)^5
   ```
   This function is internal to the engine. Its output is in [0, 1].

7. **Animation duration**: Default 7800 ms (7.8 s), validated in the concept prototype. Stored as the `SPIN_DURATION_MS` tuning constant.

8. **Tick events**: On each animation frame where the strip has moved by at least one `cardWidth` pixel beyond the last tick position:
   - Fire `onTick(pitch)` where `pitch` is calculated from current velocity (see Formulas section).
   - Update the last-tick position to the current position.
   - The tick rate decreases naturally as the reel decelerates — no explicit tick rate calculation is needed.

9. **Completion**: When `progress >= 1.0`, the animation loop exits. `currentOffset` is set exactly to `targetOffset` (no drift). `onComplete()` is fired exactly once.

10. `spin()` must not be called while an animation is already in progress. The engine is single-animation only — calling `spin()` a second time before `onComplete()` fires is a caller error. The engine will throw `ReelError("Animation already in progress")`.

11. The engine reads the Case Data Store once at `spin()` call time to build the strip. It does not hold a persistent reference to case data between calls.

### States and Transitions

| State | Description |
|-------|-------------|
| **Idle** | No animation running; engine ready for `spin()` |
| **Spinning** | `requestAnimationFrame` loop active; `onTick()` events firing |
| **Complete** | Animation finished; `onComplete()` fired; engine returns to Idle |

**Transitions:**
- `Idle → Spinning`: `spin()` called with valid arguments
- `Spinning → Complete`: `progress >= 1.0` — loop exits, `onComplete()` fires
- `Complete → Idle`: automatic, immediately after `onComplete()` fires
- `Idle → Idle` (error): `spin()` called while Idle with invalid `caseId` → throws `ReelError`
- `Spinning → Spinning` (error): `spin()` called while already Spinning → throws `ReelError("Animation already in progress")`

### Interactions with Other Systems

| System | Direction | What flows |
|--------|-----------|------------|
| **Case Data Store** | Engine → Case Data Store | `getAllItems(caseId)` to build the ReelStrip at spin start |
| **Reel UI** | Engine → Reel UI | `currentOffset` (px) on every frame; `ReelStrip` (ItemEntry[]) at spin start for card rendering |
| **Case Opening Orchestrator** | Orchestrator → Engine | Calls `spin(caseId, selectedItem, callbacks)`; receives `onTick` and `onComplete` events |
| **Audio System** | Engine → (via Orchestrator) | Engine fires `onTick(pitch)`; Orchestrator calls `Audio.playTick(pitch)` |

The Reel UI does not call the engine — it only reads the data the engine pushes to it (offset and strip). The Orchestrator owns the wiring between engine events and Audio System calls.

## Formulas

### Frame Position Formula

The position of the strip in pixels at each animation frame:

```
elapsed = clamp(currentTime - startTime, 0, SPIN_DURATION_MS)   // ms
t = elapsed / SPIN_DURATION_MS                                    // linear progress [0, 1]
currentOffset = easeOutQuint(t) * targetOffset                   // px
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Elapsed time | `elapsed` | float | [0, SPIN_DURATION_MS] | ms since `spin()` was called; clamped to duration |
| Linear progress | `t` | float | [0, 1] | Fraction of animation duration elapsed |
| Current strip offset | `currentOffset` | float | [0, targetOffset] | Pixels scrolled from strip origin; fed to Reel UI each frame |

**Output range**: `[0, targetOffset]` px. At `t = 0`: strip at origin. At `t = 1`: strip at exact stop position.

---

### Ease-Out-Quint Function

Converts linear progress `t` to a non-linear eased value, producing a fast start and long decelerating tail:

```
easeOutQuint(t) = 1 - (1 - t)^5
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Linear progress | `t` | float | [0, 1] | `elapsed / SPIN_DURATION_MS` |
| Eased progress | `easeOutQuint(t)` | float | [0, 1] | Non-linear multiplier for `targetOffset` |

**Output range**: `[0, 1]`.

**Velocity implication**: The derivative `d/dt[easeOutQuint(t)] = 5(1-t)^4` equals 5 at `t = 0` and decays to 0 at `t = 1`. The peak pixel velocity is therefore `targetOffset × 5 / SPIN_DURATION_S ≈ targetOffset × 0.64 px/ms`. The time-average velocity is `targetOffset / SPIN_DURATION_S ≈ targetOffset × 0.128 px/ms`. Peak is approximately 5× average.

*Calibration note*: The 7800 ms default was validated in the concept prototype using 170 px cards at index 42 (total scroll ~7140 px). Production uses 250 px cards at index 55 (total scroll ~13235 px). The easing shape is validated; the absolute duration may need fine-tuning during production testing. SPIN_DURATION_MS is a tuning knob.

---

### Stop Position Formula

Calculates the total pixel distance the strip must scroll to center the selected item in the viewport:

```
targetOffset = (selectedIndex * CARD_WIDTH) - (viewportWidth / 2 - CARD_WIDTH / 2) + stopOffset
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Selected item index | `selectedIndex` | int | 55 (fixed) | Position of selected item in the ReelStrip |
| Card width | `CARD_WIDTH` | int | 250 px | Width of each item card including border and spacing |
| Viewport width | `viewportWidth` | int | ≥ 600 px | Width of the reel viewport window; see Edge Cases for minimum |
| Stop offset | `stopOffset` | float | [-30, +30] px | Random offset chosen once per `spin()` call |
| Target offset | `targetOffset` | float | > 0 px | Total px the strip scrolls; fed to Frame Position Formula |

**Example** (1280 px viewport, `stopOffset = -18`):
```
targetOffset = (55 × 250) - (1280/2 - 250/2) + (-18)
             = 13750 - 515 - 18
             = 13217 px
```

**Constraint**: `viewportWidth ≥ CARD_WIDTH` is required for this formula to produce a positive `targetOffset`. Below that threshold the centering geometry inverts. Minimum supported viewport width: 600 px (see Edge Cases).

---

### Tick Detection Formula

Determines when a card boundary has been crossed and a tick sound should fire:

```
cardsCrossed = floor(currentOffset / CARD_WIDTH)
if cardsCrossed > lastTickCard:
    onTick(pitch)
    lastTickCard = cardsCrossed
```

Initialize `lastTickCard = 0` at spin start. First tick fires when `currentOffset ≥ CARD_WIDTH` (250 px). No spurious tick fires at frame 0.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Cards crossed | `cardsCrossed` | int | 0 – selectedIndex | Total card boundaries crossed so far |
| Last tick card | `lastTickCard` | int | 0 – selectedIndex | Card index at which the most recent tick fired; init = 0 |

---

### Tick Pitch Formula

Calculates the pitch of the tick sound fired on each card boundary crossing. Pitch is proportional to instantaneous strip velocity:

```
if frameDeltaMs > 0:
    velocity = (currentOffset - prevOffset) / (frameDeltaMs / 1000)   // px/s
else:
    velocity = 0   // guard: skip pitch calculation on zero-delta frame

maxVelocity = targetOffset / (SPIN_DURATION_MS / 1000) * 5             // px/s; computed per spin
velocity_norm = clamp(velocity / maxVelocity, 0, 1)
pitch = PITCH_LOW + velocity_norm * (PITCH_HIGH - PITCH_LOW)
```

Initialize `prevOffset = 0` before the first frame. Update `prevOffset = currentOffset` after each frame's tick check.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Frame delta | `frameDeltaMs` | float | ≥ 0 ms | Time between consecutive RAF frames; 0 is guarded |
| Previous offset | `prevOffset` | float | [0, targetOffset] | Strip position at previous frame; init = 0 |
| Instantaneous velocity | `velocity` | float | 0 – maxVelocity px/s | Strip speed at the current frame |
| Max velocity | `maxVelocity` | float | ~targetOffset × 0.64 px/ms | Computed per-spin from actual `targetOffset`; approximation of peak speed at `t = 0` |
| Normalized velocity | `velocity_norm` | float | [0, 1] | Velocity as fraction of maximum; clamped |
| Tick pitch | `pitch` | float | [220, 880] Hz | Passed to `onTick(pitch)` callback |

**Output range**: 220 Hz (`PITCH_LOW` — reel at rest or near-stop) to 880 Hz (`PITCH_HIGH` — peak speed). These match registry constants `tick_pitch_low` (220 Hz) and `tick_pitch_high` (880 Hz) owned by the Audio System GDD.

**Final tick behavior**: In the last 1–2 seconds of the spin, velocity approaches 0 and tick rate drops significantly. The final ticks fire at near-220 Hz pitch — this is the intended behavior, matching CS2's authentic low-pitch final tick sequence.

## Edge Cases

- **If `getAllItems(caseId)` returns an empty array** (case not found or case has no items): `spin()` throws `ReelError("Cannot build strip for case [caseId]: no items")`. Defensive guard — should not occur with a valid Case Data Store.

- **If `spin()` is called while an animation is already in progress**: `spin()` throws `ReelError("Animation already in progress")`. The Orchestrator must wait for `onComplete()` before calling `spin()` again.

- **If `viewportWidth < 600 px`**: Below the supported minimum width. The engine clamps `stopOffset = 0` and proceeds, but visual output may be incorrect. The Reel UI is responsible for enforcing the minimum viewport width constraint.

- **If `viewportWidth < CARD_WIDTH` (250 px)**: The stop position formula's centering geometry inverts. The animation runs but the selected item will not land at the center of the visible window. Not a supported viewport size.

- **If `requestAnimationFrame` is not available** (non-browser environment): `spin()` throws immediately. The engine requires a browser context — this is not a handled error condition.

- **If `frameDeltaMs = 0`** (two consecutive RAF callbacks in the same millisecond — rare): The velocity guard returns `velocity = 0` and `pitch = PITCH_LOW = 220 Hz`. The frame still advances `currentOffset` normally. No crash. No tick fires on a zero-delta frame.

- **If `stopOffset` lands exactly on a card seam** (i.e., ±125 px — half a card width): The selected item stops half-in, half-out of center. Probability is negligible. Acceptable visual result.

- **If the same case is opened multiple times in sequence**: Each `spin()` call re-randomizes the strip shuffle independently. The selected item is always at index 55; it may also appear elsewhere in positions [0–54] via the cycled pool.

- **If `onComplete()` fires and the player immediately clicks Open again**: The engine transitions to Idle immediately after `onComplete()`. `spin()` can be called again at that point — it rebuilds the strip and restarts. The Reel UI must handle the visual transition between consecutive animations.

## Dependencies

### Upstream Dependencies

| System | What it needs | Hard/Soft |
|--------|--------------|-----------|
| **Case Data Store** | `getAllItems(caseId)` — flat item pool for strip construction | Hard — cannot build a strip without item data |

The Case Data Store must be in `Loaded` state before `spin()` is callable.

### Downstream Dependents

| System | What it needs | Hard/Soft | Pending GDD |
|--------|--------------|-----------|-------------|
| **Case Opening Orchestrator** | `spin(caseId, selectedItem, callbacks)` — drives the case open sequence | Hard | Not yet designed |
| **Reel UI** | `ReelStrip` (ItemEntry[]) at spin start; `currentOffset` (px) on every frame | Hard | Not yet designed |

Hard means neither dependent can function without this engine.

### Interface Contract

The Reel Animation Engine exposes one method:

| Method | Signature | Behavior |
|--------|-----------|----------|
| `spin(caseId, selectedItem, callbacks)` | `(string, ItemEntry, ReelCallbacks): void` | Builds strip, runs animation loop, fires `onTick(pitch)` per card crossing, fires `onComplete()` on finish; throws `ReelError` on invalid state |

`ReelCallbacks` interface:
```
{
  onTick: (pitch: number) => void
  onComplete: () => void
}
```

The engine pushes `currentOffset` and `ReelStrip` to the Reel UI each frame. The exact mechanism (shared state object, callback, event) is an implementation decision for the ADR — the GDD specifies the data, not the transport.

## Tuning Knobs

| Knob | Current Value | Safe Range | Change Risk |
|------|--------------|------------|-------------|
| **`SPIN_DURATION_MS`** | 7800 ms | 5000–12000 ms | **MEDIUM** — prototype-validated at 7800 ms with 170 px cards. With 250 px production cards, re-validate during implementation. Below 5 s feels rushed; above 10 s feels padded. |
| **`CARD_WIDTH`** | 250 px | 170–300 px | **HIGH** — changes the stop position formula's pixel distances and the tick detection rate. Changing requires re-testing the animation feel end-to-end. Must stay in sync with the Reel UI's card CSS width. |
| **`selectedIndex`** | 55 (of 60) | 40–58 | **LOW** — position of the selected item in the strip. Must stay far enough from 0 that the strip travels a meaningful visible distance before stopping. |
| **`STRIP_LENGTH`** | 60 items | 45–80 | **LOW** — total items in the strip. Must be > `selectedIndex + 4` (padding). Increasing does not change feel; decreasing below `selectedIndex + 2` will cause the strip to visually end before the animation completes. |
| **`stopOffset` range** | [-30, +30] px | [-60, +60] px | **LOW** — random variation in final landing position. Above ±60 px is noticeable on most screens; clamp to 0 on viewports narrower than 800 px. |
| **`PITCH_LOW`** | 220 Hz | 150–330 Hz | **MEDIUM** — must match `tick_pitch_low` registry constant (220 Hz, owned by Audio System GDD). Changing requires updating the registry and Audio System GDD. |
| **`PITCH_HIGH`** | 880 Hz | 660–1200 Hz | **MEDIUM** — must match `tick_pitch_high` registry constant (880 Hz, owned by Audio System GDD). Same cross-GDD constraint. |

**Key interaction**: `CARD_WIDTH` and `SPIN_DURATION_MS` are coupled. Increasing card width increases `targetOffset` proportionally, raising peak and average pixel velocity at the same duration — the animation will feel faster. Adjust `SPIN_DURATION_MS` upward when increasing `CARD_WIDTH`.

## Acceptance Criteria

*(Reviewed by `qa-lead` — lean mode Section H gate.)*

**AC-01 — Happy path: spin() completes and onComplete() fires**

GIVEN the engine is in Idle state and a valid `caseId` with a non-empty item pool is provided,
WHEN `spin(caseId, selectedItem, { onTick, onComplete })` is called and a mock RAF advances through 7800 ms of timestamps,
THEN the animation completes, the engine transitions to Complete state, and `onComplete()` is invoked exactly once.

---

**AC-02 — ReelStrip: selected item is at index 55**

GIVEN a valid `spin()` call with a known `selectedItem`,
WHEN the ReelStrip is built internally before animation begins,
THEN `strip[55]` is strictly equal to `selectedItem` (same object reference or identical `ItemEntry` id).

---

**AC-03 — ReelStrip: strip length is exactly 60 items**

GIVEN a valid `spin()` call with an item pool containing at least one item,
WHEN the ReelStrip is built,
THEN `strip.length === 60`.

---

**AC-04 — Animation: currentOffset starts at 0 and ends at targetOffset**

GIVEN a mock RAF that injects timestamps (t=0, t=100, t=200, ..., t≥7800),
AND `Math.random` stubbed to return a fixed `stopOffset`,
WHEN the first RAF frame fires at t=0, THEN `currentOffset = 0 px`,
AND after the final frame where `elapsed >= 7800 ms`, `currentOffset === targetOffset` (within floating-point epsilon of 0.001 px).

---

**AC-05 — Animation: currentOffset is monotonically non-decreasing**

GIVEN a mock RAF advancing in 100 ms fixed steps from t=0 to t=8000,
WHEN each frame records `currentOffset` into an array,
THEN for every consecutive pair: `offsets[i+1] >= offsets[i]` — no frame produces a smaller offset than its predecessor.

---

**AC-06 — Animation: progress clamps at 1.0, no overshoot**

GIVEN a mock RAF that delivers a frame timestamp of t=99999 ms (far past SPIN_DURATION_MS),
WHEN that frame fires,
THEN the easing progress value used is clamped to 1.0,
AND `currentOffset === targetOffset` (not greater).

---

**AC-07 — onTick: fires at least 52 times per spin**

GIVEN a mock RAF advancing in 100 ms steps through a full 7800 ms spin,
WHEN the spin completes,
THEN `onTick` has been called ≥ 52 times (corresponding to crossing at least 52 of the 60 card boundaries at 250 px each).

---

**AC-08 — onTick: pitch is always within [220, 880] Hz**

GIVEN a mock RAF spin with 100 ms fixed steps,
WHEN `onTick(pitch)` fires on every tick throughout the animation,
THEN every recorded `pitch` satisfies `220 <= pitch <= 880`.

---

**AC-09 — onTick: tick density is higher in the first half than the second half**

GIVEN tick timestamps collected for each `onTick` call during a full spin,
WHEN the animation completes,
THEN the count of ticks fired during elapsed [0, 3900) ms is strictly greater than the count of ticks fired during elapsed [3900, 7800] ms
(ease-out-quint produces high velocity early, crossing 250 px boundaries faster, slowing near the end).

---

**AC-10 — Error: spin() while Spinning throws ReelError**

GIVEN the engine is in Spinning state,
WHEN `spin()` is called a second time before `onComplete()` fires,
THEN a `ReelError` is thrown with message `"Animation already in progress"`,
AND the in-progress animation is not interrupted.

---

**AC-11 — Error: empty item pool throws ReelError**

GIVEN a `caseId` whose `getAllItems()` returns an empty array,
WHEN `spin(caseId, selectedItem, callbacks)` is called,
THEN a `ReelError` is thrown with message `"Cannot build strip for case [caseId]: no items"`,
AND the engine remains in Idle state,
AND `onComplete()` is never called.

---

**AC-12 — Frame-0 guard: zero frameDeltaMs does not throw**

GIVEN a mock RAF that delivers the first frame with timestamp 0 (making `frameDeltaMs = 0` on frame 0),
WHEN that frame is processed,
THEN no exception is thrown,
AND if a tick fires on frame 0, the pitch passed to `onTick` is 220 Hz (PITCH_LOW, corresponding to `velocity_norm = 0`).

---

**AC-13 — onComplete() fires exactly once per spin**

GIVEN a mock RAF advancing through a complete spin,
WHEN the animation finishes,
THEN `onComplete()` has been called exactly once — not zero times, not two or more times,
AND no subsequent RAF frame invokes `onComplete()` again.

---

**AC-14 — After onComplete(), a new spin() call is accepted**

GIVEN a `spin()` has completed and `onComplete()` has fired (engine is back in Idle state),
WHEN `spin()` is called again with a valid `caseId` and item pool,
THEN no `ReelError` is thrown,
AND the new animation begins (`currentOffset` resets to 0, `prevOffset` resets to 0, `lastTickCard` resets to 0).

---

**AC-15 — stopOffset is within [-30, +30] px**

GIVEN 1000 calls to `spin()` with recorded `stopOffset` values,
WHEN all `stopOffset` values are collected,
THEN every value satisfies `-30 <= stopOffset <= 30`,
AND at least two distinct values appear across the sample (confirming randomness is applied, not a fixed constant).

## Open Questions

- **SPIN_DURATION_MS re-validation**: The 7800 ms duration was validated with 170 px cards (prototype). Production uses 250 px cards, meaning the strip travels ~85% more pixels in the same time. The easing shape is validated; the absolute duration may need adjustment. *Resolution: tune during production implementation by feel-testing with real skin images and the full 250 px card layout.*

- **Reel UI data transport**: The engine produces `currentOffset` (px) and `ReelStrip` (ItemEntry[]) per frame. The exact transport mechanism (shared state object, per-frame callback, event emitter) is an implementation decision. *Resolution: design in `/architecture-decision reel-data-transport` before implementation — this is the highest coupling point between the engine and Reel UI.*

- **Strip shuffle deduplication**: Fisher-Yates shuffle of the item pool for positions [0–54] may produce the same item in adjacent positions, which looks odd visually (two identical cards side-by-side on the reel). *Resolution: implement Fisher-Yates first; evaluate visually during production testing. If adjacent duplicates are visually jarring, add a deduplication pass.*

- **Viewport width at runtime**: The stop position formula requires `viewportWidth` as input. Who provides this value — the Orchestrator (who calls `spin()`), or the engine (who measures the DOM directly)? *Resolution: define in the Case Opening Orchestrator GDD — the Orchestrator should own viewport measurement and pass it to `spin()` to keep the engine DOM-independent and testable.*
