# Skin Inventory

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Zero Friction · Faithful Over Flashy

## Overview

The Skin Inventory stores every skin the player has received from case opens as a persistent, ordered collection of skin instances. Where Case Inventory holds case *types* as a count map, Skin Inventory holds individual skin *instances* — each pull event is a separate entry with a unique instance ID, allowing the player to own multiple copies of the same skin and sell each independently.

The data model is an array of `InventorySkinEntry` objects: a thin wrapper around the `ItemEntry` schema from Case Data Store, augmented with an `instanceId` (UUID assigned at acquisition time) and an `acquiredAt` timestamp. All display fields (weapon name, skin name, rarity, image_url) live in the carried `ItemEntry`; Skin Inventory adds only what is instance-specific.

All mutations persist immediately to localStorage via the Persistence system under key `"skin_inventory"`. When the player sells a skin, Skin Inventory removes the instance from its array, computes `net_proceeds = round(salePrice × (1 - SELL_FEE_RATE))` per F1, calls `VirtualEconomy.earn(net_proceeds)`, and persists. The 15% Steam fee is applied inside `sellItem()` — callers pass the gross market price; Skin Inventory owns the fee calculation. On full reset, `clearInventory()` empties the array and persists — Virtual Economy and Case Inventory own their own respective resets.

From the player's perspective, the Skin Inventory is the record of everything they've pulled. It grows with each case open, drives the Inventory UI, and connects every accumulated skin to its sell value through the Virtual Economy. Browsing it is the post-open experience — the moment between the reel reveal and the next case.

## Player Fantasy

The skin inventory is the trophy case. Every entry is evidence — proof that the reel stopped there, that the rarity flash fired, that it happened. A $0.10 Consumer-grade drop and a $200 knife sit side by side in the same list, and both are real in the same way.

The fantasy operates on two timescales. In the moment: after the reveal animation ends, the player's new skin is in their inventory instantly. That transition — from "unknown item spinning" to "named skin I now own" — is the payoff the entire reel exists to deliver. The inventory is where the payoff lands.

Over a session: the growing list becomes a personal history of the run. Players scroll back to find that Classified they got early. They notice which cases yield what. The inventory turns case opening from a series of disconnected events into a narrative with a record.

The sell mechanic adds a decision layer the pure case-opener fantasy doesn't have: every skin in the list has a dollar value. Selling a $1.50 skin to fund two more opens is a real choice that feels like real stakes. The player is managing a tiny economy — the same mental model as real CS2 trading, but consequence-free.

This system serves **Pillar 2: Zero Friction** — selling must be one tap with no confirmation friction for inexpensive items, and the item must vanish from the list and the balance must tick up before the player's eye has moved on.

## Detailed Design

### Core Rules

1. **Instance model**: Each skin in the inventory is an `InventorySkinEntry` — a wrapper around an `ItemEntry` (from Case Data Store) that adds instance-specific fields:
   ```
   {
     instanceId:  string,   // UUID (crypto.randomUUID() or timestamp+random fallback)
     acquiredAt:  number,   // Date.now() timestamp (ms since epoch)
     item:        ItemEntry // weapon, skin, item_id, image_url, rarity, stattrak, market_price
   }
   ```
   The `item` field carries the full `ItemEntry` as received from the Case Opening Orchestrator. Skin Inventory does not call Case Data Store directly — it trusts the Orchestrator's item.

2. **Order**: Entries are stored newest-first (most recently acquired at index 0). New items are prepended, not appended.

3. **No cap**: Players may own any number of skin instances. No stack limit exists.

4. **`addItem(itemEntry)` is the only acquisition path**. Assigns a `instanceId` (UUID), sets `acquiredAt` to `Date.now()`, wraps the `itemEntry`, prepends to the array, and persists. Returns the new `InventorySkinEntry`.

5. **`sellItem(instanceId, salePrice)` is the only removal path**. Finds the instance by `instanceId`, removes it from the array, computes `net_proceeds = round(salePrice × (1 - SELL_FEE_RATE))` per F1, calls `VirtualEconomy.earn(net_proceeds)`, persists, and returns `true`. If `instanceId` is not found, returns `false` without mutation. The caller (Inventory UI, Reveal UI) passes the gross market price as `salePrice`; Skin Inventory applies the 15% sell fee internally and does not look up prices itself.

6. **All mutations persist immediately** via Persistence using key `"skin_inventory"`. The array is serialized in full on every mutation.

7. **On full reset**: `clearInventory()` sets the array to `[]` and persists. Called by App Shell as part of the full reset flow, after Virtual Economy's `reset()` has already run.

**Public API:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `addItem` | `(item: ItemEntry): InventorySkinEntry` | Wraps item in an instance, prepends to list, persists. Returns new entry. |
| `getItems` | `(): InventorySkinEntry[]` | Returns a shallow copy of the array (newest first). |
| `getItem` | `(instanceId: string): InventorySkinEntry \| null` | Returns a single entry by instance ID; null if not found. |
| `hasItem` | `(instanceId: string): boolean` | True if the instance ID exists in the list. |
| `sellItem` | `(instanceId: string, salePrice: number): boolean` | Removes instance, calls `earn(salePrice)`, persists. Returns false if not found. |
| `clearInventory` | `(): void` | Resets array to `[]`; persists. Called by App Shell on full reset. |

**Events fired on `document`:**

| Event | Fired when |
|-------|------------|
| `skin-inventory-changed` | After any mutation: `addItem()`, `sellItem()` (on success), `clearInventory()`. Fired as `new CustomEvent("skin-inventory-changed")`. Inventory UI listens to this event to re-render reactively. |

**Constants:**

| Name | Value | Description |
|------|-------|-------------|
| `PERSISTENCE_KEY` | `"skin_inventory"` | localStorage key used by Persistence |

### States and Transitions

No formal FSM — state is the array contents. Two notable conditions:

| Condition | Meaning |
|-----------|---------|
| **Empty** | Array is `[]`. Inventory UI shows empty state. Sell-all button is disabled. |
| **Non-empty** | At least one instance exists. Inventory UI renders items. |

Transitions are synchronous and immediate on any mutation.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Persistence** | ↑ depends on | `Persistence.save("skin_inventory", entries)` / `Persistence.load("skin_inventory", [])` |
| **Virtual Economy** | ↑ depends on | `VirtualEconomy.earn(salePrice)` — called inside `sellItem()` |
| **Case Opening Orchestrator** (#9) | ↓ depended on by | Calls `addItem(itemEntry)` immediately after the reel resolves to an item |
| **Inventory UI** (#14) | ↓ depended on by | Calls `getItems()` to render list; calls `sellItem(instanceId, salePrice)` on sell action |
| **HUD / App Shell** (#11) | ↓ depended on by | Calls `clearInventory()` as part of full reset |

**Data flow at sell time:**
```
1. Inventory UI reads: SkinInventory.getItem(instanceId) → display price from item.market_price
2. Player confirms sell
3. Inventory UI calls: SkinInventory.sellItem(instanceId, item.market_price)
4.   → SkinInventory removes instance, computes net = round(salePrice × 0.85), calls VirtualEconomy.earn(net), persists
5. Balance ticks up in HUD; item disappears from Inventory UI
```

**Sell fee note (open question):** CS2's Steam Market charges ~15%. Whether to apply this discount is not decided here — flagged as Open Question #1.

## Formulas

#### F1: Net Sell Proceeds

```
net_proceeds = market_price × (1 - SELL_FEE_RATE)
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Item market price | `market_price` | float (USD) | $0.01 – unbounded | From `ItemEntry.market_price` in Case Data Store |
| Sell fee rate | `SELL_FEE_RATE` | constant | 0.15 | 15% fee matching CS2's Steam Market rate (13% Valve + 2% game cut) |
| Net proceeds | `net_proceeds` | float (USD) | $0.01 – unbounded | Amount passed to `VirtualEconomy.earn()` |

**Output range:** $0.01 and up (mirrors market_price floor). No ceiling.
**Rounding:** `Math.round(net_proceeds × 100) / 100` applied before passing to `earn()` — prevents floating-point drift from accumulating across a session.
**Example:** $5.23 skin → `5.23 × 0.85 = 4.4455 → rounded to $4.45`

---

#### F2: Portfolio Total Value *(display formula — computed by Inventory UI, not this system)*

```
portfolio_value = Σ (item.market_price × (1 - SELL_FEE_RATE))  for each entry in inventory
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Per-item market price | `item.market_price` | float (USD) | $0.01 – unbounded | From each `InventorySkinEntry.item` |
| SELL_FEE_RATE | — | constant | 0.15 | Same fee as F1 — must stay consistent |
| N | — | int | 0 – unbounded | Number of entries in the inventory array |
| Portfolio value | `portfolio_value` | float (USD) | $0.00 – unbounded | Aggregate post-fee sell value of all held skins |

**Output range:** $0.00 when inventory is empty; unbounded above that.
**Ownership:** Inventory UI iterates `getItems()` and applies this formula for display. Skin Inventory does not implement a `getPortfolioValue()` method — this is a UI concern.
**Example:** Three skins at $1.23, $0.30, $12.00 → `(1.23 + 0.30 + 12.00) × 0.85 = $11.51`

---

#### F3: Instance Count

```
instance_count = inventory_array.length
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Inventory array | `inventory_array` | array | length 0 – unbounded | The stored `InventorySkinEntry[]` |
| Instance count | `instance_count` | int | 0 – unbounded | Total skin instances the player owns |

**Output range:** 0 (empty) to unbounded.
**Use:** Gate condition for Inventory UI empty-state display and sell-all enable/disable logic.

## Edge Cases

**E1: `sellItem()` called with an `instanceId` not in the inventory**
Player or Inventory UI passes an invalid or already-sold instance ID (stale state, race condition, or UI bug).
*Handling:* Returns `false` without mutation. Balance unchanged. `VirtualEconomy.earn()` is NOT called.

**E2: `sellItem()` called with `salePrice ≤ 0`**
`earn(0)` or `earn(-1)` would throw `EconomyError` in Virtual Economy. Prevent this upstream.
*Handling:* `sellItem()` throws `InventoryError("salePrice must be positive")` if `salePrice ≤ 0`, before calling `earn()`. No state change.

**E3: `addItem()` called with an `ItemEntry` missing required fields**
Orchestrator passes a malformed item (bug upstream). Fields like `weapon` or `rarity` may be missing.
*Handling:* Store the item as-is — Skin Inventory trusts the Orchestrator and does not validate `ItemEntry` fields. Display gaps (missing name, missing image) are the Inventory UI's responsibility to handle gracefully with placeholder values.

**E4: Corrupt or invalid data loaded from localStorage**
`Persistence.load("skin_inventory", [])` returns a non-array (string, number, object) or an array with non-`InventorySkinEntry` entries.
*Handling:* Any non-array root value is treated as `[]` (empty inventory). Each array entry is checked for the presence of an `instanceId` string — entries missing it are dropped. Partial recovery: valid entries survive; corrupt entries are discarded and logged. Player loses only the specific corrupt instances, not the whole inventory.

**E5: Duplicate `instanceId` in stored data**
Two entries share the same `instanceId` (data corruption or serialization bug).
*Handling:* On load, the first occurrence is kept; subsequent duplicates are dropped and logged. `getItem(instanceId)` always returns the first match.

**E6: `clearInventory()` called while a case open is in progress**
In normal flow this is doubly prevented: (1) the Reset button's two-condition visibility rule requires `balance === $0 AND inventory empty` — if inventory is empty at the time of opening, the player couldn't afford the open; (2) HUD E2 (see `hud-app-shell.md`) aborts the reset confirmation if `isAnimating === true`. This edge case is therefore only reachable by a bug in the HUD layer.
*Defensive handling:* `clearInventory()` runs synchronously. The Orchestrator's in-progress `addItem()` call has not happened yet — `addItem()` is called only after the reel resolves. If `clearInventory()` somehow runs first, the subsequent `addItem()` adds the item to the freshly cleared inventory. One item from the in-flight open still lands.

**E7: Very large inventory (1,000+ skins)**
Players who open hundreds of cases will accumulate large arrays. `Persistence.save()` serializes the full array on every mutation.
*Handling:* No cap enforced — allowed. At ~500 items the serialized JSON may approach 100–200 KB, well within localStorage's 5 MB quota. If `save()` performance degrades measurably, a debounce on `save()` is an option deferred to implementation (see Open Questions).

**E8: Floating-point drift in `net_proceeds`**
`market_price × 0.85` may produce irrational decimal results (e.g., `4.4455`).
*Handling:* Apply `Math.round(net_proceeds × 100) / 100` before calling `earn()` — per F1 formula. The rounded value is what gets passed; the un-rounded value is never stored or displayed.

**E9: Player sells the same skin instance twice (double-tap)**
UI bug allows `sellItem()` to be called twice for the same `instanceId`.
*Handling:* First call removes the entry and returns `true`. Second call finds no matching `instanceId` and returns `false` without calling `earn()` — no double-credit.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Persistence** (#3) | Loads and saves the skin instance array to localStorage | `Persistence.load("skin_inventory", [])` / `Persistence.save("skin_inventory", entries)` |
| **Virtual Economy** (#6) | Credits the player's balance when a skin is sold | `VirtualEconomy.earn(net_proceeds)` — called inside `sellItem()` |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they call |
|--------|-----------------|----------------|
| **Case Opening Orchestrator** (#9) | Must add the won skin to inventory after the reel resolves | `addItem(itemEntry)` |
| **Inventory UI** (#14) | Renders the item list and triggers sells | `getItems()`, `getItem(instanceId)`, `sellItem(instanceId, salePrice)` |
| **HUD / App Shell** (#11) | Clears skin inventory on full reset | `clearInventory()` |
| **Market Browser UI** (#17) | Purchases add skins directly to inventory | `addItem(itemEntry)` |

**Schema dependency (not a runtime call):**
Skin Inventory wraps `ItemEntry` objects provided by the Orchestrator. The `ItemEntry` schema — including the `market_price` field — is defined by Case Data Store. Skin Inventory does not call Case Data Store directly, but it implicitly depends on that schema being accurate.

**Bidirectionality note:** Virtual Economy, Case Opening Orchestrator, and Inventory UI GDDs all list Skin Inventory as an upstream dependency.

## Tuning Knobs

| Knob | Default | Safe Range | Gameplay Effect |
|------|---------|------------|-----------------|
| `SELL_FEE_RATE` | 0.15 (15%) | 0.0 – 0.30 | Higher fee = economy feels tighter, each case open costs more net; lower fee = player retains more value per sell. 0.15 mirrors real CS2 Steam Market — change only if real CS2 fee changes. This is a **fidelity constant**, not a balance knob. |
| `STARTING_INVENTORY` | `[]` (empty) | `[]` or preset list | Gifting starter skins at session start reduces time-to-first-sell; empty start makes first acquisition more meaningful. Leave empty for MVP. |
| `MAX_INVENTORY_SIZE` | unlimited | 100 – unlimited | Capping inventory reduces localStorage payload for long-running sessions. No UX benefit to capping in MVP — players expect to keep everything. |

Only `SELL_FEE_RATE` is likely to ever need changing (if real CS2 key/market economics shift). `MAX_INVENTORY_SIZE` is an implementation safety valve if serialization performance becomes an issue, not a design lever.

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-INV-01 | Given empty inventory; when `addItem(itemEntry)` is called; then the returned entry has a non-empty UUID as `instanceId`, `acquiredAt` is approximately `Date.now()`, and `item` equals the input | Entry returned with valid UUID, timestamp, and item | BLOCKING |
| AC-INV-02 | Given one existing item; when `addItem(itemEntry)` is called again; then `getItems()` returns the new entry at index 0 and the prior entry at index 1 | New item prepended; newest-first order maintained | BLOCKING |
| AC-INV-03 | Given a freshly added item with known `instanceId`; when `getItem(instanceId)` is called; then the exact entry is returned | Entry matches what was added | BLOCKING |
| AC-INV-04 | Given a known `instanceId` in inventory; when `hasItem(instanceId)` is called; then `true`. When called with unknown ID, then `false` | Correct boolean in both cases | BLOCKING |
| AC-INV-05 | Given an item with `market_price` $10.00; when `sellItem(instanceId, 10.00)` is called; then `VirtualEconomy.earn()` is called with `8.50` (10.00 × 0.85 rounded to 2dp) | `earn(8.50)` called exactly once | BLOCKING |
| AC-INV-06 | Given `market_price` $7.777; when `sellItem()` fires; then `earn()` receives `6.61` (7.777 × 0.85 = 6.61045 → rounded) | F1 rounding applies correctly | BLOCKING |
| AC-INV-07 | Given `addItem()` called three times; when `getItems().length` is checked; then it equals 3 | Instance count matches F3 | BLOCKING |
| AC-INV-08 | Given a valid sale; when `sellItem(instanceId, price)` returns `true`; then `getItem(instanceId)` returns `null` and `hasItem(instanceId)` returns `false` | Item removed from inventory | BLOCKING |
| AC-INV-09 | Given an `instanceId` not in inventory; when `sellItem(unknownId, 5.00)` is called; then returns `false` and `earn()` is never called | No mutation, no earn side-effect | BLOCKING |
| AC-INV-10 | Given any item; when `sellItem(instanceId, 0)` or `sellItem(instanceId, -1)` is called; then `InventoryError` is thrown | Error thrown for salePrice ≤ 0 | BLOCKING |
| AC-INV-11 | Given localStorage contains corrupt JSON under `skin_inventory`; when inventory initializes; then `getItems()` returns `[]` with no crash | Graceful fallback to empty array | BLOCKING |
| AC-INV-12 | Given localStorage contains entries where some lack `instanceId`; when inventory loads; then only entries with valid `instanceId` are returned | Malformed entries silently discarded | BLOCKING |
| AC-INV-13 | Given localStorage contains two entries sharing the same `instanceId`; when inventory loads; then only the first occurrence is kept | Duplicate dropped; no error thrown | BLOCKING |
| AC-INV-14 | Given a valid item being sold; when `sellItem()` is called twice in rapid succession; then second call returns `false` and `earn()` is called exactly once | No double-credit on double-tap | BLOCKING |
| AC-INV-15 | Given `addItem()` is called; when the page reloads; then `getItems()` returns the same entry with identical `instanceId`, `acquiredAt`, and `item` | Full persistence round-trip | BLOCKING |
| AC-INV-16 | Given a sold item; when the page reloads; then `getItem(soldInstanceId)` returns `null` | Removal persisted across reload | BLOCKING |
| AC-INV-17 | Given any inventory state; when `clearInventory()` is called; then `getItems()` returns `[]` and a subsequent reload also returns `[]` | Clear persisted; array fully reset | BLOCKING |
| AC-INV-18 | Given `getItems()` is called; when the caller mutates the returned array; then a subsequent `getItems()` call returns the correct unmodified data | Shallow copy prevents external mutation | ADVISORY |

## Open Questions

1. **Sell fee UI display**: Should the Inventory UI show the breakdown ("Market: $5.23 → You get: $4.45") or just the net price? The fee is baked into the formula but whether to surface it is a UX decision for Inventory UI. → Flagged for Inventory UI (#14) GDD.

2. **`addItem()` persistence cost at scale**: Serializing the full array on every add/sell will grow in cost as inventory size increases. Is a debounce (e.g., save after 500 ms of inactivity) needed? → Benchmark during implementation; add debounce to Persistence layer if measurably slow.

3. **Sell-all atomic API**: The Inventory UI may want a single `sellAll()` call (sell everything and earn the total in one operation) rather than iterating `sellItem()` per item. Does Skin Inventory need to expose `sellAll(priceMap)`? → Defer to Inventory UI GDD; add to Skin Inventory API only if the UI confirms it needs it.

4. **Float/wear field in InventorySkinEntry (Full Vision)**: When the Wear/Float System ships, each instance will need a `float` value (e.g., 0.1842 = Field-Tested). The `InventorySkinEntry` schema will need a `float?: number` field. → No action in MVP; flagged for schema update when Wear/Float System (#18) is designed.

5. **`acquiredAt` display**: Should the Inventory UI show when each skin was acquired ("3 minutes ago")? Or is `acquiredAt` internal-only for future sort/filter use? → Flagged for Inventory UI (#14) GDD; `acquiredAt` is stored regardless.
