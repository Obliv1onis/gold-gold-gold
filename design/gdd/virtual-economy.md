# Virtual Economy

> **Status**: Complete — Pending Review
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Zero Friction · Faithful Over Flashy

## Overview

The Virtual Economy is the financial backbone of The Vault. It owns the player's virtual dollar balance, enforces all spending rules, and persists the balance to localStorage via the Persistence system. Every transaction in the game — buying a case, spending $2.49 on a key, selling a skin — flows through this system before any inventory state changes.

Players start with $2,000 of virtual USD and interact with the economy constantly: the balance is always visible in the HUD, it ticks down with every case open, and ticks up whenever an item is sold. The economy also provides the game's only "new game" mechanic: when a player's balance reaches $0 and their inventory holds nothing worth selling, they can trigger a full reset — balance returns to $2,000 and both inventories clear — starting the cycle again.

The system does not connect to real money, real prices, or any payment infrastructure. For MVP, prices are hardcoded approximations of real CS2 market values. In Vertical Slice, prices are fetched from a live price API. The economy system itself is price-agnostic — it operates on whatever dollar values the Case Data Store (for case prices) and Price API Layer (for live prices) provide.

## Player Fantasy

The player is a CS2 economy participant with real stakes — or so it feels. $2,000 sits in their wallet and every decision matters: is this case worth its market price? Should they sell this Classified skin now or hold it? Can they beat the odds enough to grow the bankroll, or will they spiral down to $0 chasing a knife?

The fantasy has two layers that reinforce each other. The first is the trader's mindset — the same mental model a real CS2 market player uses, but with no real wallet risk. Players feel the satisfaction of a good "profit" when a case yields a skin worth more than the $2.49 key + case cost, and the sting of another Consumer-grade drop against the odds. The second layer is the meta-game of the running total: watching $2,000 tick down or (occasionally) back up creates a continuous feedback loop that no single case open provides on its own.

When the balance hits $0, the tone shifts: the reset isn't a punishment, it's a clean slate. The $2,000 returns and the inventory wipes — ready to try a different strategy, a different case, or just to open again without the weight of a depleted run.

This system serves **Pillar 2: Zero Friction** — the balance must always be visible and the spend/earn feedback must be instant. And it serves **Pillar 1: Faithful Over Flashy** — the dollar amounts and key cost must mirror real CS2 values, not rounded or invented numbers.

## Detailed Design

### Core Rules

1. **Balance** is a non-negative float representing virtual USD (e.g., `2000.00`). It is the single authoritative number the Virtual Economy owns.
2. **Starting balance** is `$2,000.00`. Set on first load if no saved balance exists in localStorage. Never overwritten if a valid saved balance is found.
3. **Floor** is `$0.00`. Balance cannot go negative. Spending is **blocked** (returns `false`) if the requested amount exceeds the current balance — balance is never clamped downward below zero.
4. **Key cost constant** (`KEY_COST_USD = 2.49`) is defined and owned by this system. No other system hard-codes `$2.49` — they reference this constant.
5. **Spending is atomic**: `spend(amount)` checks affordability, deducts, and persists in a single call. If the check fails, no mutation occurs and `false` is returned. There is no partial deduction.
6. **Earnings have no ceiling**: `earn(amount)` always succeeds. Balance can exceed $2,000 (a player who sells a Covert skin can recoup more than they started with).
7. **Reset** sets balance to `STARTING_BALANCE` ($2,000.00) and persists. The Virtual Economy owns only the balance reset — inventory clearing is **not** performed here. The App Shell (or Case Opening Orchestrator) orchestrates the inventory clearing after calling `reset()`.
8. **All mutations persist immediately** via Persistence. Balance is never held in memory without also being written to localStorage.

**Public API:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `getBalance` | `(): number` | Returns current balance |
| `canAfford` | `(amount: number): boolean` | True if `balance >= amount` |
| `spend` | `(amount: number): boolean` | Deduct `amount` if affordable; persist; return `true`. Return `false` without mutation if insufficient. |
| `earn` | `(amount: number): void` | Add `amount` to balance; persist |
| `reset` | `(): void` | Set balance to `STARTING_BALANCE`; persist |

**Events fired on `document`:**

| Event | Fired when |
|-------|------------|
| `balance-changed` | After any mutation: `spend()` (on success), `earn()`, `reset()`. Fired as `new CustomEvent("balance-changed", { detail: { balance: getBalance() } })`. The HUD listens for this to update the displayed balance reactively without polling. |

**Constants:**

| Name | Value | Description |
|------|-------|-------------|
| `STARTING_BALANCE` | `2000.00` | Starting and reset-to balance |
| `KEY_COST_USD` | `2.49` | Fixed key cost per case open — matches real CS2 key price |
| `BALANCE_FLOOR` | `0.00` | Minimum allowed balance |
| `PERSISTENCE_KEY` | `"balance"` | localStorage key used by Persistence |

### States and Transitions

The Virtual Economy has two meaningful states driven by the balance value:

| State | Condition | Effect |
|-------|-----------|--------|
| **Solvent** | `balance > 0` | Player can spend if they can afford any transaction |
| **Depleted** | `balance === 0` | All spend calls return `false`; HUD shows Reset prompt |

Transitions:
- **Solvent → Depleted**: Any `spend()` call that reduces balance exactly to `$0.00`
- **Depleted → Solvent**: `reset()` call (sets balance to $2,000) OR `earn()` call while at $0 (e.g., selling a skin from inventory)
- **Any → Any**: Balance changes are synchronous and immediate; no transition animations or delays are owned by this system

> Note: A player at $0 who still holds sellable skins is **not fully depleted** — they can call `earn()` by selling from Skin Inventory and return to Solvent. The HUD App Shell owns the Reset button visibility rule and checks both conditions: balance === $0 AND inventory empty (see `hud-app-shell.md`).

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Persistence** | ↑ depends on | `Persistence.save("balance", value)` / `Persistence.load("balance", 2000.00)` — called on every mutation and on init |
| **Case Inventory** (#7) | ↓ depended on by | Case Inventory calls `canAfford(casePrice)` before buying a case; calls `spend(casePrice)` on purchase |
| **Case Opening Orchestrator** (#9) | ↓ depended on by | Orchestrator calls `canAfford(casePrice + KEY_COST_USD)` before spin; calls `spend(casePrice + KEY_COST_USD)` to deduct the full open cost atomically |
| **Skin Inventory** (#8) | ↓ depended on by | Skin Inventory calls `earn(salePrice)` when player sells an item |
| **HUD / App Shell** (#11) | ↓ depended on by | HUD reads `getBalance()` to display; re-evaluates `canAfford()` after each balance change to enable/disable the Open button |
| **Case Browser UI** (#15) | ↓ depended on by | Case Browser reads balance to display cases as affordable (green) or unaffordable (greyed) |
| **Market Browser UI** (#17) | ↓ depended on by | Market Browser calls `spend()` / `earn()` for direct skin purchases (Vertical Slice) |

**Separation of concerns — who owns what at case open time:**
- Virtual Economy validates: `canAfford(casePrice + KEY_COST_USD)`
- Case Inventory validates: player owns at least one of this case
- Orchestrator checks both, then calls: `virtualEconomy.spend(total)` + `caseInventory.removeCase(caseId)` — before the reel spin begins

## Formulas

#### F1: Total Case Open Cost

```
total_open_cost = case_market_price + KEY_COST_USD
```

| Variable | Type | Source | Range |
|----------|------|--------|-------|
| `case_market_price` | float (USD) | Case Data Store — `CaseEntry.market_price` | $0.01 – ~$50.00 |
| `KEY_COST_USD` | constant (USD) | Virtual Economy — owned here | $2.49 (fixed) |
| `total_open_cost` | float (USD) | — | $2.50 – ~$52.49 |

*Example: Recoil Case ($0.50) + key ($2.49) = $2.99 per open.*

#### F2: Spend Check

```
can_spend = balance >= requested_amount
```

| Variable | Type | Description |
|----------|------|-------------|
| `balance` | float (USD) | Current balance — read from state |
| `requested_amount` | float (USD) | Amount to deduct |
| `can_spend` | boolean | If false, spend() returns false without mutation |

#### F3: Balance After Spend

```
new_balance = balance - amount    (only evaluated when can_spend = true)
```

Floor: `new_balance` ≥ `BALANCE_FLOOR` (0.00) — enforced by F2 check before this runs.

#### F4: Balance After Earn

```
new_balance = balance + sale_price
```

| Variable | Type | Source | Range |
|----------|------|--------|-------|
| `sale_price` | float (USD) | Case Data Store — `ItemEntry.market_price` | $0.01 – ~$50,000 (knife/gloves) |

No ceiling. Balance can exceed $2,000.

#### F5: Expected Value Per Open (display formula — not stored)

```
EV = weighted_average(item.market_price) - total_open_cost
```

This formula is **not implemented by the Virtual Economy system** — it is referenced here for documentation. The Drop Rate Engine and Case Browser UI own expected value display. Virtual Economy does not compute or store EV.

## Edge Cases

**E1: Floating-point precision in balance**
Dollar amounts stored as JavaScript floats accumulate rounding errors. Example: `2000.00 - 2.49` may produce `1997.5099999999998`. The system must round balance to 2 decimal places after every mutation before persisting.
*Handling*: `Math.round(value * 100) / 100` applied after every spend/earn operation.

**E2: Negative or zero `amount` passed to `spend()` or `earn()`**
`spend(0)`, `spend(-5)`, or `earn(-1)` should not silently succeed or corrupt state.
*Handling*: Both methods throw `EconomyError("amount must be positive")` if `amount <= 0`.

**E3: Player opens a case that costs more than their entire balance**
`canAfford(casePrice + KEY_COST_USD)` returns `false`. `spend()` returns `false`. The reel does not spin.
*Handling*: Handled by Rule 3 (floor blocking) and Rule 5 (atomic spend). The Open button is pre-disabled by the HUD when this condition is true.

**E4: `earn()` called after selling an item while balance is $0**
Player has $0, sells a $1.50 skin.
*Handling*: `earn(1.50)` succeeds — balance becomes $1.50. State transitions Depleted → Solvent. HUD re-enables affordability checks.

**E5: `reset()` called while balance > $0**
Player has $500 and clicks Reset deliberately.
*Handling*: Allowed. `reset()` sets balance to $2,000. Inventory clearing is orchestrated by the App Shell immediately after. No confirmation dialog is owned by this system — that is a UX decision for HUD/App Shell.

**E6: Corrupt or missing balance in localStorage**
`Persistence.load("balance")` returns `null`, `undefined`, `NaN`, or a non-numeric string.
*Handling*: Any non-valid-number is treated as "first load" and balance is set to `STARTING_BALANCE` ($2,000). A valid number that is negative is clamped to $0. A valid number > 9,999,999 is clamped to 9,999,999 (sanity ceiling against corruption — not a gameplay ceiling).

**E7: Concurrent `spend()` calls**
JavaScript is single-threaded; true concurrency is not possible in this architecture.
*Handling*: Not applicable — document as not a concern in single-threaded JS web app context. UI must disable the Open button during animation to prevent double-click paths.

**E8: Floating-point drift after many transactions**
After hundreds of opens, floating-point errors may accumulate.
*Handling*: The `Math.round(value * 100) / 100` normalization from E1 applies after every mutation — drift cannot compound because each persistence round-trip resets the precision floor.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Persistence** (#3) | Reads and writes balance to localStorage | `Persistence.save("balance", number)` / `Persistence.load("balance", 2000.00)` |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they call |
|--------|-----------------|----------------|
| **Case Inventory** (#7) | Deducts balance when buying a case | `canAfford(casePrice)`, `spend(casePrice)` |
| **Skin Inventory** (#8) | Credits balance when selling a skin | `earn(salePrice)` |
| **Case Opening Orchestrator** (#9) | Deducts total open cost (case + key) atomically before spin | `canAfford(total)`, `spend(total)`, `KEY_COST_USD` constant |
| **HUD / App Shell** (#11) | Displays balance; enables/disables Open button; shows Reset prompt at $0 | `getBalance()`, `canAfford(amount)`, `reset()` |
| **Case Browser UI** (#15) | Shows cases as affordable or unaffordable | `getBalance()`, `canAfford(casePrice + KEY_COST_USD)` |
| **Market Browser UI** (#17) | Deducts balance on direct skin purchase; credits on sale (Vertical Slice) | `canAfford(price)`, `spend(price)`, `earn(salePrice)` |

**Constants this system owns (referenced by others):**

| Constant | Value | Downstream users |
|----------|-------|-----------------|
| `KEY_COST_USD` | $2.49 | Case Opening Orchestrator, HUD |
| `STARTING_BALANCE` | $2,000.00 | HUD (initial display), App Shell (reset flow) |

## Tuning Knobs

| Knob | Current Value | Safe Range | Effect of Change |
|------|--------------|-----------|-----------------|
| `STARTING_BALANCE` | $2,000.00 | $500 – $10,000 | Higher = more runway before depletion; lower = faster pressure. $2,000 chosen to match the feel of "a realistic CS2 budget" without lasting forever. |
| `KEY_COST_USD` | $2.49 | $0.99 – $4.99 | Matches real CS2 key price. Changing breaks Pillar 1 (Faithful Over Flashy) — do not change unless real CS2 key price changes. |
| `BALANCE_FLOOR` | $0.00 | — | Do not change. Negative balances would require credit modeling that breaks the game's design. |
| Rounding precision | 2 decimal places | 0 – 4 | 2dp matches money convention. 0dp makes economy feel like a clicker game. 4dp is unnecessarily granular for a dollar-denominated economy. |
| Sanity ceiling | $9,999,999 | $1,000,000 – $99,999,999 | Only triggers on corrupt saved data. Safe to raise; no gameplay effect under normal use. |

> `KEY_COST_USD` is a **fidelity constant**, not a balance knob. It must track the real CS2 key price if that ever changes. Changing it for gameplay balance reasons would contradict Pillar 1.

## Acceptance Criteria

1. **GIVEN** no `balance` key exists in localStorage, **WHEN** the Virtual Economy module initializes, **THEN** `getBalance()` returns exactly `2000.00`.

2. **GIVEN** `localStorage["balance"]` contains `"1234.56"` from a previous session, **WHEN** the Virtual Economy module initializes, **THEN** `getBalance()` returns exactly `1234.56` (persisted value overrides the $2,000 default).

3. **GIVEN** `localStorage["balance"]` contains the corrupt string `"notanumber"`, **WHEN** the Virtual Economy module initializes, **THEN** `getBalance()` returns exactly `2000.00` (fallback to STARTING_BALANCE).

4. **GIVEN** a balance of `2000.00`, **WHEN** `spend(2.49)` is called, **THEN** `spend()` returns `true`, `getBalance()` returns `1997.51`, and `localStorage["balance"]` contains `"1997.51"` — not `"1997.5099999..."` (floating-point rounding applied before persist).

5. **GIVEN** a balance of `2.00`, **WHEN** `spend(2.49)` is called, **THEN** `spend()` returns `false`, `getBalance()` still returns `2.00`, and `localStorage["balance"]` is unchanged (no mutation on insufficient funds).

6. **GIVEN** a balance exactly equal to the spend amount (e.g., balance `2.49`, `spend(2.49)`), **WHEN** the call completes, **THEN** `spend()` returns `true` and `getBalance()` returns `0.00` (boundary: `balance >= amount` is satisfied at equality).

7. **GIVEN** any balance, **WHEN** `spend(0)` is called, **THEN** an `EconomyError` is thrown with message `"amount must be positive"` and the balance is unchanged.

8. **GIVEN** any balance, **WHEN** `earn(-1)` is called, **THEN** an `EconomyError` is thrown with message `"amount must be positive"` and the balance is unchanged.

9. **GIVEN** a balance of `0.00`, **WHEN** `earn(1.50)` is called, **THEN** `getBalance()` returns `1.50` and `localStorage["balance"]` is updated (no ceiling; earn succeeds from zero balance).

10. **GIVEN** a balance of `9000.00` (above STARTING_BALANCE), **WHEN** `reset()` is called, **THEN** `getBalance()` returns exactly `2000.00` and `localStorage["balance"]` is updated (reset overwrites any value, high or low).

11. **GIVEN** any balance, **WHEN** `canAfford(0)` is called, **THEN** `canAfford()` returns `true` (balance ≥ 0 is always satisfied at any non-negative balance including $0.00).

12. **GIVEN** a balance of `1997.51` set via a prior `spend(2.49)` call, **WHEN** the page is reloaded and `getBalance()` is called, **THEN** `getBalance()` returns exactly `1997.51` — confirming the rounded value survived the localStorage round-trip without further drift.

## Open Questions

1. **Balance change notification pattern**: How does the HUD observe balance changes? Options: (a) HUD polls `getBalance()` periodically, (b) Virtual Economy fires a custom DOM event on mutation, (c) the Orchestrator explicitly calls a HUD update method after each transaction. → Becomes an ADR when HUD/App Shell (#11) is designed.

2. **Sell-price source for MVP**: `earn(salePrice)` receives the price from whoever calls it (Skin Inventory). In MVP with hardcoded prices, this is `ItemEntry.market_price` from Case Data Store. Is there a sell fee/discount (e.g., Steam's 15% market fee)? → Fidelity question: CS2 Steam Market charges ~15%. Decide whether to model this in MVP or skip for simplicity.

3. **Balance display format**: Should the HUD show `$1997.51` or `$1,997.51`? Locale formatting is a HUD/App Shell concern, not Virtual Economy's. → Flagged for HUD GDD.

4. **`canAfford(0)` behavior**: The acceptance criteria state it returns `true`. Is this intentional (0-cost items could exist in future)? Currently no free items exist — but the rule should be explicit before Case Inventory is designed.

5. **Reset confirmation UX**: `reset()` is destructive and irreversible. Does the HUD show a confirmation modal before calling it? → HUD/App Shell decision. Virtual Economy does not own this.
