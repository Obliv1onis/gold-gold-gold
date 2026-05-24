# Case Inventory

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Zero Friction · Faithful Over Flashy

## Overview

The Case Inventory is the player's personal stash of CS2 cases. It stores how many of each case the player owns as a count map (`caseId → quantity`) and persists that state to localStorage via the Persistence system. When a player buys a case from the Case Browser UI, Case Inventory validates affordability with Virtual Economy, deducts the case price from the balance, and increments the owned count. When the player clicks Open, the Case Opening Orchestrator removes one unit from Case Inventory before the reel spins.

From the player's perspective, Case Inventory is the "what am I working with?" layer: it answers "how many Recoil Cases do I have?", enables the Case Browser to show cases as owned or unowned, and prevents the Open button from activating when the player has zero units of the selected case. It is the only system that knows whether the player has purchased something — Virtual Economy knows the dollar amount, but Case Inventory knows the units.

In MVP, case market prices are sourced from the `market_price` field on `CaseEntry` in the Case Data Store.

On a full reset (player triggers a restart), Case Inventory clears its entire count map and persists the empty state. Virtual Economy owns the balance reset; Case Inventory owns its own wipe.

## Player Fantasy

The case stash is the player's pre-commitment to the next run. Buying three Recoil Cases isn't just a transaction — it's the player deciding "I'm going on a run." The count sitting in inventory creates anticipation: three more chances at a knife, three more reel spins. The buying moment and the opening moment are linked by the inventory state between them.

Players feel this system as a small ritual of preparation. They browse, they pick a case (or several), they watch the balance drop and the count tick up, and then they return to the opener with a stash to burn through. For sessions where a player wants to open ten cases in a row, Case Inventory is what makes that possible — it holds the cases bought upfront so the opener doesn't interrupt the flow with a purchase step each time.

The satisfaction of a fully stocked stash (and the urgency of a stash at 1 remaining) are both real psychological states this system enables. It serves **Pillar 2: Zero Friction** — once cases are bought, the open path should be uninterrupted: click Open, reel spins, repeat. No re-purchasing in the middle of a streak.

## Detailed Design

### Core Rules

1. **Inventory state** is a plain object mapping case IDs to owned counts: `Record<string, number>`. Default is `{}` (empty). A missing key and a key with value 0 are equivalent — the player owns zero of that case.

2. **Counts are non-negative integers**. The count for any case can never be negative. Zero is the floor — `removeCase()` on a zero-count case returns false without mutation.

3. **Cases are fungible units, not individual entities**. "Three Recoil Cases" means `{ recoil_case: 3 }` — not three distinct objects with IDs. When one is opened, the count decrements by 1.

4. **Buying is atomic**: `buyCase(caseId, unitPrice, quantity = 1)` validates affordability, deducts the full cost (`unitPrice × quantity`) from Virtual Economy, increments the count, and persists — all in one call. `quantity` defaults to 1, so the common 2-arg form `buyCase(caseId, unitPrice)` buys one case (used by Case Browser UI). If Virtual Economy returns false (insufficient funds), no state changes.

5. **No per-case stack cap**. Players may own any quantity of any case they can afford.

6. **All mutations persist immediately** via Persistence using key `"case_inventory"`.

7. **On full reset**: `clearInventory()` sets the count map to `{}` and persists. This is called by the App Shell as part of the full reset flow, after Virtual Economy's `reset()` has already run.

**Public API:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `getCaseCount` | `(caseId: string): number` | Returns owned count; 0 if not in map |
| `hasCase` | `(caseId: string): boolean` | True if `getCaseCount(caseId) > 0` |
| `getInventory` | `(): Record<string, number>` | Returns a shallow copy of the full count map |
| `buyCase` | `(caseId: string, unitPrice: number, quantity?: number = 1): boolean` | Deducts `unitPrice * quantity` via Virtual Economy; increments count by `quantity`; persists. Returns `false` without mutation if insufficient funds or invalid args. The 2-arg form `buyCase(caseId, unitPrice)` is equivalent to `buyCase(caseId, unitPrice, 1)`. |
| `removeCase` | `(caseId: string): boolean` | Decrements count by 1; persists. Returns `false` without mutation if count is 0. |
| `clearInventory` | `(): void` | Resets count map to `{}`; persists. Called by App Shell during full reset. |

**Events fired on `document`:**

| Event | Fired when |
|-------|------------|
| `case-inventory-changed` | After any mutation: `buyCase()` (on success), `removeCase()` (on success), `clearInventory()`. Fired as `new CustomEvent("case-inventory-changed")`. Listeners (e.g., HUD) use this to re-read the inventory without polling. |

**Constants:**

| Name | Value | Description |
|------|-------|-------------|
| `PERSISTENCE_KEY` | `"case_inventory"` | localStorage key used by Persistence |

### States and Transitions

Case Inventory has no formal FSM — state is continuous (a count map). Two notable conditions exist:

| Condition | Meaning |
|-----------|---------|
| **Empty** | Count map is `{}` or all values are 0. Open button disabled for all cases. |
| **Stocked** | At least one case type has count ≥ 1. Opener can run. |

Transitions are synchronous and occur immediately on any mutation.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Persistence** | ↑ depends on | `Persistence.save("case_inventory", map)` / `Persistence.load("case_inventory", {})` |
| **Virtual Economy** | ↑ depends on | `VirtualEconomy.canAfford(unitPrice * quantity)` + `VirtualEconomy.spend(unitPrice * quantity)` — called inside `buyCase()` |
| **Case Data Store** | ↑ depends on (validation only) | `CaseDataStore.getCase(caseId)` — validates the caseId exists before a buy. Does **not** read `market_price` from here; price is provided by the caller. |
| **Case Opening Orchestrator** (#9) | ↓ depended on by | Calls `hasCase(caseId)` before spinning; calls `removeCase(caseId)` to consume one case |
| **Case Browser UI** (#15) | ↓ depended on by | Reads `getCaseCount(caseId)` to show owned badge; calls `buyCase(caseId, casePrice)` on purchase (2-arg form, quantity defaults to 1) |
| **HUD / App Shell** (#11) | ↓ depended on by | Calls `clearInventory()` as part of full reset; may read total case count for summary display |

**Data flow at case open time (owned by the Orchestrator, specified here for clarity):**
```
1. Orchestrator checks: CaseInventory.hasCase(caseId)             → false → block open
2. Orchestrator checks: VirtualEconomy.canAfford(casePrice + KEY_COST_USD) → false → block open
3. Both pass → VirtualEconomy.spend(casePrice + KEY_COST_USD)
4.           → CaseInventory.removeCase(caseId)
5.           → spin begins
```

## Formulas

#### F1: Total Case Purchase Cost

```
total_purchase_cost = unitPrice * quantity
```

| Variable | Type | Source | Range |
|----------|------|--------|-------|
| `unitPrice` | float (USD) | Provided by Case Browser UI (from Case Data Store `market_price` field) | $0.01 – ~$50.00 |
| `quantity` | integer | Player selection (≥ 1) | 1 – ∞ (no cap) |
| `total_purchase_cost` | float (USD) | — | $0.01 – theoretically unlimited |

*Example: Buy 5 Recoil Cases at $0.50 each = $2.50 deducted from balance.*

#### F2: Post-Buy Count

```
new_count = getCaseCount(caseId) + quantity    (only when buyCase returns true)
```

#### F3: Post-Remove Count

```
new_count = getCaseCount(caseId) - 1    (only when removeCase returns true)
floor: new_count ≥ 0
```

#### F4: Affordability Check (delegates to Virtual Economy)

```
can_buy = VirtualEconomy.canAfford(unitPrice * quantity)
```

No independent formula — Case Inventory delegates the dollar check entirely to Virtual Economy's `canAfford()`. Case Inventory does not re-implement the balance comparison.

## Edge Cases

**E1: `buyCase()` called with `quantity = 0` or negative**
`buyCase("recoil_case", 0.50, 0)` should not silently add zero cases or deduct $0.
*Handling*: Throws `InventoryError("quantity must be positive")` if `quantity <= 0`. Same guard for `unitPrice <= 0`.

**E2: `buyCase()` called with a caseId not in the Case Data Store**
Player somehow calls buy on an invalid case ID (e.g., UI bug or direct API call).
*Handling*: `CaseDataStore.getCase(caseId)` returns null → `buyCase()` returns `false` without deducting balance. No error thrown (graceful no-op).

**E3: Player can afford some but not all of a bulk buy**
Player has $1.00, tries to buy 5 Recoil Cases at $0.50 each ($2.50 total).
*Handling*: `VirtualEconomy.canAfford(2.50)` returns false → `buyCase()` returns false. The system does NOT buy a partial quantity. The UI is responsible for disabling the buy button or warning before this call is made.

**E4: `removeCase()` called when count is exactly 0**
Orchestrator attempts to open a case the player no longer owns (race condition or UI bug).
*Handling*: Returns `false` without mutation. Count remains at 0. The Orchestrator must treat a `false` return as "open blocked."

**E5: `removeCase()` called with a caseId not present in the map at all**
Same as E4 — a missing key is treated as count = 0.
*Handling*: Returns `false`. No mutation.

**E6: Corrupt or invalid data in localStorage**
`Persistence.load("case_inventory")` returns a non-object (string, number, null) or an object with non-integer values (e.g., `{ recoil_case: "three" }`).
*Handling*: Any non-plain-object is treated as `{}` (empty inventory). Any key whose value is not a non-negative integer is dropped. Partial recovery: valid keys survive; corrupt keys are discarded and logged.

**E7: `clearInventory()` called while a case open is in progress**
App Shell triggers a reset mid-spin (shouldn't be possible if the Reset button is correctly disabled during animation, but defensively handled).
*Handling*: `clearInventory()` runs synchronously. The Orchestrator's in-progress spin completes normally — it already called `removeCase()` before the spin started. Reset wipes whatever remains.

**E8: Very large count from repeated bulk buys**
Player buys 10,000 Recoil Cases. Count becomes 10,000.
*Handling*: No cap — allowed. JavaScript handles integers up to 2^53 safely. UI truncation to "9999+" is a Case Browser UI concern, not this system's.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Persistence** (#3) | Loads and saves the case count map to localStorage | `Persistence.load("case_inventory", {})` / `Persistence.save("case_inventory", map)` |
| **Virtual Economy** (#6) | Validates and deducts the purchase cost | `VirtualEconomy.canAfford(total)` + `VirtualEconomy.spend(total)` inside `buyCase()` |
| **Case Data Store** (#1) | Validates that a caseId is real before buying | `CaseDataStore.getCase(caseId)` — null check only; does not read price from here |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they call |
|--------|-----------------|----------------|
| **Case Opening Orchestrator** (#9) | Must verify case ownership and consume one unit on open | `hasCase(caseId)`, `removeCase(caseId)` |
| **Case Browser UI** (#15) | Displays owned count per case; triggers purchases | `getCaseCount(caseId)`, `getInventory()`, `buyCase(caseId, qty, price)` |
| **HUD / App Shell** (#11) | Clears case inventory on full reset | `clearInventory()` |

Case Browser UI reads `CaseEntry.market_price` from Case Data Store to display the price and pass it to `buyCase()`.

## Tuning Knobs

| Knob | Default | Safe Range | Gameplay Effect |
|------|---------|------------|-----------------|
| `STARTING_INVENTORY` | `{}` (empty) | `{}` or `{ [caseId]: 1–5 }` | Gifting one case at session start reduces friction for first-time players; empty start makes the buy step mandatory |
| `MAX_BULK_BUY_QUANTITY` | unlimited | 1 – 100 | Caps how many cases a player can buy in one transaction; prevents accidental $50+ purchases; set to unlimited for power users |
| `ALLOW_PARTIAL_BUY` | false | true / false | If true, `buyCase()` buys as many units as the player can afford instead of all-or-nothing; changes spend pattern significantly — leave false for MVP |

Only `STARTING_INVENTORY` is likely to be adjusted in playtesting (tutorial feel vs. intentional friction). The other two are architectural defaults that should stay at their defaults for MVP.

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-CI-01 | `getCaseCount("unknown_case")` called on empty inventory | Returns `0` | BLOCKING |
| AC-CI-02 | `hasCase(caseId)` called when count is 0 | Returns `false` | BLOCKING |
| AC-CI-03 | `hasCase(caseId)` called when count is ≥ 1 | Returns `true` | BLOCKING |
| AC-CI-04 | `buyCase(caseId, 0.50)` called with sufficient balance (2-arg form; quantity defaults to 1) | Returns `true`; count increments by 1; balance decrements by $0.50; state persists to localStorage | BLOCKING |
| AC-CI-05 | `buyCase(caseId, 0.50, 3)` called with $1.00 balance (insufficient) | Returns `false`; count unchanged; balance unchanged | BLOCKING |
| AC-CI-06 | `buyCase(caseId, 0.50, 0)` called | Throws `InventoryError`; no state change | BLOCKING |
| AC-CI-07 | `buyCase("nonexistent_id", 0.50)` called | Returns `false`; no balance deducted | BLOCKING |
| AC-CI-08 | `removeCase(caseId)` called when count is 1 | Returns `true`; count becomes 0; persists | BLOCKING |
| AC-CI-09 | `removeCase(caseId)` called when count is 0 | Returns `false`; no mutation | BLOCKING |
| AC-CI-10 | `clearInventory()` called with multiple cases owned | Count map becomes `{}`; persists; subsequent `getCaseCount` calls return 0 | BLOCKING |
| AC-CI-11 | Page reload after buying 3 cases | `getCaseCount` returns 3 after reload (persistence round-trip) | BLOCKING |
| AC-CI-12 | localStorage value for `"case_inventory"` is corrupt string | Inventory loads as `{}` without throwing; valid operation proceeds normally | BLOCKING |
| AC-CI-13 | `buyCase(caseId, 0.50, 5)` with $10.00 balance | Count increments by 5; balance decrements by $2.50 | BLOCKING |
| AC-CI-14 | `buyCase(caseId, 0.50)` called (2-arg form) with sufficient balance | Equivalent to `buyCase(caseId, 0.50, 1)`: returns `true`; count increments by 1; balance decrements by $0.50 | BLOCKING |
