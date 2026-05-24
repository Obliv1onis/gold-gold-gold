# ADR-0005: Persistence Strategy

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Core / Foundation |
| **Knowledge Risk** | LOW — Web Storage API is stable and pre-training-data |
| **References Consulted** | persistence.md GDD, virtual-economy.md, case-inventory.md, skin-inventory.md, price-api-layer.md, ADR-0001 (module system), ADR-0002 (file structure) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm localStorage is available in all target browsers (Chrome, Firefox, Edge, Safari) in standard browsing mode; confirm behavior in private/incognito mode (Safari blocks localStorage in private) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Vite + ES modules), ADR-0002 (Foundation layer file structure) |
| **Enables** | VirtualEconomy, CaseInventory, SkinInventory, PriceAPILayer — all four Core modules require Persistence before they can implement save/load |
| **Blocks** | All Core modules (`src/core/`) — cannot persist state until this ADR is Accepted |
| **Ordering Note** | Foundation layer — must be Accepted before any Core module is implemented. |

## Context

### Problem Statement
Four Core modules (VirtualEconomy, CaseInventory, SkinInventory, PriceAPILayer) all need to read and write to `localStorage`. The persistence.md GDD specifies a `vault_` key namespace, a graceful degradation path when storage is unavailable, and exact default values for each key. Without a shared wrapper, each module would contain its own `localStorage.getItem`/`setItem` calls with inconsistent error handling, no guaranteed key naming convention, and no central place to add diagnostics or swap the storage backend.

### Constraints
- All state that must survive page reload is stored in `localStorage` — no server-side persistence in the MVP
- `localStorage` has synchronous read/write API — no async handling needed
- `localStorage` is unavailable in some private browsing modes (Safari) and when the storage quota is exceeded — modules must not throw
- All keys must use the `vault_` prefix to avoid collisions with other scripts or future features
- The GDD defines exact default values: `balance = 2000.00`, `case_inventory = {}`, `skin_inventory = []`
- JSON serialisation is required — `localStorage` values are strings only

### Requirements
- Must expose `save`, `load`, `delete`, `clearAll`, `isAvailable` as the sole localStorage interface
- Must prefix all keys with `vault_` internally — callers pass logical keys without the prefix
- Must return the caller-supplied `defaultValue` from `load()` when the key is absent or storage is unavailable
- Must silently no-op on `save()` / `delete()` / `clearAll()` when storage is unavailable — no thrown exceptions
- Must be importable as an ES module (ADR-0001) at `src/foundation/persistence.js` (ADR-0002)

## Decision

**Implement a thin localStorage wrapper at `src/foundation/persistence.js`. No IndexedDB. No third-party library.**

- **Namespace**: All keys are stored as `vault_[key]` — callers never include the prefix
- **Graceful degradation**: `isAvailable()` detects storage access on module load; if unavailable, all writes are silently dropped and reads return `defaultValue`
- **Serialisation**: `JSON.stringify` on `save()`, `JSON.parse` on `load()` — supports all JSON-serialisable values
- **Atomic contract**: Core modules must call `Persistence.save()` in the same synchronous call as their state mutation, before dispatching a DOM event. The event bus (ADR-0003) notifies listeners of the new state; Persistence ensures the state is durable before listeners act on it.

### Key Schema

| Logical Key | localStorage Key | Default Value | Owner |
|-------------|-----------------|---------------|-------|
| `balance` | `vault_balance` | `2000.00` | VirtualEconomy |
| `case_inventory` | `vault_case_inventory` | `{}` | CaseInventory |
| `skin_inventory` | `vault_skin_inventory` | `[]` | SkinInventory |
| `price_[itemId]` | `vault_price_[itemId]` | `null` | PriceAPILayer |

### Architecture Diagram

```
VirtualEconomy.spend()          CaseInventory.remove()
  │ mutate _balance              │ mutate _inventory
  │ Persistence.save('balance')  │ Persistence.save('case_inventory')
  │ document.dispatchEvent(...)  │ document.dispatchEvent(...)
  └─────────────────────────────┘
              │
              ▼
    src/foundation/persistence.js
      _available: boolean (checked once on load)
      save(key, value)   → localStorage.setItem('vault_' + key, JSON.stringify(value))
      load(key, default) → JSON.parse(localStorage.getItem('vault_' + key)) ?? default
      delete(key)        → localStorage.removeItem('vault_' + key)
      clearAll()         → removes all 'vault_*' keys
      isAvailable()      → returns _available
```

### Key Interfaces

```js
// src/foundation/persistence.js

let _available = false;
try {
  localStorage.setItem('__vault_probe__', '1');
  localStorage.removeItem('__vault_probe__');
  _available = true;
} catch (_) { /* private mode or quota exceeded */ }

const PREFIX = 'vault_';

export const Persistence = {
  isAvailable() { return _available; },

  save(key, value) {
    if (!_available) return;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (_) { /* quota exceeded — degrade silently */ }
  },

  load(key, defaultValue = null) {
    if (!_available) return defaultValue;
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    try { return JSON.parse(raw); }
    catch (_) { return defaultValue; } // corrupted value
  },

  delete(key) {
    if (!_available) return;
    localStorage.removeItem(PREFIX + key);
  },

  clearAll() {
    if (!_available) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};
```

### Atomic Mutation Contract

Core modules must follow this exact sequence on every state-mutating call:

1. Validate input (throw synchronously if invalid — before touching state)
2. Mutate the in-memory state variable
3. `Persistence.save(key, newValue)`
4. `document.dispatchEvent(new CustomEvent(Events.X, { detail: { ... } }))`

**Never reorder steps 3 and 4.** If the event fires before `save()` completes, a listener that triggers a page reload would see stale persisted state.

## Alternatives Considered

### Alternative A: IndexedDB
- **Description**: Browser key-value store with larger capacity, async API, and transaction support.
- **Pros**: No 5MB quota; supports binary data; transactional.
- **Cons**: Fully async (requires `await` or callbacks throughout all Core modules); the GDD explicitly specifies localStorage; no state in this app will approach 5MB (balance=8 bytes, inventory=~20 items × ~200 bytes = ~4KB total).
- **Rejection Reason**: Async API adds significant complexity to VirtualEconomy, CaseInventory, and SkinInventory without any benefit — the data footprint is comfortably within localStorage's 5MB quota, and the GDD explicitly targets localStorage.

### Alternative B: No wrapper — direct localStorage calls
- **Description**: Each Core module calls `localStorage.getItem`/`setItem` directly.
- **Pros**: Zero abstraction; slightly less code.
- **Cons**: Inconsistent key formatting risk (`vault_balance` vs `balance` vs `vaultBalance`); no single point for graceful degradation; Safari private-mode exceptions surface in every module; no central place for diagnostics or future backend swap.
- **Rejection Reason**: The `vault_` prefix must be guaranteed centrally — direct calls make it a convention rather than an enforcement. The graceful degradation requirement (persistence.md) requires try/catch at every call site, which is better done once.

### Alternative C: sessionStorage
- **Description**: Same API as localStorage but cleared when the tab closes.
- **Pros**: Automatic cleanup; no privacy concerns about persisting data.
- **Cons**: The entire point of persistence is to survive page reloads and return visits. sessionStorage does not survive closing the tab.
- **Rejection Reason**: Contradicts the GDD requirement that balance, inventory, and case opening history persist across sessions.

## Consequences

### Positive
- All localStorage access is centralised — one file to audit, one file to swap if the storage backend changes
- `vault_` prefix is enforced at one point — no key collision risk across modules
- Graceful degradation is tested once and guaranteed for all modules
- Atomic mutation contract is explicit in the ADR — every developer knows the required call sequence

### Negative
- One extra function call per save/load vs. direct localStorage (negligible performance impact)
- `clearAll()` iterates all localStorage keys — acceptable since the key count is small and this is a rare debug/reset operation

### Risks
- **Safari private mode**: `localStorage` throws `SecurityError` on any access. Mitigation: the probe in the module initializer catches this; `_available` is set to `false`; all subsequent calls no-op. App continues without persistence (in-memory only).
- **Quota exceeded**: `localStorage.setItem` can throw `QuotaExceededError` after the initial probe. Mitigation: `save()` wraps `setItem` in a try/catch independently of the `_available` flag.
- **JSON corruption**: A key's value may be corrupted (truncated write, manual browser edit). Mitigation: `load()` wraps `JSON.parse` in a try/catch and returns `defaultValue` on failure.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| persistence.md | `vault_` key namespace | `PREFIX = 'vault_'` applied in `save/load/delete` — callers never include it |
| persistence.md | `isAvailable()` graceful degradation | Probe on module load; `_available` flag; all write methods silently no-op when false |
| persistence.md | Default values: balance=2000.00, case_inventory={}, skin_inventory=[] | `load(key, defaultValue)` — callers supply defaults; Persistence returns them on missing key |
| virtual-economy.md | `keyBalance` → `balance` pivot (2026-05-19 economy change) | Key schema uses `balance` (not `keyBalance`) |
| case-inventory.md | Persist case inventory across reloads | `Persistence.save('case_inventory', ...)` / `load('case_inventory', {})` |
| skin-inventory.md | Persist skin inventory across reloads | `Persistence.save('skin_inventory', ...)` / `load('skin_inventory', [])` |
| price-api-layer.md | Cache last-known price per item | `Persistence.save('price_' + itemId, price)` / `load('price_' + itemId, null)` |

## Performance Implications
- **CPU**: `localStorage` reads/writes are synchronous and fast (~1ms). JSON.parse/stringify for the largest payload (skin inventory, ~20 items) is <1ms.
- **Memory**: No additional memory overhead — the wrapper holds only the `_available` boolean
- **Load Time**: `src/foundation/persistence.js` is ~30 lines; negligible
- **Network**: None — localStorage is local storage

## Migration Plan
No existing source code — greenfield. `src/foundation/persistence.js` is written to this spec.

## Validation Criteria
- `Persistence.isAvailable()` returns `true` in a standard browser context
- `Persistence.save('balance', 1500.00)` writes `"1500"` to `localStorage` key `vault_balance`
- `Persistence.load('balance', 2000.00)` returns `2000.00` when the key is absent
- `Persistence.load('balance', 2000.00)` returns `1500` after `save('balance', 1500.00)`
- `Persistence.save()` does not throw when localStorage is simulated as unavailable
- `Persistence.clearAll()` removes all `vault_*` keys and no others
- Vitest test: mock `localStorage` unavailable → all methods complete without throwing

## Related Decisions
- ADR-0001: Vite + ES modules — Persistence is a plain ES module, no npm dependencies
- ADR-0002: Foundation layer at `src/foundation/persistence.js`
- ADR-0003: DOM events — Persistence does not dispatch events; Core modules do that after saving
- persistence.md: GDD with full key schema and graceful degradation requirements
