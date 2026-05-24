# ADR-0006: Animation Loop Ownership and Reel-to-UI Data Transport

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Animation / Rendering |
| **Knowledge Risk** | LOW — `requestAnimationFrame` is stable and pre-training-data |
| **References Consulted** | reel-animation-engine.md GDD, reel-ui.md GDD, case-opening-orchestrator.md GDD, ADR-0001 (module system), ADR-0002 (file structure), ADR-0003 (DOM events) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm `requestAnimationFrame` timestamp accuracy in all target browsers; confirm CSS `transform: translateX()` hardware acceleration is active without explicit `will-change: transform` in Chrome, Firefox, Edge, Safari |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (ES modules), ADR-0002 (Feature/Presentation layer structure) |
| **Enables** | ReelUI implementation (`src/presentation/reel-ui.js`), ReelAnimationEngine implementation (`src/feature/reel-animation-engine.js`) |
| **Blocks** | Reel Animation Engine and Reel UI — highest coupling point between these two modules; cannot be implemented until transport pattern is locked |
| **Ordering Note** | The reel-animation-engine.md GDD explicitly flags the data transport mechanism as an open implementation decision requiring an ADR. Must be Accepted before either module is written. |

## Context

### Problem Statement
The Reel Animation Engine (Feature layer) produces two values per animation frame: `currentOffset` (px, a float) and `ReelStrip` (an array of 60 `ItemEntry` objects). The Reel UI (Presentation layer) must consume these values each frame to apply a CSS `transform: translateX(-offset px)` and, on the first frame of a new spin, rebuild the 60 DOM card elements. The GDD explicitly defers the transport mechanism — "shared state object, per-frame callback, event emitter" — as an implementation decision for this ADR.

The transport choice is the highest coupling point in the entire architecture. The wrong choice creates either tight coupling between the engine and DOM (violating the GDD's stated design goal: "engine entirely DOM-free"), or unnecessary indirection that adds latency into a per-frame hot path.

### Constraints
- The Reel Animation Engine must remain entirely DOM-free — it must not import from `src/presentation/`
- The Reel UI must not contain any animation math — it must not import animation timing constants or ease curves from the engine
- The transport fires on every RAF frame during a ~7800ms spin — approximately 468 frames at 60fps. It is the hottest code path in the application.
- The engine owns the `requestAnimationFrame` loop — no other module starts or stops RAF
- The transport must carry two distinct values per frame: `offset: number` (changes every frame) and `strip: ItemEntry[]` (same reference every frame after the first)

### Requirements
- Engine must not hold a direct reference to DOM elements
- Reel UI must not hold a direct reference to animation timing state
- The transport must be synchronous — no async/await, no microtask queue latency
- The transport pattern must be testable in Vitest without a DOM (engine side) and without an animation loop (UI side)

## Decision

**Use the `onFrame` callback pattern. The Reel Animation Engine accepts an `onFrame` function in its `ReelCallbacks` parameter object and calls it directly on every RAF frame.**

- **Pattern**: caller-supplied callback, registered at `spin()` call time
- **Transport**: `onFrame(offset: number, strip: ItemEntry[])` — engine calls this on every RAF frame
- **Ownership**: ReelAnimationEngine owns the RAF loop entirely; ReelUI has no knowledge of RAF
- **Wiring point**: Orchestrator registers `(offset, strip) => ReelUI.render(offset, strip)` as the `onFrame` callback when calling `spin()`
- **Engine boundary**: Engine is DOM-free; it calls the callback with plain data; what the callback does is the UI's concern

### Full Callback Interface

```js
// ReelCallbacks — passed to ReelAnimationEngine.spin()
{
  onFrame:    (offset: number, strip: ItemEntry[]) => void,  // every RAF frame
  onTick:     (pitch: number) => void,                       // per card-boundary crossing
  onComplete: () => void,                                    // once, on animation end
}
```

### Wiring in Case Opening Orchestrator

```js
// src/feature/case-opening-orchestrator.js
import { ReelAnimationEngine } from './reel-animation-engine.js';
import { ReelUI }               from '../presentation/reel-ui.js';
import { AudioSystem }          from '../foundation/audio-system.js';

ReelAnimationEngine.spin(caseId, selectedItem, viewportWidth, {
  onFrame:    (offset, strip) => ReelUI.render(offset, strip),
  onTick:     (pitch)         => AudioSystem.playTick(pitch),
  onComplete: ()              => {
    AudioSystem.playReveal();
    ReelUI.lockOnResult();
    // ... post-spin logic
  },
});
```

### Architecture Diagram

```
Case Opening Orchestrator (Feature)
  │
  ├── ReelAnimationEngine.spin(caseId, item, vpWidth, callbacks)
  │     └── RAF loop (owned by RAE)
  │           ├── frame N: callbacks.onFrame(currentOffset, strip)  →  ReelUI.render()
  │           ├── tick:    callbacks.onTick(pitch)                   →  AudioSystem.playTick()
  │           └── done:    callbacks.onComplete()                    →  AudioSystem.playReveal()
  │
  └── (RAE is DOM-free — no import of reel-ui.js or any presentation module)
```

### ReelUI.render() Contract

```js
// src/presentation/reel-ui.js
export const ReelUI = {
  // Called every RAF frame by engine via onFrame callback.
  // First call of each spin: rebuilds 60 card DOM elements from strip.
  // All subsequent calls: applies CSS transform only (no DOM rebuild).
  render(offset, strip) {
    if (this._firstFrame) {
      this._buildCards(strip);
      this._firstFrame = false;
    }
    this._reelStrip.style.transform = `translateX(-${offset}px)`;
  },

  // ... initialize(), lockOnResult(), viewportWidth getter
};
```

## Alternatives Considered

### Alternative A: Shared mutable state object
- **Description**: RAE and ReelUI both import a shared `ReelState` object (`src/foundation/reel-state.js`). RAE writes `state.offset` and `state.strip` each frame; ReelUI reads from it in a separate RAF listener.
- **Pros**: Zero function-call overhead; RAE doesn't need to know anything about ReelUI.
- **Cons**: Introduces shared mutable state between two modules — violates state ownership rules (ADR-0003 established that state ownership must be explicit). Two separate RAF listeners risk firing in different order across browsers. ReelUI must start its own RAF loop, making two concurrent RAF loops. Testing requires inspecting shared state rather than asserting callback invocations.
- **Rejection Reason**: Shared mutable state between Feature and Presentation layer is an architecture smell. The callback pattern is already specified in the GDD and is cleaner.

### Alternative B: DOM CustomEvent per frame
- **Description**: RAE dispatches a `reel-frame` CustomEvent on `document` each frame with `{ detail: { offset, strip } }`. ReelUI listens with `document.addEventListener('reel-frame', ...)`.
- **Pros**: Fully decoupled — RAE doesn't import ReelUI; any module can listen.
- **Cons**: `CustomEvent` construction allocates a new object every frame (~468 allocations/spin). Event dispatch involves the browser's event queue, adding non-deterministic latency. The `detail` payload cannot be passed by reference without cloning in some browsers. This is a per-frame hot path — event overhead is measurable at 60fps.
- **Rejection Reason**: Per-frame DOM events on a 60fps loop introduce unnecessary allocation and dispatch overhead. The GDD already uses events for state changes (balance, inventory) but explicitly uses callbacks for the per-frame reel data. The callback is already in the `ReelCallbacks` interface defined in the GDD.

### Alternative C: RAE returns an async iterator / observable stream
- **Description**: `ReelAnimationEngine.spin()` returns an async iterator or RxJS Observable that yields `{ offset, strip }` per frame.
- **Pros**: Clean pull-based API; composable.
- **Cons**: `async/await` in the RAF loop introduces microtask queue overhead between frames. RxJS is a large dependency for a single use case. The GDD specifies a callback interface — changing to an observable would require GDD revision.
- **Rejection Reason**: Async introduces latency in a synchronous per-frame path. Zero need for observable composition in this app.

## Consequences

### Positive
- Engine is completely DOM-free — it calls a function pointer with numbers; it has no import of any presentation code
- ReelUI has no knowledge of RAF, timing curves, or animation math — it receives `(offset, strip)` and applies a CSS transform
- The wiring is explicit and readable in the Orchestrator — one place shows exactly which modules wire together
- Both modules are independently testable: RAE with a mock `onFrame` spy; ReelUI by calling `render(offset, strip)` directly in tests

### Negative
- Orchestrator must always supply `onFrame` in the callbacks object — a missing callback causes a silent no-op (RAE must guard: `if (callbacks.onFrame) callbacks.onFrame(offset, strip)`)
- The callback pattern requires the caller (Orchestrator) to understand both sides of the interface

### Risks
- **Dropped frames**: If `ReelUI.render()` is slow (>16ms), the RAF loop falls behind. Mitigation: `render()` should do nothing except a CSS transform on non-first frames — this is O(1) and takes <0.1ms.
- **Missing onFrame guard**: If Orchestrator omits `onFrame`, the strip never renders. Mitigation: RAE checks `typeof callbacks.onFrame === 'function'` before calling; throws a `ReelError` in debug mode.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| reel-animation-engine.md | `onFrame: (offset, strip) => void` in `ReelCallbacks` | Callback pattern adopted exactly as GDD specifies |
| reel-animation-engine.md | Engine must be DOM-free | Callback is a function pointer — engine imports no DOM or presentation module |
| reel-animation-engine.md | Open Q: transport mechanism (callback / shared state / event) | Resolved: `onFrame` callback |
| reel-ui.md | `render(offset, strip)` — called by engine via `onFrame` | `ReelUI.render` registered as `onFrame` in Orchestrator |
| reel-ui.md | First `render()` call rebuilds card DOM; all subsequent update transform only | Implemented by `_firstFrame` flag in `render()` |
| case-opening-orchestrator.md | Wires `onFrame: (offset, strip) => ReelUI.render(offset, strip)` | Explicit wiring in Orchestrator `spin()` call |

## Performance Implications
- **CPU**: `onFrame` callback is a direct function call — ~0.001ms overhead per frame. CSS `translateX` is GPU-composited in all modern browsers — 0ms main-thread paint cost.
- **Memory**: Strip array reference passed by reference on frames 2+; no allocation per frame after first. One `ItemEntry[]` reference held for the spin duration.
- **Load Time**: None — no additional modules
- **Network**: None

## Migration Plan
No existing source code — greenfield. Both `src/feature/reel-animation-engine.js` and `src/presentation/reel-ui.js` are written to this spec.

## Validation Criteria
- `ReelAnimationEngine.spin()` calls `onFrame` on every RAF frame during a spin
- A mock `onFrame` spy records exactly one call per RAF frame in Vitest (mocked `requestAnimationFrame`)
- `ReelUI.render(offset, strip)` sets `reel-strip.style.transform = 'translateX(-[offset]px)'`
- `ReelUI.render()` rebuilds card elements on the first call of a spin and not on subsequent calls
- RAE does not import any module from `src/presentation/`
- ReelUI does not import any module from `src/feature/`

## Related Decisions
- ADR-0002: Feature layer (`reel-animation-engine.js`) and Presentation layer (`reel-ui.js`) — upward imports forbidden
- ADR-0003: DOM events used for state changes (balance, inventory) but NOT for per-frame reel data
- ADR-0004: `onTick` callback follows same pattern — engine calls AudioSystem.playTick via Orchestrator callback
- reel-animation-engine.md: GDD that defines `ReelCallbacks` interface and defers transport to this ADR
- reel-ui.md: GDD that defines `render(offset, strip)` as the UI's onFrame handler
