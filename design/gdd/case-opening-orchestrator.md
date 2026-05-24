# Case Opening Orchestrator

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-20
> **Implements Pillar**: Zero Friction · Faithful Over Flashy

## Overview

The Case Opening Orchestrator is the sequencing layer that turns a button press into a completed case open. It coordinates six systems — Virtual Economy, Case Inventory, Drop Rate Engine, Reel Animation Engine, Audio System, and Skin Inventory — in a fixed, ordered call chain. No other system owns this sequence; the Orchestrator is the single entry point for every open.

The Orchestrator's contract is simple: given a `caseId` and a `casePrice`, it validates that the player can and should proceed, draws the winning item, charges the player, starts the reel, fires audio events as the reel progresses, and deposits the item into the player's skin inventory when the animation completes. If validation fails, nothing happens. If the reel roll throws, nothing is charged. The player never sees a partially-completed state.

From the player's perspective, the Orchestrator is invisible. What they experience is one coherent moment: press Open → reel spins → item locks in → reveal flash and chord. Every system boundary is hidden; the felt experience is a single, seamless animation sequence. The Orchestrator's design goal is to make that sequence feel instantaneous to trigger and satisfying to watch — Zero Friction start, Faithful Over Flashy execution.

In MVP, the Orchestrator manages one open at a time. It maintains an `isAnimating` guard that blocks re-entry while a spin is in progress: the Open button cannot be pressed again until `onComplete` fires and the reveal chord has played.

## Player Fantasy

The moment the player clicks Open, they hand control to something larger than themselves. The case has been bought, the balance has been spent, and now it's out of their hands — the reel decides. That suspension between press and reveal, where the outcome is already chosen but not yet known, is the core emotional target. The Orchestrator owns that entire arc.

Three beats make up the fantasy:

**1. The commitment.** The Open button activates only when the player has a case *and* can afford the key. That validation isn't friction — it's confirmation. Clicking Open is a deliberate act, not an accident. The moment the button registers, the player has committed to the outcome, whatever it is.

**2. The spin.** The reel starting immediately — no loading, no delay — is the payoff for the commitment. The blur-to-slow animation, the rising tick pitch, the sense of the reel "searching" for where to land: this is the suspense phase. The player watches but cannot intervene. The Orchestrator keeps this uninterrupted; nothing should break the animation once it starts.

**3. The reveal.** When the selected item locks center-screen, the reveal chord fires and the rarity flash confirms the result. The player's first look at what they got — before the name even registers — is the emotional peak. For high-rarity drops, the chord and flash amplify the moment. For common drops, it's honest: here's what you got, clean and immediate. No spin, no artificially extended suspense past what the reel delivers.

The Orchestrator serves **Pillar 1: Faithful Over Flashy** by delivering this sequence as CS2 does it — not embellished — and **Pillar 2: Zero Friction** by ensuring the path from click to reveal is never interrupted. Its success criteria is not "impressive code" but "the player wants to click again."

## Detailed Design

### Core Rules

1. **Single entry point**: `openCase(caseId: string, casePrice: number): void` is the only method that initiates a case open. No other code path may call `spend()`, `removeCase()`, `addItem()`, or `spin()` as part of a case open flow.

2. **Re-entry guard**: If `isAnimating === true` when `openCase()` is called, the method returns immediately with no action and no event. The Open button must be disabled while `isAnimating` is true — the Orchestrator does not queue or defer the call.

3. **Fixed call chain — Validate → Roll → Spend → Spin:**

```
Step 1: CaseInventory.hasCase(caseId)
        → false: emit onBlocked("no_case"); return.

Step 2: VirtualEconomy.canAfford(casePrice + KEY_COST_USD)
        → false: emit onBlocked("insufficient_funds"); return.

Step 3: selectedItem = DropRateEngine.roll(caseId)
        → throws RollError: emit onBlocked("roll_error"); return.
        (No balance deducted, no case consumed if roll fails.)

Step 4: VirtualEconomy.spend(casePrice + KEY_COST_USD)

Step 5: CaseInventory.removeCase(caseId)

Step 6: isAnimating = true

Step 7: ReelAnimationEngine.spin(caseId, selectedItem, ReelUI.viewportWidth, {
          onFrame: (offset, strip) => ReelUI.render(offset, strip),
          onTick: (pitch) => AudioSystem.playTick(pitch),
          onComplete: () => {
            AudioSystem.playReveal()
            const newEntry = SkinInventory.addItem(selectedItem)
            emit onReveal(newEntry)
            setTimeout(() => {
              isAnimating = false
              emit onReady()
            }, CHORD_DECAY_MS)
          }
        })
```

4. **Roll-before-spend protection**: `roll()` is called at Step 3, before any balance deduction. If `roll()` throws a `RollError` (malformed case data, empty item pool), the open is aborted cleanly — the player's balance and case count are unchanged.

5. **No rollback after Step 4**: Once `spend()` and `removeCase()` succeed, the open is committed. If a crash or tab close occurs between Step 5 and the `addItem()` call in `onComplete`, the item is unrecoverable. This is an accepted MVP risk — inventory data is non-authoritative in a single-player simulator.

6. **`CHORD_DECAY_MS` delay before re-enable**: After `onComplete` fires, the Orchestrator waits `CHORD_DECAY_MS` (800ms, matching `chord_decay_ms` from Audio System) before setting `isAnimating = false` and emitting `onReady()`. This prevents the player from immediately triggering another open while the reveal chord is still playing.

7. **No internal state beyond `isAnimating`**: The Orchestrator holds no history, no cumulative counters, no cached item. It sequences one open and forgets. All persistent state lives in the systems it calls.

**Public interface:**

| Member | Type | Description |
|--------|------|-------------|
| `openCase` | `(caseId: string, casePrice: number) → void` | Initiates a case open. No-op if `isAnimating` is true. |
| `isAnimating` | `boolean` (read-only) | True while a spin is in progress or the reveal chord is playing. |
| `onReveal` | event / callback | Fires with the `InventorySkinEntry` after `addItem()` succeeds. Reveal UI listens here. |
| `onBlocked` | event / callback | Fires with a reason string when an open attempt is rejected. HUD listens to show error state. |
| `onReady` | event / callback | Fires when `isAnimating` resets to false. HUD listens to re-enable the Open button. |

*Note: The exact event dispatch pattern (DOM CustomEvents, callback props, or an EventEmitter module) is an implementation concern that does not affect the design contract specified here.*

**Constants used:**

| Name | Value | Source |
|------|-------|--------|
| `KEY_COST_USD` | $2.49 | `design/gdd/virtual-economy.md` (registry: `key_cost_usd`) |
| `CHORD_DECAY_MS` | 800ms | `design/gdd/audio-system.md` (registry: `chord_decay_ms`) |

### States and Transitions

| State | `isAnimating` | Entry | Exit |
|-------|--------------|-------|------|
| **Idle** | false | Initial; after `onReady()` fires | `openCase()` called |
| **Validating** | false | `openCase()` called while Idle | All steps pass → Spending; any step fails → Idle (onBlocked emitted) |
| **Spending** | false | Steps 1–3 all pass | spend() + removeCase() complete → Spinning |
| **Spinning** | true | Steps 4–5 complete | `onComplete()` fires (after `reel_spin_duration` = 7800ms) |
| **Revealing** | true | `onComplete()` fires | `CHORD_DECAY_MS` (800ms) expires → Idle (`onReady()` emitted) |

Transitions are strictly linear. No backwards transitions. No pause state. Total locked time per open: ~8600ms (7800ms spin + 800ms chord).

### Interactions with Other Systems

| System | Direction | Orchestrator calls | Notes |
|--------|-----------|--------------------|-------|
| **Case Inventory** (#7) | ↑ depends on | `hasCase(caseId)`, `removeCase(caseId)` | hasCase at validation; removeCase after spend |
| **Virtual Economy** (#6) | ↑ depends on | `canAfford(casePrice + KEY_COST_USD)`, `spend(casePrice + KEY_COST_USD)` | canAfford at validation; spend committed after roll succeeds |
| **Drop Rate Engine** (#4) | ↑ depends on | `roll(caseId)` | Returns `ItemEntry`; throws `RollError` on bad data |
| **Reel Animation Engine** (#5) | ↑ depends on | `spin(caseId, selectedItem, { onTick, onComplete })` | Tick pitch calculated by Reel Engine; Orchestrator wires `onTick` to `playTick` |
| **Audio System** (#2) | ↑ depends on | `playTick(pitch)`, `playReveal()` | `playTick` called on every reel tick; `playReveal` called in `onComplete` |
| **Skin Inventory** (#8) | ↑ depends on | `addItem(selectedItem)` | Called in `onComplete` after `playReveal()`; returns `InventorySkinEntry` |
| **Reveal UI** (#13) | ↓ depended on by | — | Listens for `onReveal(entry)` to display the winning item |
| **HUD / App Shell** (#11) | ↓ depended on by | — | Listens for `onBlocked`, `onReady`; manages Open button enabled/disabled state; reads `isAnimating` |
| **Case Browser UI** (#15) | ↓ depended on by | — | May read `isAnimating` to prevent navigation during a spin |

## Formulas

#### F1: Total Open Cost

```
total_open_cost = casePrice + KEY_COST_USD
```

| Variable | Type | Source | Range |
|----------|------|--------|-------|
| `casePrice` | float (USD) | Provided by caller (from `CaseEntry.market_price` in Case Data Store) | $0.01 – ~$50.00 |
| `KEY_COST_USD` | float (USD) | Constant: `key_cost_usd` = $2.49 (Virtual Economy GDD) | Fixed |
| `total_open_cost` | float (USD) | — | $2.50 – ~$52.49 |

*Example: Recoil Case at $0.50 + $2.49 key = $2.99 total deducted from balance.*

This value is passed to both `VirtualEconomy.canAfford()` (Step 2) and `VirtualEconomy.spend()` (Step 4). It is computed once and reused — not recomputed between the two calls.

#### F2: Total Locked Time Per Open

```
total_locked_ms = reel_spin_duration + chord_decay_ms
total_locked_ms = 7800 + 800 = 8600ms
```

| Constant | Value | Source |
|----------|-------|--------|
| `reel_spin_duration` | 7800ms | Reel Animation Engine GDD (registry) |
| `chord_decay_ms` | 800ms | Audio System GDD (registry) |

This is an informational formula — it defines how long the player is blocked from opening another case. Useful for UI timing and re-enable logic design. Not computed at runtime; the Orchestrator uses the two constants directly.

## Edge Cases

**E1: `openCase()` called while `isAnimating === true`**
Player double-clicks Open or the UI fails to disable the button before a second click.
*Handling*: Returns immediately with no action and no event. Does not emit `onBlocked`. The guard is silent — the Open button should be visually disabled, so this is a defensive fallback only.

**E2: `hasCase()` returns false (no case owned)**
Player somehow activates the Open button without a case in inventory (UI bug or direct API call).
*Handling*: Emits `onBlocked("no_case")`; returns. No spend, no roll. The HUD/Reveal UI listens to `onBlocked` to explain why the open failed.

**E3: `canAfford()` returns false (insufficient balance)**
Player's balance is below `casePrice + KEY_COST_USD`.
*Handling*: Emits `onBlocked("insufficient_funds")`; returns. No case consumed. The HUD should prevent this state by disabling the Open button when the balance is too low, but the Orchestrator handles it defensively.

**E4: `roll()` throws a `RollError`**
The case data for `caseId` is malformed — empty item pool, invalid weights.
*Handling*: Catches the `RollError`, emits `onBlocked("roll_error")`; returns. No balance deducted, no case consumed. This is the primary reason roll precedes spend.

**E5: `removeCase()` returns false after `spend()` succeeds**
`spend()` deducted the balance, but `removeCase()` returned false (count was somehow already 0). This should not be reachable if `hasCase()` passed at Step 1, but could occur under a race condition.
*Handling*: The open proceeds regardless — do not abort after spend. The case open is committed once `spend()` succeeds. `removeCase()` returning false is logged as an error but does not halt the chain. The spin continues; the item is awarded.

**E6: `addItem()` throws inside `onComplete`**
`SkinInventory.addItem()` unexpectedly throws (e.g., corrupt inventory state).
*Handling*: Catches the exception, logs the error. The item is lost (not persisted), but `isAnimating` must still be reset to false and `onReady()` must still fire. Otherwise the game is permanently locked.

**E7: Browser tab closes during `Spinning` or `Revealing` state**
Player closes the tab after `spend()` but before `addItem()`.
*Handling*: The balance and case are deducted (persisted by Virtual Economy and Case Inventory). The item is not awarded. This is an accepted data-loss risk in MVP — a single-player simulator with no server. A future mitigation (Vertical Slice) would be to persist a "pending_award" flag before spending and clear it after `addItem()` completes.

**E8: `casePrice` is 0 or negative**
Caller passes an invalid price (e.g., UI bug returns 0).
*Handling*: `VirtualEconomy.canAfford(0 + 2.49)` will pass (if balance ≥ $2.49) and `spend(0 + 2.49)` will only deduct the key cost. Not catastrophic — the open proceeds with key cost only. The Orchestrator does not validate `casePrice` independently; that is the Case Browser UI's responsibility.

**E9: `openCase()` called with an unknown `caseId`**
`caseId` not recognized by Case Inventory or Drop Rate Engine.
*Handling*: `CaseInventory.hasCase(unknownId)` returns false → emits `onBlocked("no_case")`; returns. The invalid caseId never reaches `roll()`.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Virtual Economy** (#6) | Validates affordability and deducts open cost | `canAfford(total)`, `spend(total)` |
| **Case Inventory** (#7) | Validates case ownership and consumes one unit | `hasCase(caseId)`, `removeCase(caseId)` |
| **Drop Rate Engine** (#4) | Selects the winning item via weighted random draw | `roll(caseId): ItemEntry` — throws `RollError` on bad data |
| **Reel Animation Engine** (#5) | Runs the visual reel animation and fires tick/complete callbacks | `spin(caseId, selectedItem, { onTick, onComplete })` |
| **Audio System** (#2) | Plays tick sounds during spin and reveal chord on complete | `playTick(pitch)`, `playReveal()` |
| **Skin Inventory** (#8) | Persists the won item to the player's collection | `addItem(selectedItem): InventorySkinEntry` |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they call / listen to |
|--------|-----------------|---------------------------|
| **Reveal UI** (#13) | Displays the winning item after the reel stops | Listens for `onReveal(entry: InventorySkinEntry)` |
| **HUD / App Shell** (#11) | Manages Open button state; shows blocked-state messages | Listens for `onBlocked(reason)`, `onReady()`; reads `isAnimating` |
| **Case Browser UI** (#15) | May disable navigation during an active spin | Reads `isAnimating` |

The `casePrice` argument passed to `openCase()` originates from `CaseEntry.market_price` in the Case Data Store.

## Tuning Knobs

| Knob | Default | Safe Range | Gameplay Effect |
|------|---------|------------|-----------------|
| `KEY_COST_USD` | $2.49 | $1.00 – $5.00 | Cost per open beyond case price. Mirrors real CS2 key cost. Lower values make opens cheaper; higher values slow balance drain. Change only if economy balance requires it — this is a fidelity constant first. |
| `CHORD_DECAY_MS` | 800ms | 400ms – 1500ms | How long the Open button stays locked after reveal. Shorter = faster re-opening loop; longer = more breathing room between opens. Tied to the reveal chord duration — do not set shorter than the audible chord length. |
| `PRE_OPEN_VALIDATION` | enabled | enabled / disabled | If disabled, `hasCase` and `canAfford` checks are skipped (test/debug mode only). Never disable in production — would allow opens with zero balance. |

Only `CHORD_DECAY_MS` is likely to be adjusted during playtesting (open loop pacing feel). `KEY_COST_USD` is a fidelity constant — change only under economy rebalancing. `PRE_OPEN_VALIDATION` is a debug toggle only.

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-ORC-01 | `openCase()` called while `isAnimating === true` | Returns immediately; no events emitted; no state change | BLOCKING |
| AC-ORC-02 | `openCase()` called with `hasCase()` returning false | Emits `onBlocked("no_case")`; no spend, no roll, no animation | BLOCKING |
| AC-ORC-03 | `openCase()` called with insufficient balance | Emits `onBlocked("insufficient_funds")`; no case consumed, no animation | BLOCKING |
| AC-ORC-04 | `openCase()` called with valid case and balance | `roll()` → `spend()` → `removeCase()` called in that order; reel starts; `isAnimating` becomes true | BLOCKING |
| AC-ORC-05 | `roll()` throws `RollError` during validation | Emits `onBlocked("roll_error")`; balance unchanged; case count unchanged; `isAnimating` remains false | BLOCKING |
| AC-ORC-06 | Valid `openCase()` call — animation completes | `playReveal()` called; `addItem(selectedItem)` called; `onReveal(entry)` emitted; all in that order | BLOCKING |
| AC-ORC-07 | After `onComplete`, verify re-enable timing | `isAnimating` is still true for 800ms after `onComplete`; becomes false at 800ms; `onReady()` fires at 800ms | BLOCKING |
| AC-ORC-08 | `onReveal` payload is correct | The `InventorySkinEntry` emitted in `onReveal` matches the `selectedItem` returned by `roll()` | BLOCKING |
| AC-ORC-09 | `addItem()` throws in `onComplete` | Exception caught; `isAnimating` resets to false; `onReady()` fires; game is not locked | BLOCKING |
| AC-ORC-10 | Open cost is computed correctly | `spend()` is called with `casePrice + 2.49` (not `casePrice` alone and not `2.49` alone) | BLOCKING |
| AC-ORC-11 | `openCase()` cannot be called again during spin | During the 7800ms spin, a second `openCase()` call is a silent no-op | BLOCKING |
| AC-ORC-12 | After `onReady()` fires, another open can be initiated | `openCase()` called immediately after `onReady()` starts the open sequence normally | BLOCKING |
| AC-ORC-13 | `removeCase()` returns false (E5 scenario) | Open proceeds; item is still awarded; error is logged | ADVISORY |
| AC-ORC-14 | Full open loop end-to-end | Starting from idle: call `openCase()` → `isAnimating` true → `onReveal` fires with an `InventorySkinEntry` whose `.item` matches a valid `ItemEntry` from the case → `onReady` fires → `isAnimating` false | BLOCKING |
