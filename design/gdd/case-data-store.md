# Case Data Store

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-18
> **Implements Pillar**: Every Case Counts · Faithful Over Flashy

## Overview

The Case Data Store is a static JSON data layer containing every CS2 regular weapon
case ever released. It is the single authoritative source of truth for all case and
item data in the application — no other system may hard-code case names, item names,
rarity tiers, or drop weights. All downstream systems (Drop Rate Engine, Reel
Animation Engine, Inventory, Skin Image Loader, Case Browser UI, Inventory UI) read
exclusively from this store.

Each entry represents one CS2 weapon case and contains: case metadata (name,
internal ID, release date), an item pool (weapon name, skin name, rarity tier, Steam
item ID for CDN image URL construction), and per-tier drop weights expressed as
probability percentages.

The data is manually authored and maintained as a static JSON file in the repository
(`assets/data/cases.json`). It is loaded once at application startup and held in
memory for the session. No network calls are made to retrieve this data at runtime.

**MVP scope**: Regular weapon cases only. Rarity tiers covered: Mil-Spec →
Restricted → Classified → Covert → Rare Special Item (knife/glove tier). Souvenir
packages and sticker capsules are excluded from MVP — their distinct rarity schemas
require a separate container type and are deferred to Full Vision.

## Player Fantasy

The Case Data Store has no direct player-facing interface — players never interact
with it consciously. Its fantasy is entirely indirect: when the data is complete and
accurate, a player opening any case will see exactly the items CS2 players recognize
from the real game, at odds that feel right to anyone with CS2 experience. The
system succeeds when a knowledgeable CS2 player opens ten cases and never says
"that item doesn't belong here" or "knives feel too common."

Accuracy IS authenticity. This system directly serves the "Every Case Counts" and
"Faithful Over Flashy" pillars — a wrong rarity tier or an invented item name
immediately breaks the simulator's core promise.

## Detailed Design

### Core Rules

1. The store is loaded once at application startup from `assets/data/cases.json`
   into memory. It is read-only for the entire session — no system may modify case
   entries, item lists, or drop weights at runtime.

2. The root file structure is:
   ```json
   {
     "format_version": "1.0",
     "cases": [ ...CaseEntry[] ]
   }
   ```

3. Each **CaseEntry** has the following required fields:
   ```json
   {
     "id": "recoil_case",
     "name": "Recoil Case",
     "release_date": "2022-07-01",
     "type": "weapon_case",
     "image_url": "https://...",
     "market_price": 0.49,
     "rarity_weights": {
       "mil_spec":    79.92,
       "restricted":  15.98,
       "classified":   3.20,
       "covert":       0.64,
       "rare_special": 0.26
     },
     "items": {
       "mil_spec":     [ ...ItemEntry[] ],
       "restricted":   [ ...ItemEntry[] ],
       "classified":   [ ...ItemEntry[] ],
       "covert":       [ ...ItemEntry[] ],
       "rare_special": [ ...ItemEntry[] ]
     }
   }
   ```

4. Each **ItemEntry** has:
   ```json
   {
     "weapon":       "P250",
     "skin":         "Re.built",
     "item_id":      "p250_rebuilt",
     "image_url":    "https://steamcdn-a.akamaihd.net/...",
     "market_price": 0.50,
     "stattrak":     true
   }
   ```

   `market_price` is the Steam Market float price (USD) at the time data was sourced. It is used by Inventory UI and Reveal UI to display net proceeds and portfolio value. It is not live-updated in MVP — prices are hardcoded from a community source snapshot. The Price API Layer (Vertical Slice) will replace this with live prices.

5. `rarity_weights` values must sum to 100.0 (±0.01 tolerance for floating-point
   rounding). Any case entry that fails this check is a **data error** and must be
   corrected before shipping.

6. Each rarity tier in `items` must contain at least one `ItemEntry`. An empty tier
   array is a **data error**.

7. `id` values are unique, lowercase, underscore-separated strings. No two cases
   may share an ID.

8. `stattrak: true` means the item can roll as a StatTrak variant. StatTrak drop
   logic is owned by the StatTrak Module (Full Vision) — the Data Store only
   declares eligibility.

9. Regular cases (`type: "weapon_case"`) always have exactly these 5 rarity tiers:
   `mil_spec`, `restricted`, `classified`, `covert`, `rare_special`. No other tier
   keys are valid for this type.

### States and Transitions

| State | Description |
|-------|-------------|
| **Unloaded** | Application started but `cases.json` has not yet been fetched |
| **Loaded** | Data successfully parsed and held in memory; all downstream systems may query it |
| **Error** | File missing or JSON parse failed; application shows a static error and halts |

Transitions:
- `Unloaded → Loaded`: on successful fetch/import and parse of `cases.json` at startup
- `Unloaded → Error`: on file-not-found or JSON parse failure
- No transition out of `Loaded` or `Error` — both are terminal for the session

### Interactions with Other Systems

| System | What it reads | Interface |
|--------|--------------|-----------|
| **Drop Rate Engine** | `rarity_weights`, `items[rarity]` | `getCase(id)` → CaseEntry; `getItems(id, rarity)` → ItemEntry[] |
| **Reel Animation Engine** | All items across all tiers for a given case | `getAllItems(id)` → ItemEntry[] (flat array, all tiers merged) |
| **Inventory** | `weapon`, `skin`, `rarity`, `item_id` per pulled item | Receives ItemEntry from Drop Rate Engine; reads display fields |
| **Skin Image Loader** | `image_url` per ItemEntry | `getImageUrl(item_id)` → string |
| **Case Browser UI** | `id`, `name`, `image_url` per CaseEntry | `getCaseList()` → CaseEntry[] (metadata only, no item pool) |
| **Inventory UI** | `weapon`, `skin`, `rarity`, `image_url` per ItemEntry | Receives ItemEntry from Inventory |

All interfaces are synchronous — data is in memory, no async lookup needed.

## Formulas

### Per-Item Drop Probability

The store holds per-tier weights. The actual probability of receiving any specific
item is derived from the data here — the formula is owned by the Drop Rate Engine
but sourced from this store.

```
P(item) = rarity_weight[tier] / item_count[tier]
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Tier weight | `rarity_weight[tier]` | float | 0.01–99.0 | Percentage stored in `rarity_weights` for this tier |
| Item count in tier | `item_count[tier]` | int | 1–20 | Number of ItemEntry objects in `items[tier]` |

**Output Range:** 0.01% to 79.92% per item under normal data.
**Example:** Recoil Case has 7 Mil-Spec items. `79.92 / 7 ≈ 11.42%` chance per item.

### Weight Validation Rule

```
SUM(rarity_weights) = 100.0 ± 0.01
```

This is a data integrity constraint validated at load time. If violated, the case
entry is rejected as a data error.

**Standard default weights for regular weapon cases:**

| Rarity Tier | Weight (%) |
|-------------|-----------|
| mil_spec | 79.92 |
| restricted | 15.98 |
| classified | 3.20 |
| covert | 0.64 |
| rare_special | 0.26 |
| **Total** | **100.00** |

These are community-agreed estimates — Valve has never officially published per-case
weights. Use these as defaults; override per-case if better data is available for a
specific case.

## Edge Cases

- **If `cases.json` is missing or cannot be fetched at startup**: Enter `Error` state
  immediately. App halts and displays a static error message. No partial loading.

- **If `cases.json` contains a JSON syntax error**: Enter `Error` state. App halts.
  The entire file is rejected — no partial case loading.

- **If a CaseEntry's `rarity_weights` do not sum to 100.0 (±0.01)**: That case
  entry is skipped and logged as a data error. All other valid cases continue
  loading. The app launches without the invalid case.

- **If a rarity tier in `items` is present as an empty array (`[]`)**: That case
  entry is skipped as a data error. A weighted tier with no items cannot be resolved
  by the Drop Rate Engine.

- **If `image_url` is missing on an ItemEntry**: Item loads normally; `image_url`
  defaults to `null`. The Skin Image Loader renders a rarity-colored placeholder
  card when `image_url` is null.

- **If the `stattrak` field is missing on an ItemEntry**: Defaults to `false`.
  StatTrak eligibility is opt-in.

- **If two CaseEntries share the same `id`**: The second entry is rejected and
  logged. The first entry is kept.

- **If a CaseEntry has an unrecognized `type`**: Skip with a log warning. Only
  `"weapon_case"` is valid in MVP.

- **If `format_version` is missing from the root object**: File still loads with a
  log warning. Version mismatch is non-blocking in MVP.

- **If a tier has items but its weight is 0.0**: Data error — a tier with items but
  zero weight means those items can never be pulled. Flag as a data error and skip
  the case.

## Dependencies

### Upstream Dependencies

None. The Case Data Store is a Foundation-layer system with zero upstream
dependencies. It is the root of the dependency graph.

### Downstream Dependents

All dependencies below are **hard** — each system cannot function without the
Case Data Store being in Loaded state.

| System | What it needs | Hard/Soft |
|--------|--------------|-----------|
| **Drop Rate Engine** | `rarity_weights` + `items[tier]` for a given case | Hard |
| **Reel Animation Engine** | Full flat item pool for a given case | Hard |
| **Inventory** | Item metadata (weapon, skin, rarity, item_id) | Hard |
| **Skin Image Loader** | `image_url` per item_id | Hard |
| **Case Browser UI** | Case list (id, name, image_url) | Hard |
| **Inventory UI** | Item display fields per ItemEntry | Hard |
| **Reel UI** | Item display fields per ItemEntry (for card rendering) | Hard |
| **Price API Layer** | `market_price` per case/item as fallback when external API is unreachable | Soft (Vertical Slice only) |

### Interface Contract

The Case Data Store exposes six read functions. All are synchronous:

- `getCase(id: string) → CaseEntry | null`
- `getCaseList() → CaseEntry[]` (all loaded cases, metadata only — no item pools)
- `getItems(id: string, rarity: string) → ItemEntry[]`
- `getAllItems(id: string) → ItemEntry[]` (all tiers merged into a flat array)
- `getAllSkins() → ItemEntry[]` (flat list of every item across all cases, all tiers — used by Market Browser UI)
- `getItem(itemId: string) → ItemEntry | null` (single-item lookup by `item_id` across all cases and tiers — used by Price API Layer fallback)

No system calls the constructor or writes to the store. The loading lifecycle is
internal to the store.

## Tuning Knobs

All designer-adjustable values live in `assets/data/cases.json` — no code changes
required for any of the following:

| Knob | Location in JSON | Safe Range | Effect if too high / too low |
|------|-----------------|------------|------------------------------|
| **Tier weight (any rarity)** | `rarity_weights.[tier]` | 0.01–99.0 (must sum to 100.0) | Too high: that rarity floods the reel; too low: tier becomes practically unreachable |
| **Item pool size (any tier)** | `items.[tier]` array length | 1–20 items | Too few (1): players always pull the same item; too many (20+): ultra-rare items feel impossible to see |
| **Number of cases** | Root `cases` array length | 1–200 | No safety floor; adding cases has no downside. Removing all cases = data error at startup |
| **Item image URL** | `item.image_url` | Any valid HTTPS URL | Wrong URL = placeholder card rendered by Skin Image Loader; not a hard error |
| **StatTrak eligibility** | `item.stattrak` bool | true / false | No gameplay effect in MVP; only relevant when StatTrak Module ships in Full Vision |

**Interaction between knobs:** Increasing an item pool's size while keeping the tier
weight constant *reduces* each individual item's drop probability proportionally
(per `P(item) = weight / count`). Designers tuning for a specific skin's rarity
should adjust both pool size and tier weight together.

## Acceptance Criteria

- **GIVEN** a valid `cases.json` with 10 entries, **WHEN** the app starts, **THEN**
  all 10 cases are loaded and returned by `getCaseList()`.

- **GIVEN** a CaseEntry with `rarity_weights` summing to 99.995, **WHEN** loaded,
  **THEN** the entry is accepted (within ±0.01 tolerance).

- **GIVEN** a CaseEntry with `rarity_weights` summing to 100.50, **WHEN** loaded,
  **THEN** that entry is skipped, a data error is logged, and all other valid cases
  are still available.

- **GIVEN** a CaseEntry where any rarity tier has an empty array (`[]`), **WHEN**
  loaded, **THEN** that entry is skipped and a data error is logged.

- **GIVEN** an ItemEntry with no `image_url` field, **WHEN** `getCase(id)` is called,
  **THEN** the returned ItemEntry has `image_url: null`.

- **GIVEN** an ItemEntry with no `stattrak` field, **WHEN** loaded, **THEN** that
  item's `stattrak` is `false`.

- **GIVEN** two CaseEntries sharing the same `id`, **WHEN** loaded, **THEN** the
  first is kept, the second is rejected, and a conflict is logged.

- **GIVEN** `cases.json` is missing, **WHEN** the app starts, **THEN** the app
  enters Error state, a static error message is displayed, and no gameplay UI renders.

- **GIVEN** `cases.json` contains a JSON syntax error, **WHEN** the app starts,
  **THEN** the app enters Error state, a static error message is displayed, and no
  partial cases are available.

- **GIVEN** a CaseEntry with `type: "sticker_capsule"`, **WHEN** loaded, **THEN**
  the entry is skipped with a log warning and all valid cases still load.

- **GIVEN** a CaseEntry where a rarity tier has ≥1 item but `rarity_weights.[tier]`
  is `0.0`, **WHEN** loaded, **THEN** that entry is skipped and a data error is
  logged.

- **GIVEN** `cases.json` has no `format_version` field, **WHEN** loaded, **THEN**
  all cases load successfully and a warning is logged.

- **GIVEN** a case id not present in the store, **WHEN** `getCase(id)` is called,
  **THEN** `null` is returned without throwing an error.

- **GIVEN** a case id not present in the store, **WHEN** `getItems(id, rarity)` or
  `getAllItems(id)` is called, **THEN** an empty array is returned without throwing
  an error.

- **GIVEN** an `item_id` that exists in any case's item pool, **WHEN** `getItem(itemId)`
  is called, **THEN** the matching `ItemEntry` is returned (first match wins if the
  same `item_id` appears in multiple cases).

- **GIVEN** an `item_id` not present in any case's item pool, **WHEN** `getItem(itemId)`
  is called, **THEN** `null` is returned without throwing an error.

- **GIVEN** the Recoil Case is loaded, **WHEN** `getAllItems("recoil_case")` is
  called, **THEN** the returned flat array contains each item from each of the 5
  rarity tiers exactly once, with no duplicates.

- **GIVEN** the Recoil Case has 7 mil_spec items, **WHEN**
  `getItems("recoil_case", "mil_spec")` is called, **THEN** exactly 7 ItemEntry
  objects are returned.

## Open Questions

- **Which community database is most complete and maintained?** Candidates:
  `csfloat/cs-skins` on GitHub, cs2inspect.net, and the Steam Spy community API.
  Need to evaluate completeness (all cases back to CS:GO era), update cadence, and
  license. *Resolution: research before data entry begins.*

- **Can Steam CDN `image_url` values be hot-linked reliably?** Steam CDN URLs for
  skin images are used across thousands of community sites, but Valve has no public
  SLA on URL stability. *Resolution: spot-check 5–10 old case items before
  committing to this approach.*

- **How are per-case weights validated if Valve never publishes them?** Community
  estimates are the only available source. If different sources disagree on a value,
  use community consensus; flag any case where sources disagree by >0.05 percentage
  points.

- **How do we handle new CS2 cases released after the data file is authored?** No
  auto-update mechanism exists in MVP. *Resolution: document a manual update process
  in the project README.*
