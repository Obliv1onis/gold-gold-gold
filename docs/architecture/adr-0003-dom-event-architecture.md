# ADR-0003: DOM Event Architecture

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Core / Web Platform |
| **Knowledge Risk** | LOW — DOM CustomEvent API is stable and pre-training-data |
| **References Consulted** | ADR-0001 (module system), ADR-0002 (file structure), cross-GDD review W-5 advisory |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm CustomEvent `detail` payload is accessible as `event.detail` in all target browsers (Chrome, Firefox, Edge, Safari) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001, ADR-0002 |
| **Enables** | All Core and Feature modules that fire state-change events; all Presentation modules that subscribe |
| **Blocks** | VirtualEconomy, CaseInventory, SkinInventory, PriceAPILayer, HUD/AppShell, InventoryUI, CaseBrowserUI, MarketBrowserUI — cannot implement event dispatch or subscription until this is Accepted |
| **Ordering Note** | Must be Accepted before any module that dispatches or listens to an event is implemented. |

## Context

### Problem Statement
Four DOM events are defined across the GDDs. Three fire on `document` (balance-changed, case-inventory-changed, skin-inventory-changed); one fires on `window` (price-updated). This inconsistency was flagged as W-5 in the cross-GDD review. Without a canonical standard, future events will perpetuate the split and listeners must check two targets. Additionally, event name strings are scattered as inline literals — a typo (`"balance_changed"` instead of `"balance-changed"`) fails silently with no runtime error.

### Constraints
- Single-page app with no component mount/unmount lifecycle — listener cleanup is not required
- All dispatchers are Core/Feature layer; all listeners are Presentation/Feature — event flow is always upward (no circular event dependencies)
- Events must carry a `detail` payload so listeners do not need to call back into the dispatching module to read new state

### Requirements
- One canonical event target for all application events
- Event name strings defined in one shared location — no inline string literals in module files
- Payload shape defined per event
- Pattern must be Vitest-testable: synthetic CustomEvents can be dispatched on `document` in tests

## Decision

**Standardize all events on `document`. Use raw `CustomEvent`. Define all event name constants in `src/foundation/events.js`.**

- **Target**: `document` for ALL application events (including `price-updated` — moved from `window`, resolves W-5)
- **Mechanism**: `document.dispatchEvent(new CustomEvent(Events.NAME, { detail: { ... } }))`
- **Constants**: `src/foundation/events.js` — named `Events` object with all event name strings
- **No abstraction**: No EventBus wrapper. Direct `document.dispatchEvent` / `document.addEventListener` using the constants

### Event Name Constants File

```js
// src/foundation/events.js

export const Events = {
  // Core layer — game state changes
  BALANCE_CHANGED:        'balance-changed',
  CASE_INVENTORY_CHANGED: 'case-inventory-changed',
  SKIN_INVENTORY_CHANGED: 'skin-inventory-changed',

  // Feature layer — async data
  PRICE_UPDATED:          'price-updated',

  // Presentation layer — UI readiness
  REEL_READY:             'reel-ready',
};
```

### Dispatch Pattern (Core / Feature module)

```js
// src/core/virtual-economy.js
import { Events } from '../foundation/events.js';

export const VirtualEconomy = {
  spend(amount) {
    // ...mutate _balance...
    document.dispatchEvent(new CustomEvent(Events.BALANCE_CHANGED, {
      detail: { balance: _balance }
    }));
  }
};
```

### Subscribe Pattern (Presentation module)

```js
// src/presentation/hud-app-shell.js
import { Events } from '../foundation/events.js';

document.addEventListener(Events.BALANCE_CHANGED, ({ detail }) => {
  updateBalanceDisplay(detail.balance);
});
```

### Event Payload Contracts

| Event | Constant | Fired By | `detail` shape | Listeners |
|-------|----------|----------|---------------|-----------|
| `balance-changed` | `Events.BALANCE_CHANGED` | VirtualEconomy | `{ balance: number }` | HUD, CaseBrowserUI |
| `case-inventory-changed` | `Events.CASE_INVENTORY_CHANGED` | CaseInventory | `{ caseId: string, count: number }` | HUD |
| `skin-inventory-changed` | `Events.SKIN_INVENTORY_CHANGED` | SkinInventory | `{ inventory: SkinEntry[] }` | InventoryUI, HUD |
| `price-updated` | `Events.PRICE_UPDATED` | PriceAPILayer | `{ itemId: string, price: number, source: string }` | MarketBrowserUI |
| `reel-ready` | `Events.REEL_READY` | ReelUI | `{}` (no payload) | HUD/AppShell |

### W-5 Resolution

`price-updated` is moved from `window` to `document` (one-line change in PriceAPILayer). No functional difference in a single-frame app — both targets are reachable from any listener — but standardizing eliminates the failure mode where a listener registers on the wrong target and silently never fires.

## Alternatives Considered

### Alternative A: Standardize on `window`
- **Description**: Move all 3 Core events to `window` to match `price-updated`'s existing target.
- **Pros**: No change to `price-updated`; `window` is the global and always reachable.
- **Cons**: `window` semantically belongs to browser-level events (resize, popstate, beforeunload). App-internal state events on `window` mix concerns. 3 of 4 GDD events already use `document` — moving them to `window` changes more.
- **Rejection Reason**: `document` is the correct semantic target for app-internal events. Moving 3 events to match 1 is the wrong direction.

### Alternative B: EventBus abstraction module
- **Description**: A `src/foundation/event-bus.js` module wrapping a private `new EventTarget()` instance, exposing `EventBus.dispatch(name, detail)` and `EventBus.subscribe(name, handler)`.
- **Pros**: Event target hidden as implementation detail; isolated from browser-level events; easy to swap in tests.
- **Cons**: Adds indirection; all 17 GDD "listens to" sections document `document.addEventListener` — an EventBus would require updating all of them; importing the bus in tests adds minor friction; solves a problem that doesn't exist at this scale.
- **Rejection Reason**: The constants file solves the typo-safety problem without abstraction. The app is 17 modules; EventBus overhead is not justified.

## Consequences

### Positive
- All events have one target — listeners never need to guess `document` vs `window`
- `Events.BALANCE_CHANGED` is refactor-safe and auto-completed by IDEs; inline `'balance-changed'` is not
- `src/foundation/events.js` is the single file to check for all events in the system
- Dispatching synthetic events in Vitest is straightforward: `document.dispatchEvent(new CustomEvent(Events.BALANCE_CHANGED, { detail: { balance: 100 } }))`

### Negative
- `price-api-layer.md` GDD must be updated (W-5 fix — done alongside this ADR)
- Any existing prototype code using `window.dispatchEvent` for `price-updated` must be changed

### Risks
- **New event names not added to constants file**: A developer adds a new event with an inline string literal. Mitigation: code review rule — all event strings must use `Events.*` constants. A Vitest test can assert no inline string matches the known event name patterns in `src/`.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| virtual-economy.md | Fires `balance-changed` on `document` on spend/earn/reset | `Events.BALANCE_CHANGED` on `document` — standardized |
| case-inventory.md | Fires `case-inventory-changed` on `document` | `Events.CASE_INVENTORY_CHANGED` on `document` — standardized |
| skin-inventory.md | Fires `skin-inventory-changed` on `document` | `Events.SKIN_INVENTORY_CHANGED` on `document` — standardized |
| price-api-layer.md | Fires `price-updated` on `window` (W-5 advisory) | Moved to `document`, `Events.PRICE_UPDATED` — W-5 resolved |
| reel-ui.md | Fires `reel-ready` on `document` after preload | `Events.REEL_READY` on `document` — standardized |
| hud-app-shell.md | Listens to `balance-changed`, `case-inventory-changed`, `skin-inventory-changed` | All on `document` via `Events.*` constants |
| market-browser-ui.md | Listens to `price-updated` | Now on `document` (moved from `window`) |

## Performance Implications
- **CPU**: Negligible — `CustomEvent` dispatch is synchronous and fast
- **Memory**: One shared constants object (`Events`) — effectively zero
- **Load Time**: `src/foundation/events.js` is a tiny module (~10 lines); no impact

## Migration Plan
No existing source code. GDD sync: `price-api-layer.md` updated in the same pass as this ADR (W-5 resolution).

## Validation Criteria
- `src/foundation/events.js` exports an `Events` object with all 5 event name constants
- No source file outside `src/foundation/events.js` contains an inline string matching any event name (e.g. `'balance-changed'`)
- All dispatches use `document.dispatchEvent(new CustomEvent(Events.NAME, ...))` — no `window.dispatchEvent` calls
- Vitest test: dispatch `Events.BALANCE_CHANGED` on `document` → listener receives correct `detail.balance`

## Related Decisions
- ADR-0001: Web stack and module system
- ADR-0002: Module file structure (events.js lives at `src/foundation/events.js`)
- price-api-layer.md: Updated — `price-updated` moved from `window` to `document` (W-5 resolution)
