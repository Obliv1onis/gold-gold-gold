# Drop Rate Engine

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Faithful Over Flashy · Zero Friction

## Overview

The Drop Rate Engine is a stateless computation module that implements CS2's two-phase item selection algorithm. Given a case ID, it returns a single randomly selected `ItemEntry` — the item the player pulled from that case. It is the single point through which all randomness in the simulator passes.

Selection is two-phase: first, a rarity tier is chosen by sampling the case's weighted distribution (the five tier weights stored in the Case Data Store); second, a single item within that tier is chosen by uniform random sampling. This produces the authentic CS2 probability distribution where higher tiers are rare but every item within a tier is equally likely.

The engine exposes one method — `roll(caseId)` — which is synchronous, has no side effects, and always returns exactly one `ItemEntry` on success. It reads exclusively from the Case Data Store and writes nothing. StatTrak eligibility is declared on the returned `ItemEntry` via the `stattrak` boolean, but StatTrak resolution (whether this specific roll IS a StatTrak variant) is owned by the StatTrak Module in Full Vision — this engine passes the flag through without acting on it.

**MVP scope**: Uniform within-tier item selection only. Wear/float value generation is deferred to the Wear/Float System (Full Vision).

## Player Fantasy

The Drop Rate Engine has no player-visible surface. No button calls it directly. No feedback confirms it ran. Its fantasy is entirely indirect: the moment a Covert skin slides into the center window, the player feels the CS2 rarity system — scarce items are genuinely rare, and that rarity is what makes them feel earned. The engine succeeds when a player opens fifty cases and never once questions whether the odds are real.

The system fails two ways. If the implementation is biased — returning the same tier too often, or skewing toward specific items — experienced CS2 players will notice immediately. They know approximately how common Mil-Spec should feel vs. Restricted. Even without real money on the line, a rigged feel breaks immersion. The second failure is a crash or exception — if `roll()` throws during a case open, the entire opening sequence aborts. Either failure retroactively delegitimizes the session.

This system serves Pillar 1 directly: *"Faithful Over Flashy."* Authentic odds are not a nice-to-have — they are the contract with players who know what CS2 rarity distribution feels like from experience.

## Detailed Design

### Core Rules

1. The engine exposes a single public method:
   `roll(caseId: string): ItemEntry`

   Called once per case open. Returns the item the player pulled. Throws `RollError` if the case is not found or contains invalid data — the Orchestrator catches this and aborts the opening sequence.

2. **Phase 1 — Tier selection (weighted):**
   Read `rarity_weights` for the given case from the Case Data Store. Use `Math.random()` to sample a uniform value in `[0, 1)`. Walk the tier weights in order (`mil_spec → restricted → classified → covert → rare_special`) as cumulative thresholds to determine which tier was selected.
   ```
   r = Math.random()
   cumulative = 0
   for each tier in [mil_spec, restricted, classified, covert, rare_special]:
     cumulative += rarity_weights[tier] / 100
     if r < cumulative: return tier
   ```
   The final tier (`rare_special`) is selected if no earlier threshold matched (handles floating-point remainder).

3. **Phase 2 — Item selection (uniform):**
   Call `getItems(caseId, selectedTier)` on the Case Data Store. Select one item by index: `floor(Math.random() * items.length)`. This produces uniform probability within the tier.

4. **RNG source**: `Math.random()` is the sole RNG. No seed is set or exposed — results are non-deterministic per browser session. `crypto.getRandomValues()` is explicitly not used: simulation fairness does not require cryptographic unpredictability and the added complexity has no player benefit.

5. The returned `ItemEntry` is the exact object from the Case Data Store — the engine does not clone or modify it. Callers must not mutate the returned object.

6. The engine is stateless: no call history, no streak tracking, no pity system. Each `roll()` is independent. CS2 uses no pity system for regular cases — the simulator matches this faithfully.

7. `roll()` makes exactly two calls to the Case Data Store per invocation: once to read `rarity_weights` (Phase 1) and once to read `items[tier]` (Phase 2). No caching is performed by the engine — the Case Data Store holds data in memory, so repeated reads are effectively free.

### States and Transitions

The Drop Rate Engine is stateless — it has no internal states. All state (case data) lives in the Case Data Store. The engine exists only as a function.

| Condition | Behavior |
|-----------|----------|
| Case found, valid data | Returns `ItemEntry` |
| Case not found (`getCase` returns null) | Throws `RollError("Case not found: [id]")` |
| Tier has zero items (should not occur — Case Data Store rejects this at load) | Throws `RollError("Empty item pool for tier [tier] in case [id]")` |

### Interactions with Other Systems

| System | Direction | What flows |
|--------|-----------|------------|
| **Case Data Store** | Drop Rate Engine → Case Data Store | Reads `rarity_weights` + `items[tier]` via `getCase()` and `getItems()` |
| **Case Opening Orchestrator** | Orchestrator → Drop Rate Engine | Calls `roll(caseId)` once per case open; receives `ItemEntry` |
| **StatTrak Module** *(Full Vision)* | Orchestrator → StatTrak Module | After `roll()`, the Orchestrator passes the returned `ItemEntry` to the StatTrak Module if `item.stattrak === true`; the Drop Rate Engine does not call the StatTrak Module directly |
| **Wear/Float System** *(Full Vision)* | Orchestrator → Wear/Float System | After `roll()`, the Orchestrator passes the returned `ItemEntry` to the Wear/Float System; the Drop Rate Engine does not call it directly |

## Formulas

### Two-Phase Selection Algorithm

The complete item selection is the composition of two random draws.

**Precondition**: `sum(rarity_weight[t] for all tiers t) == 100.0 (±0.01)`. This is enforced by the Case Data Store at load time — `roll()` trusts this invariant. If a malformed case bypasses data validation, Phase 1 behavior is undefined for weight sums that deviate significantly from 100.0.

**Phase 1 — Weighted Tier Selection:**

```
r₁ = Math.random()                        // uniform in [0, 1)
selected_tier = rare_special              // default; overwritten if a threshold is matched
cumulative = 0
for tier in [mil_spec, restricted, classified, covert, rare_special]:
  cumulative += rarity_weight[tier] / 100  // normalize % → probability
  if r₁ < cumulative:
    selected_tier = tier
    break
// If loop completes without break (float sum < 1.0 due to IEEE 754 precision),
// selected_tier remains rare_special
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Random draw | `r₁` | float | [0, 1) | Uniform random from `Math.random()` |
| Tier weight | `rarity_weight[tier]` | float | 0.26–79.92 | Percentage from Case Data Store (the 5 standard weights); sum = 100.0 |
| Normalized weight | `rarity_weight[tier] / 100` | float | 0.0026–0.7992 | Percentage converted to probability for cumulative accumulation |
| Cumulative threshold | `cumulative` | float | 0.0026–1.0 | Running sum of normalized weights after each tier |
| Selected tier | `selected_tier` | string | One of 5 tier keys | Pre-initialized to `rare_special`; overwritten on first matched threshold |

**Output**: One of: `mil_spec`, `restricted`, `classified`, `covert`, `rare_special`.

**Examples** (Recoil Case, standard weights):
- `r₁ = 0.0` → `0.0 < 0.7992` → `mil_spec` selected (always true for r₁ = 0).
- `r₁ = 0.85` → after `mil_spec`: cumulative = 0.7992, `0.85 < 0.7992` = false; after `restricted`: cumulative = 0.9590, `0.85 < 0.9590` = true → `restricted` selected.
- `r₁ = 0.999` → after `rare_special`: cumulative = 1.0000, `0.999 < 1.0000` = true → `rare_special` selected **in the loop** (not via fallback).
- Fallback only fires when float precision causes the loop's final cumulative to be `0.9999...` and `r₁ >= 0.9999...` simultaneously — an astronomically rare event.

---

**Phase 2 — Uniform Item Selection:**

**Precondition**: `items.length >= 1`. If `getItems()` returns an empty array (data integrity failure that bypassed Case Data Store validation), `roll()` throws `RollError("Empty item pool for tier [tier] in case [caseId]")`.

```
items = getItems(caseId, selected_tier)   // ItemEntry[] from Case Data Store
if items.length === 0: throw RollError(...)
r₂ = Math.random()                        // uniform in [0, 1)
selected_index = floor(r₂ * items.length) // range: [0, items.length - 1]
selected_item = items[selected_index]
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Item pool | `items` | ItemEntry[] | length 1–20 | All items in the selected rarity tier |
| Random draw | `r₂` | float | [0, 1) | Uniform random from `Math.random()` |
| Selected index | `selected_index` | int | 0 to `items.length - 1` | `floor(r₂ × pool size)` — uniform over valid indices |
| Selected item | `selected_item` | ItemEntry | — | The returned item |

**Output**: A single `ItemEntry` object from the Case Data Store.

**Edge cases:**
- `items.length = 1`: `floor(r₂ * 1) = 0` for all `r₂` in [0, 1) — only valid index always selected.
- `r₂` approaching 1.0 (e.g. 0.9999): `floor(0.9999 * items.length)` = `items.length - 1` — last valid index, not out-of-bounds.

---

### Per-Item Probability (informational — not implemented in code)

The probability of receiving any specific item from a specific case, useful for data validation and test assertions:

```
P(item) = rarity_weight[tier(item)] / item_count[tier(item)]
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Tier weight | `rarity_weight[tier]` | float | 0.26–79.92 | Weight % for that item's rarity tier (standard values) |
| Item count in tier | `item_count[tier]` | int | 1–20 | Number of items in the same rarity tier |

**Output range**: ~0.013% (`0.26 / 20` — single Rare Special item in a maximum 20-item pool) to ~79.92% (`79.92 / 1` — single Mil-Spec item in a 1-item pool).

**Example** (Recoil Case, 7 Mil-Spec items): `P(item) = 79.92 / 7 ≈ 11.42%` per Mil-Spec item.

**Note**: This formula is the implementation specification for the Drop Rate Engine. It was first introduced in the Case Data Store GDD as a data schema illustration. The Case Data Store GDD is the source of the weights; this GDD is the source of how they are used to select items.

## Edge Cases

- **If `getCase(caseId)` returns `null`** (case ID not found in the Case Data Store): `roll()` throws `RollError("Case not found: [caseId]")`. The Orchestrator catches this and aborts the opening sequence. No item is added to the inventory. No key is spent (key deduction must occur only after a successful roll — ownership of this ordering is defined in the Case Opening Orchestrator GDD).

- **If Phase 2's `getItems(caseId, selectedTier)` returns an empty array** (should not occur — Case Data Store rejects zero-item tiers at load): `roll()` throws `RollError("Empty item pool for tier [tier] in case [caseId]")`. This is a defense against data integrity failures that bypass Case Data Store validation.

- **If `Math.random()` returns exactly `0.0`**: `r₁ = 0.0 < 0.7992` → `mil_spec` is always selected. `r₂ = 0.0` → `floor(0.0 * items.length) = 0` → first item is selected. Valid, non-crashing behavior.

- **If the case's `rarity_weights` do not sum exactly to 100.0** (within ±0.01 tolerance): The Case Data Store rejects this case at load — `roll()` will never be called with a malformed case ID. The guard at Phase 1's precondition is defensive only.

- **If `roll()` is called simultaneously from two concurrent case opens** (two-tab scenario — see Persistence GDD): `Math.random()` is not shared state across tabs. Each tab's `roll()` is independent. Within a single tab, JavaScript's single-threaded event loop means `roll()` cannot be interrupted mid-execution. No race condition is possible.

- **If `roll()` is called before the Case Data Store is in `Loaded` state**: `getCase()` returns `null` → `roll()` throws `RollError("Case not found: [caseId]")`. The Orchestrator must not call `roll()` until the Case Data Store reports `Loaded`.

- **If the same item pool produces the same item repeatedly** (streak of identical items): This is statistically expected behavior with uniform within-tier selection and a small item pool. `roll()` has no anti-repeat logic — CS2 does not have one and neither does this simulator. A 1-item tier will always return the same item.

## Dependencies

### Upstream Dependencies

| System | What it needs | Hard/Soft |
|--------|--------------|-----------|
| **Case Data Store** | `getCase(id)` for rarity weights; `getItems(id, rarity)` for item pool | Hard — `roll()` cannot function without case data |

The Case Data Store must be in `Loaded` state before `roll()` is callable. The Drop Rate Engine has no other upstream dependencies.

### Downstream Dependents

| System | What it needs | Hard/Soft | Pending GDD |
|--------|--------------|-----------|-------------|
| **Case Opening Orchestrator** | `roll(caseId)` → `ItemEntry` once per case open | Hard | Not yet designed |
| **Wear/Float System** *(Full Vision)* | `ItemEntry` output from `roll()` — the Orchestrator pipes it through | Soft (post-MVP) | Not yet designed |
| **StatTrak Module** *(Full Vision)* | `ItemEntry.stattrak` flag from `roll()` output — Orchestrator pipes it through | Soft (post-MVP) | Not yet designed |

Hard means the Orchestrator cannot resolve a case open without `roll()`. Soft means the Full Vision systems are additive and the simulator runs without them.

### Interface Contract

The Drop Rate Engine exposes one method:

| Method | Signature | Behavior |
|--------|-----------|----------|
| `roll(caseId)` | `(caseId: string): ItemEntry` | Two-phase selection; returns one ItemEntry; throws `RollError` on invalid input |

No system accesses `Math.random()` or the Case Data Store directly for item selection — all randomized item picks must go through `roll()`.

## Tuning Knobs

The Drop Rate Engine has no tuning knobs of its own. It is a pure algorithm — all adjustable values (rarity weights, item pools) are owned by the Case Data Store and live in `assets/data/cases.json`. Changing a case's drop rates requires editing the data file, not this module.

The only designer-relevant surface is the RNG source:

| Knob | Current Value | Safe Range | Change Risk |
|------|--------------|------------|-------------|
| **RNG source** | `Math.random()` | `Math.random()` only | **LOW** — swapping to `crypto.getRandomValues()` would provide cryptographic unpredictability at the cost of synchronous code complexity (the crypto API is synchronous in the `getRandomValues` form). No gameplay benefit for a simulator. Change only if a specific audit or cheating concern arises. |
| **Tier traversal order** | `mil_spec → restricted → classified → covert → rare_special` | Fixed | **NONE** — this order must match the Case Data Store's rarity tier key set. Reordering would break the cumulative threshold calculation if weights are asymmetric. Do not change. |

**Interaction note**: All weight tuning is owned by the Case Data Store GDD. The per-item probability formula (`P = weight / count`) means adding items to a tier reduces each individual item's probability — designers tuning for a specific skin's rarity must adjust both pool size and tier weight together.

## Acceptance Criteria

*(Reviewed by `qa-lead` — lean mode Section H gate.)*

**AC-01 — Happy path: roll() returns a valid ItemEntry**

GIVEN a Case Data Store loaded with case `"recoil_case"` containing valid rarity weights and at least one item per tier,
WHEN `roll("recoil_case")` is called,
THEN it returns synchronously without throwing,
AND the returned value is an `ItemEntry` object with all required fields populated (`weapon`, `skin`, `item_id`, `stattrak`),
AND the returned object is one of the items listed in `getItems("recoil_case", <selectedTier>)`.

---

**AC-02 — Phase 1 distribution: weighted tier selection matches expected probabilities**

GIVEN a mock Case Data Store returning the standard rarity weights (`mil_spec: 79.92, restricted: 15.98, classified: 3.20, covert: 0.64, rare_special: 0.26`),
WHEN `roll()` is called 10,000 times and the resulting tier for each call is recorded,
THEN the observed frequency of each tier falls within ±1% (absolute) of its expected probability:

| Tier | Expected | Acceptable Range |
|------|----------|-----------------|
| mil_spec | 79.92% | 78.92% – 80.92% |
| restricted | 15.98% | 14.98% – 16.98% |
| classified | 3.20% | 2.20% – 4.20% |
| covert | 0.64% | 0.00% – 1.64% |
| rare_special | 0.26% | 0.00% – 1.26% |

AND every roll produces exactly one tier (no roll produces `undefined` or throws).

*Note: To isolate Phase 1, inject a mock `getItems()` that always returns a fixed single-item array for any tier.*

---

**AC-03 — Phase 2 distribution: uniform within-tier item selection**

GIVEN a mock Case Data Store for a case whose `mil_spec` tier contains exactly 7 items (A through G), with standard weights,
AND `Math.random` stubbed to return `r₁ = 0.0` on every Phase 1 call (forcing `mil_spec` selection) and real `Math.random()` values on Phase 2 calls,
WHEN `roll()` is called 10,000 times,
THEN the observed frequency of each of the 7 items falls within ±1% (absolute) of the expected uniform probability (≈ 14.29%),
AND no item index outside [0, 6] is ever selected,
AND `selected_index` is never equal to `items.length` (no off-by-one at the upper bound).

---

**AC-04 — Error: case not found throws RollError**

GIVEN a Case Data Store where `getCase("nonexistent_case")` returns `null`,
WHEN `roll("nonexistent_case")` is called,
THEN it throws a `RollError`,
AND the error message is `"Case not found: nonexistent_case"`,
AND no item is returned.

---

**AC-05 — Error: empty item pool throws RollError**

GIVEN a Case Data Store where `getCase("bad_case")` returns a valid case record,
AND `getItems("bad_case", <any tier>)` returns an empty array `[]` for the tier selected by Phase 1,
WHEN `roll("bad_case")` is called,
THEN it throws a `RollError`,
AND the error message matches `"Empty item pool for tier [tier] in case bad_case"` where `[tier]` is the tier Phase 1 selected,
AND no item is returned.

---

**AC-06 — Statelessness: consecutive rolls are independent**

GIVEN a Case Data Store loaded with a valid case,
WHEN `roll()` is called 1,000 times in sequence without any intervening state reset,
THEN the distribution of results matches the expected tier distribution within ±2% (absolute) — no drift, compression, or pity accumulation is observed,
AND after a `rare_special` result, the next call's tier distribution is statistically indistinguishable from the baseline distribution across a 1,000-call sample,
AND the engine holds no internal state between calls (the module exposes no accumulated history, counter, or streak tracking after 1,000 rolls).

---

**AC-07 — Returned ItemEntry is the exact Case Data Store object**

GIVEN a Case Data Store whose `getItems()` returns a known array of `ItemEntry` objects with known references,
WHEN `roll()` is called and returns an `ItemEntry`,
THEN the returned object passes a strict reference equality check (`===`) against the corresponding element in the array returned by `getItems()`,
AND the returned object has not been cloned, wrapped, or modified (all field values are `===` to the originals).

---

**AC-08 — Phase 1 boundary: r₁ near 0.0 always selects mil_spec**

GIVEN `Math.random` stubbed to return `0.0` on the Phase 1 call,
WHEN `roll()` is called with a valid case,
THEN the item returned belongs to the `mil_spec` tier.

GIVEN `Math.random` stubbed to return `0.001` (well inside the mil_spec threshold of 0.7992) on the Phase 1 call,
WHEN `roll()` is called with a valid case,
THEN the item returned belongs to the `mil_spec` tier.

---

**AC-09 — Phase 2 boundary: single-item tier always returns that item**

GIVEN a case whose `rare_special` tier contains exactly one item (`item_X`),
AND `Math.random` stubbed to return `0.999` on the Phase 2 call,
WHEN Phase 1 selects `rare_special` and Phase 2 executes,
THEN `floor(0.999 * 1) = 0` — `item_X` is returned, and no `RangeError` or out-of-bounds access occurs.

GIVEN the same single-item `rare_special` tier,
AND `Math.random` stubbed to return `0.0` on the Phase 2 call,
WHEN Phase 2 executes,
THEN `floor(0.0 * 1) = 0` — `item_X` is returned.

---

**AC-10 — roll() never modifies the Case Data Store**

GIVEN a Case Data Store loaded with a valid case, with all item arrays and weight records captured as deep snapshots before any rolls,
WHEN `roll()` is called 100 times,
THEN the Case Data Store's `rarity_weights` for the case are identical to the pre-roll snapshot,
AND every `ItemEntry` array returned by `getItems()` for every tier is identical in length and content to the pre-roll snapshot,
AND no property of any `ItemEntry` object in the store has been added, removed, or reassigned.

## Open Questions

- **StatTrak resolution ownership**: `roll()` passes `ItemEntry.stattrak` (boolean) to the Orchestrator as a flag. When the StatTrak Module ships in Full Vision, should the Orchestrator own the StatTrak resolution call after receiving the ItemEntry, or should `roll()` be extended to return a richer result object `{ item, isStatTrak }`? *Resolution: design in the Case Opening Orchestrator GDD — the Orchestrator owns the post-roll pipeline.*

- **Float/wear value seeding**: When the Wear/Float System ships in Full Vision, will it receive the `ItemEntry` from the Orchestrator and generate float independently, or will `roll()` be extended to return a `{ item, float }` tuple? Same question as StatTrak. *Resolution: design in the Case Opening Orchestrator and Wear/Float System GDDs before those systems are implemented.*

- **RNG injection for testability**: AC-02, AC-03, AC-08, and AC-09 require stubbing `Math.random`. The implementation must accept an injectable RNG function for testability — e.g., `roll(caseId, rng = Math.random)` — so tests can control random draws without monkey-patching the global. This is an implementation constraint derived directly from the test criteria. *Resolution: note in the ADR when `roll()` is implemented — the function signature must include an optional `rng` parameter.*
