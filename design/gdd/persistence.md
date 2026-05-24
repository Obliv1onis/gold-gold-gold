# Persistence

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Zero Friction

## Overview

The Persistence system is a `localStorage` wrapper that provides the rest of the
application with a typed, error-safe interface for saving and loading game state
between browser sessions. It is the single point through which any data that must
survive a page reload passes — no other system reads from or writes to
`localStorage` directly.

In MVP, three systems depend on Persistence: Virtual Economy (saves and loads the
player's virtual balance), Case Inventory (saves and loads the player's case
holdings), and Skin Inventory (saves and loads all items the player has pulled
from cases). The Persistence system does not know what these values mean — it
serializes them to strings, writes them to `localStorage` under a `vault_`-prefixed
key, and deserializes them back on load.

The system exposes a two-method read/write interface: `save(key, data)` writes
any serializable value; `load(key, defaultValue)` reads it back, returning
`defaultValue` if the key is absent or the stored value is corrupt. If
`localStorage` is unavailable (private browsing mode, storage quota exceeded,
or browser policy), all writes become no-ops and all reads return their defaults
— the application operates as a session-only simulator with no visible error to
the player.

**MVP scope**: virtual balance, case inventory, and skin inventory only. Volume
preferences and other settings are deferred to post-MVP.

## Player Fantasy

The Persistence system has no player-visible surface. No button triggers it. No
feedback shows that it worked. Its fantasy is not a feeling of power or
achievement — it is the absence of disappointment.

The system succeeds when a player closes the simulator mid-session, opens it the
next day, and finds their balance, case inventory, and skin inventory exactly as
they left them — without ever thinking about how that happened. It fails the
moment a player returns to a wiped inventory or a reset balance. That failure
would retroactively devalue every case they ever opened: the accumulated
inventory becomes meaningless as a record of play.

Pillar 3 applies indirectly: *"Every Case Counts."* Persistence is what makes
opening cases feel like they accumulate toward something. Without it, the
simulator is a slot machine that forgets.

## Detailed Design

### Core Rules

1. `localStorage` is the storage backend. All operations are synchronous — no
   async/await needed.

2. All keys stored by this system are prefixed with `vault_`. Callers pass key
   names without the prefix; the system appends it automatically.
   Example: `save("balance", 2000.00)` writes to `localStorage` key
   `"vault_balance"`. (Note: prior to the 2026-05-19 economy pivot, this key was
   `keyBalance`. Any saved data under `vault_keyBalance` is legacy and ignored.)

3. `save(key, value)` serializes `value` via `JSON.stringify` and writes the
   resulting string to `localStorage`. Arrays and plain objects are supported.
   If serialization throws (e.g., circular reference), the write is skipped
   and an error is logged — no crash.

4. `load(key, defaultValue)` reads from `localStorage`, deserializes via
   `JSON.parse`, and returns the result. If the key is absent (`localStorage`
   returns `null`), or if `JSON.parse` throws on corrupt data, `defaultValue`
   is returned without throwing.

5. `delete(key)` removes the specific `vault_`-prefixed key from `localStorage`.
   Calling `delete` on a key that doesn't exist is a no-op.

6. `clearAll()` removes only `vault_`-prefixed keys from `localStorage`. It does
   **not** call `localStorage.clear()` — no other origin data is touched.

7. `isAvailable()` tests availability by writing and reading a temporary key
   (`vault_test`). Returns `true` if the test round-trips correctly, `false`
   otherwise.

8. If `localStorage` is unavailable (private browsing mode, quota exceeded,
   `SecurityError`): `save()` becomes a no-op; `load()` returns `defaultValue`.
   No error is thrown. The application runs as a session-only simulator with
   no visible error to the player.

9. No schema versioning in MVP. If stored data is corrupt or structurally
   mismatched (e.g., old inventory format after a code change), `JSON.parse`
   throws and `load()` returns `defaultValue`. This is the degraded recovery
   path — the player loses session data in that key, but the application
   continues normally.

10. A `vault_meta` key is written at startup with `{ "format_version": "1.0" }`.
    It is not read in MVP but reserves the namespace for future schema migration.

### States and Transitions

| State | Description |
|-------|-------------|
| **Available** | `localStorage` accessible; `save()`/`load()` work as specified |
| **Unavailable** | `localStorage` inaccessible; all `save()` are no-ops; `load()` returns defaults |

**Transitions:**
- Initial state determined by `isAvailable()` at application startup
- `Available → Unavailable`: quota exceeded mid-session, or browser policy change
  (rare; non-recoverable without page reload)
- No path from `Unavailable → Available` mid-session

### Interactions with Other Systems

| System | Direction | What flows |
|--------|-----------|------------|
| **Virtual Economy** | Virtual Economy → Persistence | `save("balance", number)` on balance change; `load("balance", 2000.00)` at startup |
| **Case Inventory** | Case Inventory → Persistence | `save("case_inventory", object)` on buy/remove; `load("case_inventory", {})` at startup |
| **Skin Inventory** | Skin Inventory → Persistence | `save("skin_inventory", InventorySkinEntry[])` after each open or sell; `load("skin_inventory", [])` at startup |
| **HUD / App Shell** | HUD → Persistence | `isAvailable()` at startup to detect session-only mode |
| **Audio System** *(post-MVP)* | Audio → Persistence | `save("settings.volume", number)` / `load("settings.volume", 1.0)` — deferred |

**Interface contract:**

| Method | Signature | Behavior |
|--------|-----------|----------|
| `save(key, value)` | `(key: string, value: any): void` | Serialize + write to `vault_[key]`; no-op if unavailable |
| `load(key, default)` | `(key: string, defaultValue: any): any` | Read + deserialize `vault_[key]`; return default if absent/corrupt |
| `delete(key)` | `(key: string): void` | Remove `vault_[key]`; no-op if key absent |
| `clearAll()` | `(): void` | Remove all `vault_*` keys |
| `isAvailable()` | `(): boolean` | Return `true` if localStorage round-trip test passes |

## Formulas

Persistence has no mathematical game-balance formulas. The specification below
covers the key naming rule and the required default seed values for MVP.

### Key Naming Formula

The storage key formula is defined as:

`storage_key = "vault_" + caller_key`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Caller key | `caller_key` | string | Any valid string, no spaces | The key name passed to `save()` or `load()` by a downstream system |
| Storage key | `storage_key` | string | `"vault_" + caller_key` | The actual key written to `localStorage` |

**Output**: A `localStorage` key with the `vault_` prefix applied.
**Example**: `save("balance", 2000.00)` → writes to `localStorage["vault_balance"]`.

---

### Default Seed Values

When `load(key, defaultValue)` is called on a key that has never been saved (or
whose stored data is corrupt), the `defaultValue` argument is returned. The table
below defines the required defaults for each key in MVP — downstream GDDs must
agree on these values.

| Caller Key | Default Value | Type | Who reads it | Rationale |
|------------|--------------|------|--------------|-----------|
| `"balance"` | `2000.00` | number | Virtual Economy | Player starts with $2,000 virtual balance — enough for hundreds of opens |
| `"case_inventory"` | `{}` | object | Case Inventory | New player has no cases purchased |
| `"skin_inventory"` | `[]` | InventorySkinEntry[] | Skin Inventory | New player has no items |
| `"meta"` | `{ "format_version": "1.0" }` | object | (future) | Startup metadata; not read in MVP |

**Note**: The `2000.00` default for `balance` is owned by Virtual Economy GDD. If
Virtual Economy changes the starting balance, update this table to match.

## Edge Cases

- **If `localStorage` is unavailable at startup** (private browsing, `SecurityError`,
  quota already exhausted): `isAvailable()` returns `false`. All `save()` calls
  become no-ops for the session. All `load()` calls return `defaultValue`. The
  application runs as a session-only simulator — no data survives page reload.
  No error is shown to the player.

- **If `localStorage` quota is exceeded mid-session** (after startup, while the
  system was Available): `save()` catches the thrown `QuotaExceededError`, logs
  it, and skips the write. The in-memory state (in Virtual Economy, Case Inventory,
  and Skin Inventory) is unaffected; only the persisted copy fails. Subsequent
  `save()` calls continue to fail silently until the session ends.

- **If `JSON.parse` throws on `load()`** (corrupt value, incomplete write, or
  data written by an incompatible older version): `load()` catches the exception
  and returns `defaultValue`. The player loses the stored data for that key.
  The application continues as if it were a new session for that datum only.

- **If `JSON.stringify` throws on `save()`** (circular reference, `BigInt` value,
  or other non-serializable type): `save()` catches the exception, logs a warning,
  and skips the write. The previous stored value for that key is unchanged.

- **If `save()` is called with `undefined` as the value**: `JSON.stringify(undefined)`
  returns `undefined` (not a string), which cannot be stored. The call is treated
  as a no-op and a warning is logged. Callers must not pass `undefined` — use
  `null` or an empty default value instead.

- **If `load()` reads a key that was saved as `null`**: `JSON.parse("null")`
  returns `null`, not the `defaultValue`. Callers that save `null` and expect
  `load()` to return a default on next load will be surprised. Convention: do
  not save `null` — save an empty value (`0`, `[]`, `{}`) instead.

- **If two browser tabs have the simulator open simultaneously**: `localStorage`
  writes from Tab B can be overwritten by Tab A if both tabs save the same key
  independently. This is a known limitation in MVP — no cross-tab synchronization
  is implemented. Players are expected to use one tab.

- **If `clearAll()` is called**: All `vault_*` keys are removed from `localStorage`.
  The next `load()` calls return their defaults. Equivalent to a fresh install.

- **If `delete()` is called on a key that was never saved**: `localStorage
  .removeItem()` is a no-op for missing keys. `delete()` behaves the same —
  no error, no side effects.

- **If a page reload occurs immediately after `save()`**: `localStorage` writes
  are synchronous and durable on success. There is no buffering or async delay —
  a successfully returned `save()` call is guaranteed to persist across a reload.

## Dependencies

### Upstream Dependencies

None. The Persistence system is a Foundation-layer system with zero upstream
dependencies. It wraps the browser's native `localStorage` API directly — no
other simulator system must exist before Persistence can be used.

### Downstream Dependents

| System | What it needs | Hard/Soft | Design Doc |
|--------|--------------|-----------|------------|
| **Virtual Economy** | `load("balance", 2000.00)` at startup; `save("balance", n)` on change | Hard | design/gdd/virtual-economy.md |
| **Case Inventory** | `load("case_inventory", {})` at startup; `save("case_inventory", obj)` on buy/remove | Hard | design/gdd/case-inventory.md |
| **Skin Inventory** | `load("skin_inventory", [])` at startup; `save("skin_inventory", entries)` after each open or sell | Hard | design/gdd/skin-inventory.md |
| **HUD / App Shell** | `isAvailable()` at startup to detect session-only mode | Soft | design/gdd/hud-app-shell.md |

Hard means the system's state cannot survive a page reload without Persistence.
Soft means the system degrades gracefully (runs session-only) if Persistence is
unavailable.

### Interface Contract

The Persistence system exposes 5 synchronous methods defined in the Detailed
Design section above. No system accesses `localStorage` directly — all reads
and writes must go through this interface.

## Tuning Knobs

Persistence has minimal tuning surface — it is a pure serialization utility.
The only designer-adjustable values are the storage namespace and the seed
defaults defined in the Formulas section.

| Knob | Current Value | Safe Range | Change Risk |
|------|--------------|------------|-------------|
| **Storage namespace prefix** | `"vault_"` | Any unique string | **HIGH** — changing mid-deployment orphans all existing player data; previous `vault_*` keys become inaccessible |
| **`balance` default** | `2000.00` | 100–10000 | **LOW** — affects only new players or players who reset. Higher value gives more runway; lower value increases early reset frequency |
| **`format_version`** | `"1.0"` | Any semver string | **NONE** in MVP (not read) — reserved for future schema migration |

**Interaction note**: The `balance` default is shared between this GDD (which
defines the `load()` default) and Virtual Economy GDD (which defines starting
balance as a gameplay decision). These values must stay in sync. Virtual Economy
is the design authority — update the default here only to match Virtual Economy's
decision.

## Acceptance Criteria

*(Reviewed by `qa-lead` — lean mode Section H gate.)*

- **GIVEN** `save("balance", 2000.00)` is called, **WHEN** `load("balance", 0)` is
  called in the same session, **THEN** `2000` is returned.

- **GIVEN** `save("balance", 2000.00)` is called, **WHEN** the page is reloaded and
  `load("balance", 0)` is called, **THEN** `2000` is returned (survives reload).

- **GIVEN** `save("balance", 2000.00)` is called, **THEN**
  `localStorage["vault_balance"]` contains the string `"2000"` — the `vault_`
  prefix is applied automatically.

- **GIVEN** `localStorage` is unavailable, **WHEN** `save("balance", 2000.00)` is
  called, **THEN** no error is thrown and `localStorage` is unchanged.

- **GIVEN** `localStorage` is unavailable, **WHEN** `load("balance", 0)` is
  called, **THEN** `0` is returned.

- **GIVEN** a key `"skin_inventory"` has never been saved, **WHEN**
  `load("skin_inventory", [])` is called, **THEN** the returned value is structurally
  equal to `[]` (deep equality, not reference equality).

- **GIVEN** `localStorage["vault_balance"]` contains a corrupt non-JSON string,
  **WHEN** `load("balance", 0)` is called, **THEN** `0` is returned and no
  error is thrown.

- **GIVEN** `save("balance", 2000.00)` then `delete("balance")` are called,
  **WHEN** `load("balance", 0)` is called, **THEN** `0` is returned.

- **GIVEN** multiple `vault_*` keys and one non-`vault_*` key exist in
  `localStorage`, **WHEN** `clearAll()` is called, **THEN** all `vault_*` keys
  are removed and the non-`vault_*` key remains unchanged.

- **GIVEN** `localStorage` is accessible, **WHEN** `isAvailable()` is called,
  **THEN** `true` is returned.

- **GIVEN** `localStorage` throws on write, **WHEN** `isAvailable()` is called,
  **THEN** `false` is returned.

- **GIVEN** `isAvailable()` returns `true`, **THEN** `localStorage["vault_test"]`
  is absent after the call completes (the test key is cleaned up).

- **GIVEN** `save("balance", 2000.00)` is called then `save("balance", 999.99)` is
  called, **WHEN** `load("balance", 0)` is called, **THEN** `999.99` is returned.

- **GIVEN** the application starts, **THEN** `localStorage["vault_meta"]` contains
  `'{"format_version":"1.0"}'`.

- **GIVEN** `save("balance", 2000.00)` has been called, **WHEN**
  `save("balance", undefined)` is called, **THEN** `load("balance", 0)`
  returns `2000` (previous value preserved) and no error is thrown.

- **GIVEN** `save("skin_inventory", null)` is called, **WHEN** `load("skin_inventory", [])`
  is called, **THEN** `null` is returned — not `[]`.

- **GIVEN** `save("balance", 2000.00)` has been called, **WHEN**
  `save("balance", circularObject)` is called (non-serializable value),
  **THEN** `load("balance", 0)` still returns `2000` and no error is thrown.

- **GIVEN** `localStorage` is available and has saved data, **WHEN** a `save()`
  call triggers `QuotaExceededError`, **THEN** no error is thrown, the previous
  persisted value for that key is unchanged, and any previously loaded in-memory
  state in the calling system is unaffected.

## Open Questions

- **Schema migration strategy**: `vault_meta` reserves the format version, but no
  migration logic is designed. When the stored data format changes (e.g., an
  ItemEntry schema change), how does the app handle old inventory data? Options:
  clear on version mismatch (simple, lossy) or write a migration function (complex,
  preserves data). *Resolution: design in a future `/architecture-decision
  persistence-migration` before any breaking schema change ships.*

- **IndexedDB upgrade path**: `localStorage` quota is 5–10 MB per origin. MVP
  inventory will be well under this. But a player opening thousands of cases over
  months could accumulate a large inventory. *Resolution: measure inventory JSON
  size during testing; revisit if player data approaches 1 MB.*

- **Inventory save timing**: The interface specifies `save("inventory", items)` after
  each case open. For rapid sequential opens, this serializes a potentially large
  array every open. A debounce (save after 500 ms of inactivity) may be needed.
  *Resolution: benchmark during implementation; add debounce if measurably slow.*

- **Reset Progress UI**: `clearAll()` is defined but the trigger is owned by HUD /
  App Shell. *Resolved: HUD owns the Reset button + confirmation flow (see
  `design/gdd/hud-app-shell.md` AC-HUD-09 through AC-HUD-13). The HUD's reset
  flow calls `VirtualEconomy.reset()` + `CaseInventory.clearInventory()` +
  `SkinInventory.clearInventory()` sequentially; this GDD's `clearAll()` is
  reserved for full-namespace wipe scenarios (e.g., developer tooling).*
