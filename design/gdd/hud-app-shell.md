# HUD / App Shell

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-20
> **Implements Pillar**: Zero Friction · Faithful Over Flashy

## Overview

The HUD / App Shell is the outer container of The Vault. It provides the application's structural layout, renders the persistent heads-up display (balance, Open button, case count), and orchestrates the full reset flow. Every other UI system (Reel UI, Reveal UI, Inventory UI, Case Browser UI) exists inside the shell's content region — the shell provides the frame; the others provide the content.

The HUD region at the top of the shell shows the player's virtual balance, the cost of the next open, and how many of the selected case remain in inventory. The Open button — the single most important interactive element in the app — lives in the HUD and is managed here: enabled when the player has a case and can afford the open cost, disabled while the reel is animating or conditions are not met.

Balance updates arrive via a `balance-changed` custom DOM event fired by Virtual Economy on every mutation. The shell listens for this event and re-renders the balance display immediately — no polling, no explicit HUD-refresh calls from callers.

The reset flow is owned and orchestrated here: when triggered (with user confirmation), the shell calls `VirtualEconomy.reset()`, then `CaseInventory.clearInventory()`, then `SkinInventory.clearInventory()` in sequence, then refreshes all HUD elements. The Reset button appears only when the player's balance is `$0.00` — it is the game's only "new game" mechanic.

## Player Fantasy

The HUD is the player's dashboard — the number they're tracking, the button they keep clicking. The balance display is not just a readout: it's the scoreboard for the entire session. Every open, every sell, the number changes and the player feels it. A balance ticking upward after a lucky drop is a small win. Watching it fall toward $0 across a losing streak is genuine tension.

The Open button's state carries its own emotional weight. When it's lit and active, the next spin is one click away — there's no friction, no second-guessing required. When it dims (no case, or no funds), the player feels the constraint. They need to buy more cases, or sell something, or accept the run is over.

The reset moment is the session's punctuation mark. The confirmation dialog is not friction — it's the pause before the clean slate. The balance wiping back to $2,000 and the inventory clearing should feel like a deliberate choice, not an accident. A fresh run starts here.

The shell serves **Pillar 2: Zero Friction** by keeping the Open button one click away at all times and the balance always visible. It serves **Pillar 1: Faithful Over Flashy** by displaying real dollar amounts that match CS2's economy — not abstracted points or keys.

## Detailed Design

### Core Rules

**HUD Layout:**

The HUD is a persistent top bar containing three regions:

| Region | Content |
|--------|---------|
| **Balance display** | `$X,XXX.XX` — current virtual balance in USD, formatted with commas and 2dp |
| **Open section** | Open button + cost display (`$X.XX per open`) + case count badge (`N owned`) |
| **Action section** | Reset button (visible only when balance is $0.00) |

**App Shell Layout:**

```
┌────────────────────────────────────────┐
│  HUD Bar  [Balance] [Open Btn] [Reset] │
├────────────────────────────────────────┤
│                                        │
│         Content Region                 │
│   (Reel UI / Inventory UI / etc.)      │
│                                        │
└────────────────────────────────────────┘
```

In MVP, the content region shows the Reel UI. Navigation to Inventory UI is via a tab or button in the shell. No Case Browser UI in MVP (Recoil Case is pre-selected; Case Browser is Vertical Slice).

**Open Button State Rules:**

The Open button is evaluated after every balance change, case count change, or animation state change. It is **enabled** if and only if ALL three conditions are true:

```
isAnimating === false
AND CaseInventory.hasCase(selectedCaseId) === true
AND VirtualEconomy.canAfford(selectedCasePrice + KEY_COST_USD) === true
```

If any condition fails, the button is **disabled**. The shell re-evaluates on:
- `balance-changed` event (from Virtual Economy)
- `case-inventory-changed` event (from Case Inventory)
- `onReady()` event (from Case Opening Orchestrator)
- `onBlocked()` event (from Case Opening Orchestrator)

The button label shows the open cost: `Open ($X.XX)` where `X.XX = selectedCasePrice + KEY_COST_USD`. In MVP with one case (Recoil Case at ~$0.50), this always reads `Open ($2.99)`.

**Balance Display:**

- Updated on every `balance-changed` DOM event
- Format: `$` + number with commas + 2 decimal places (e.g., `$1,997.51`)
- Updates immediately on event receipt — no animation in MVP

**Case Count Badge:**

- Displays: `N owned` where N = `CaseInventory.getCaseCount(selectedCaseId)`
- Updated on every `case-inventory-changed` event
- In MVP, `selectedCaseId` is always `"recoil_case"` (hardcoded)

**Reset Button Visibility:**

The Reset button is shown when **both** conditions are true:
1. `VirtualEconomy.getBalance() === 0.00`
2. `SkinInventory.getItems().length === 0` (no sellable items in inventory)

A player at $0 who still holds skins can sell them to return to Solvent — showing Reset prematurely would allow them to accidentally wipe a valuable inventory. Visibility is re-evaluated after every `balance-changed` and `skin-inventory-changed` event.

**Reset Flow (on Reset button click):**

```
1. Shell shows confirmation dialog: 
   "Start over? This will clear your balance and all inventory. It cannot be undone."
   [Confirm Reset] [Cancel]

2. If cancelled → no state change. Dialog closes.

3. If confirmed:
   a. VirtualEconomy.reset()            → balance → $2,000.00 (fires balance-changed)
   b. CaseInventory.clearInventory()    → count map → {}
   c. SkinInventory.clearInventory()    → skin array → []
   d. Shell re-evaluates Open button (disabled — no cases owned post-reset)
   e. Reset button hidden (balance > $0)
```

Step (a) fires `balance-changed`, triggering the balance display to update automatically. Steps (b) and (c) do not fire events — the shell calls them synchronously and manually refreshes the case count badge and inventory display.

**Events the App Shell listens to:**

| Event | Source | Action |
|-------|--------|--------|
| `balance-changed` | Virtual Economy (DOM custom event) | Re-render balance; re-evaluate Open button; re-evaluate Reset button visibility |
| `case-inventory-changed` | Case Inventory (DOM custom event) | Re-render case count badge; re-evaluate Open button |
| `skin-inventory-changed` | Skin Inventory (DOM custom event) | Re-evaluate Reset button visibility (condition 2: inventory empty check) |
| `onBlocked(reason)` | Case Opening Orchestrator | Show brief error indicator |
| `onReady()` | Case Opening Orchestrator | Re-evaluate Open button |
| `onReveal(entry)` | Case Opening Orchestrator | Pass to Reveal UI for display |

*`case-inventory-changed` and `skin-inventory-changed` require their respective systems to fire DOM events on mutation. This is a design requirement on those GDDs.*

### States and Transitions

**Open Button States:**

| State | `isAnimating` | `hasCase` | `canAfford` | Appearance |
|-------|--------------|-----------|-------------|-----------|
| **Ready** | false | true | true | Active / clickable |
| **No Case** | false | false | — | Disabled — "No cases owned" |
| **Insufficient Funds** | false | — | false | Disabled — "Insufficient balance" |
| **Animating** | true | — | — | Disabled — no tooltip |

**Reset Button States:**

| State | Balance | Appearance |
|-------|---------|-----------|
| **Hidden** | > $0.00 | Not rendered |
| **Visible** | $0.00 | Rendered and clickable |
| **Confirming** | $0.00 | Confirmation modal open |

### Interactions with Other Systems

| System | Direction | Interface | Notes |
|--------|-----------|-----------|-------|
| **Virtual Economy** (#6) | ↑ depends on | `getBalance()`, `canAfford(amount)`, `reset()` | Listens to `balance-changed` DOM event |
| **Case Inventory** (#7) | ↑ depends on | `getCaseCount(caseId)`, `hasCase(caseId)`, `clearInventory()` | Listens to `case-inventory-changed` DOM event |
| **Skin Inventory** (#8) | ↑ depends on | `clearInventory()` | Called during reset flow only |
| **Case Opening Orchestrator** (#9) | ↑ depends on | `openCase(caseId, casePrice)` | Called on Open button click; listens to `onReady`, `onBlocked`, `onReveal` |
| **Reel UI** (#12) | ↓ depended on by | — | Rendered inside content region |
| **Reveal UI** (#13) | ↓ depended on by | — | Triggered on `onReveal(entry)` |
| **Inventory UI** (#14) | ↓ depended on by | — | Rendered in content region on navigation |
| **Case Browser UI** (#15) | ↓ depended on by | Activation mechanism → ADR (OQ-1 in case-browser-ui.md) | Opened and closed by the HUD (Vertical Slice) |
| **Market Browser UI** (#17) | ↓ depended on by | Activation mechanism → ADR (OQ-1 in market-browser-ui.md) | Opened and closed by the HUD (Vertical Slice) |

## Formulas

This system contains no mathematical formulas. All logic is conditional (button state evaluation, balance display formatting).

#### F1: Open Button Enable Condition

```
open_enabled = !isAnimating AND hasCase(selectedCaseId) AND canAfford(selectedCasePrice + KEY_COST_USD)
```

All three sub-conditions must be true simultaneously. Re-evaluated after every triggering event.

#### F2: Balance Display Format

```
display_balance = "$" + balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```

*Example: `2000.00` → `"$2,000.00"`, `997.51` → `"$997.51"`.*

#### F3: Open Button Label Cost

```
label_cost = selectedCasePrice + KEY_COST_USD
```

Displayed as `Open ($[label_cost])`. In MVP with Recoil Case: `0.50 + 2.49 = 2.99` → `"Open ($2.99)"`.

## Edge Cases

**E1: `balance-changed` fires while the confirmation modal is open**
*Handling*: Balance display updates immediately. Open button re-evaluates. Modal remains open — the reset flow is not interrupted or cancelled.

**E2: Reset button clicked while `isAnimating` is true**
In normal flow this is unlikely because Reset requires `balance === $0 AND inventory empty` — a player who can afford to open a case shouldn't have both conditions true simultaneously. As a defensive check:
*Handling*: Shell checks `isAnimating` before proceeding past the confirmation dialog. If `isAnimating === true`, the reset is aborted and the dialog closes with no state change. This is the primary guard that prevents `SkinInventory.clearInventory()` from being called mid-spin (see `skin-inventory.md` E6).

**E3: `VirtualEconomy.reset()` succeeds but `CaseInventory.clearInventory()` throws**
*Handling*: Log the error. The shell still calls `SkinInventory.clearInventory()` — do not abort mid-chain. Game is in a partially reset state (accepted MVP risk).

**E4: `balance-changed` event fires with `NaN` or `null` as the balance payload**
*Handling*: Shell validates the event payload. If not a valid number, calls `VirtualEconomy.getBalance()` directly as fallback. Does not display `NaN`.

**E5: Player navigates to Inventory while a reel spin is in progress**
*Handling*: Navigation is allowed — it does not cancel the animation. The `onReveal` callback fires normally when the reel completes. The Reveal UI must activate regardless of which view is current. Selling items from Inventory mid-spin is safe: `sellItem()` operates on existing entries only; the in-flight `addItem()` from the spin has not yet run, so there is no race between the sell and the new item landing.

**E6: `selectedCasePrice` is undefined (data error or missing market_price field)**
*Handling*: Open button is disabled. Label shows `Open (—)`. No open can be initiated with a missing price.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Virtual Economy** (#6) | Balance read, affordability check, balance reset | `getBalance()`, `canAfford(amount)`, `reset()` — listens to `balance-changed` DOM event |
| **Case Inventory** (#7) | Case ownership check, case count display, inventory clear on reset | `getCaseCount(caseId)`, `hasCase(caseId)`, `clearInventory()` — listens to `case-inventory-changed` DOM event |
| **Skin Inventory** (#8) | Inventory clear on reset | `clearInventory()` |
| **Case Opening Orchestrator** (#9) | Open button triggers open; shell listens for animation state events | `openCase(caseId, casePrice)` call; `onReady`, `onBlocked`, `onReveal` events |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they rely on |
|--------|-----------------|------------------|
| **Reel UI** (#12) | Rendered inside shell's content region | App Shell provides the container element |
| **Reveal UI** (#13) | Displayed on `onReveal` event | Shell passes the entry to Reveal UI |
| **Inventory UI** (#14) | Rendered when player navigates to Inventory | Shell switches content region |
| **Case Browser UI** (#15) | Opened as a modal overlay by a HUD control (Vertical Slice) | Shell triggers open/close via mechanism TBD (see case-browser-ui.md OQ-1) |

**Pending GDD updates (design requirements surfaced here):**
- Case Inventory GDD must be updated to fire a `case-inventory-changed` DOM event on every `buyCase()`, `removeCase()`, and `clearInventory()` call.
- Virtual Economy GDD must be updated to fire a `balance-changed` DOM event on every `spend()`, `earn()`, and `reset()` call.

## Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|------------|--------|
| `RESET_REQUIRES_CONFIRMATION` | true | true / false | If false, Reset fires immediately without a dialog. Leave true in production — accidental full resets are irreversible. |
| `SHOW_OPEN_COST_IN_LABEL` | true | true / false | If false, button reads just "Open" without the `($X.XX)` cost. Hiding cost reduces friction awareness but is less faithful to real CS2's price visibility. |
| `BALANCE_VISIBLE_AT_DEPLETED` | true | true / false | If false, balance display is replaced by a "Depleted" state banner at $0. Leave true — balance remaining visible even at $0 is informative. |

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-HUD-01 | App loads with balance $2,000.00 | Balance display shows `$2,000.00` | BLOCKING |
| AC-HUD-02 | `spend(2.99)` is called (via a case open) | Balance display updates to `$1,997.01` immediately after `balance-changed` fires | BLOCKING |
| AC-HUD-03 | Player owns 3 Recoil Cases | Case count badge shows `3 owned` | BLOCKING |
| AC-HUD-04 | Player owns 1 case and balance ≥ open cost | Open button is enabled | BLOCKING |
| AC-HUD-05 | Player owns 0 cases | Open button is disabled | BLOCKING |
| AC-HUD-06 | Player cannot afford the open cost | Open button is disabled | BLOCKING |
| AC-HUD-07 | `isAnimating` is true (reel spinning) | Open button is disabled | BLOCKING |
| AC-HUD-08 | `onReady()` fires after 8600ms | Open button re-evaluates; becomes enabled if conditions pass | BLOCKING |
| AC-HUD-09 | Balance reaches exactly $0.00 AND skin inventory is empty | Reset button becomes visible | BLOCKING |
| AC-HUD-09b | Balance reaches exactly $0.00 AND skin inventory has ≥1 item | Reset button remains hidden | BLOCKING |
| AC-HUD-10 | Balance is $0.50 (above zero) | Reset button is not rendered | BLOCKING |
| AC-HUD-11 | Player clicks Reset → clicks Confirm | Reset flow: balance → $2,000, case count → 0, skin inventory → empty | BLOCKING |
| AC-HUD-12 | Player clicks Reset → clicks Cancel | No state change; dialog closes | BLOCKING |
| AC-HUD-13 | `earn(1.50)` while balance is $0 | Balance display updates to `$1.50`; Reset button disappears | BLOCKING |
| AC-HUD-14 | Balance is $997.51 | Display shows `$997.51` | BLOCKING |
| AC-HUD-15 | Balance is $1,997.51 | Display shows `$1,997.51` (with comma) | BLOCKING |
