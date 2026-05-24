# Case Browser UI

> **Status**: Designed — Pending Review
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-21
> **Implements Pillar**: Zero Friction · Every Case Counts · Faithful Over Flashy

## Overview

Case Browser UI is the catalogue screen that surfaces every CS2 weapon case in the data store. It reads case metadata from the Case Data Store (`getCaseList()`) and affordability state from the Virtual Economy (`canAfford(casePrice + KEY_COST_USD)`) to render a browsable grid: cover art, name, market price, and an affordability indicator for each case. Cases the player can afford are shown in full; cases that exceed the current balance (including the $2.49 key cost) are visually greyed. The browser listens to the `balance-changed` DOM event and re-evaluates affordability in real time without polling or page reloads. Selecting a case opens a detail panel showing the case's item pool by rarity tier and per-tier drop odds — the information a CS2 player would check before deciding to open.

Purchasing a case — clicking "Buy" on any affordable case — calls `CaseInventory.buyCase(caseId, casePrice)`, which deducts the case market price from the virtual balance and adds one copy of the case to the player's Case Inventory. The $2.49 key cost is not charged here; it is applied at open time by the Case Opening Orchestrator. The browser does not close after a purchase — the player can buy multiple cases in one browse session before returning to the main screen. The player fantasy is the "Every Case Counts" promise made tangible: every case from CS2's history is visible and accessible, browsing is never gated — a player can look at cases they cannot currently afford, and selling items always creates a path back to affordability.

## Player Fantasy

The Case Browser delivers the opening beat of the "Every Case Counts" fantasy: the moment a player discovers that every CS2 case ever released is here, browsable, and buyable. Standing in front of the full archive — cases from 2013, cases from eras they never played in real CS2 — creates a sense of access that no real-money case opening can match. No wallet restriction limits what they can look at; only their current balance limits what they can buy *right now*, and even that is temporary.

The deliberation inside the browser is its own low-stakes pleasure. "Do I open the familiar Recoil Case, or the Danger Zone Case from 2018 that I never got to open?" This decision moment is the first phase of the dopamine sequence — anticipation before the reel even starts. The browser owns this anticipation. Greyed-out unaffordable cases reinforce possibility, not gatekeeping: each one says "sell one skin and this is yours." Discovery is valid even without buying: a player can browse the archive, check item pools by rarity tier, and appreciate CS2's history for its own sake.

Pillar alignment: **Pillar 3 (Every Case Counts)** — this screen is where that promise becomes visible. **Pillar 2 (Zero Friction)** — the browse-to-buy path must never add unnecessary steps between "I want that case" and having it in inventory.

## Detailed Design

### Core Rules

1. Case Browser UI is a **full-screen overlay modal** that renders on top of the main screen. It is opened by a control in the HUD/App Shell (e.g., a "Browse Cases" button). It is dismissed by a close button or the Escape key. The main screen remains rendered beneath it but is not interactive while the overlay is open.

2. On open, the browser calls `CaseDataStore.getCaseList()` once to load the case list into local state. The list is cached for the lifetime of the open overlay; no polling, refresh, or re-fetch occurs while the browser is open.

3. Cases are displayed in a **scrollable grid**, one card per `CaseEntry`. **Default sort: ascending by `market_price` (cheapest first)**. Players may re-sort by: price ascending, price descending, alphabetical A→Z, or release date newest-first.

4. Each **case card** in the grid shows:
   - Cover art thumbnail (`CaseEntry.image_url`)
   - Case name (`CaseEntry.name`)
   - Market price (`$CaseEntry.market_price`)
   - **Affordability indicator**: full color if `VirtualEconomy.canAfford(casePrice + KEY_COST_USD)` (player can fund the full open today); 50% opacity / greyed if not.

5. Clicking a case card **expands it inline (accordion)**. Only one card may be expanded at a time — expanding a new card collapses the previously expanded card. The expanded detail shows:
   - Larger case cover art
   - Release date (`CaseEntry.release_date`)
   - Cost breakdown: `"Case: $X.XX + Key: $2.49 = $Y.YY to open"`
   - Per-rarity-tier sections, each showing: tier name, drop weight (e.g., `"Mil-Spec — 79.92%"`), and a list of item names (`weapon + skin`) in that tier
   - Item names only — no per-item images in the accordion; avoids batch CDN requests for items not yet owned. Rarity-tier color (CS2 rarity hex) distinguishes sections visually.
   - **"Buy Case ($X.XX)"** button

6. The **Buy Case button**:
   - Enabled when `VirtualEconomy.canAfford(casePrice)` — only the case price is needed to purchase
   - Disabled when player cannot afford the case itself
   - On click: calls `CaseInventory.buyCase(caseId, casePrice)`. This internally deducts `casePrice` from the Virtual Economy and increments the case count in Case Inventory
   - On success: brief confirmation feedback ("Added to inventory"), the accordion collapses, and all case card affordability indicators re-evaluate immediately
   - The browser does **not** close automatically after a buy — the player may buy multiple cases in one session

7. Case Browser UI **listens to the `balance-changed` DOM event**. On each fire, it re-runs `canAfford(casePrice + KEY_COST_USD)` for every case card and updates affordability indicators. This ensures that selling a skin from Inventory (which fires `balance-changed`) is reflected in the Case Browser without any user action.

8. Case Browser UI does **not** open cases. Opening is triggered from the main screen / HUD. The browser's scope ends at adding cases to Case Inventory.

9. Item pool data for the accordion is loaded on demand via `CaseDataStore.getCase(id)` — called on first expand of each card, then cached locally for the session. `getCaseList()` does not return item pools.

### States and Transitions

| State | Description |
|-------|-------------|
| **Closed** | Overlay not rendered. No event listeners active. |
| **Open — Grid** | Overlay rendered. Full case grid visible. No card expanded. Listening to `balance-changed`. |
| **Open — Expanded** | One case card expanded in accordion. Full item pool and Buy button visible. All other cards at grid-tile size. |

| Transition | Trigger |
|-----------|---------|
| Closed → Open–Grid | HUD opens the browser; `getCaseList()` loads; grid renders. |
| Open–Grid → Open–Expanded | Player clicks any case card. |
| Open–Expanded → Open–Expanded | Player clicks a different case card. Old accordion collapses; new one opens. |
| Open–Expanded → Open–Grid | Player clicks the expanded card again, or clicks a collapse control. |
| Open–Grid → Closed | Player clicks the close button or presses Escape. |
| Open–Expanded → Closed | Player clicks the close button or presses Escape. |

### Interactions with Other Systems

| System | Direction | What flows | Interface |
|--------|-----------|-----------|-----------|
| **Case Data Store** | ↑ depends on | All case metadata for the grid | `getCaseList() → CaseEntry[]` on open |
| **Case Data Store** | ↑ depends on | Full case detail (item pool) for the accordion | `getCase(id) → CaseEntry` on first card expand |
| **Virtual Economy** | ↑ depends on | Grid affordability: `canAfford(casePrice + KEY_COST_USD)` per card | `canAfford(amount)` called on render + on `balance-changed` |
| **Virtual Economy** | ↑ depends on | Buy button affordability: `canAfford(casePrice)` | `canAfford(amount)` on card expand |
| **Virtual Economy** | ↑ depends on | Live balance change signals | Listens to `balance-changed` DOM event |
| **Case Inventory** | ↓ calls | Purchase a case | `buyCase(caseId, casePrice)` on Buy button click |
| **HUD / App Shell** | ↑ opened by | Browser is spawned and dismissed by the HUD | Activation mechanism → becomes an ADR |

## Formulas

Case Browser UI owns no formulas. It is a presentation-layer system that reads and displays values calculated by upstream systems. The following referenced formulas inform what this system displays:

---

#### F-REF-1: Total Open Cost (display — source: virtual-economy.md F1)

```
total_open_cost = casePrice + KEY_COST_USD
```

| Variable | Symbol | Type | Source | Range |
|----------|--------|------|--------|-------|
| Case market price | `casePrice` | float (USD) | `CaseEntry.market_price` | $0.01 – ~$50.00 |
| Key cost constant | `KEY_COST_USD` | constant (USD) | Virtual Economy — $2.49 | Fixed |
| **Total open cost** | `total_open_cost` | float (USD) | — | $2.50 – ~$52.49 |

**Display use**: The accordion detail panel shows: `"Case: $X.XX + Key: $2.49 = $Y.YY to open"`. This GDD references the formula; virtual-economy.md owns it.

---

#### F-REF-2: Per-Tier Drop Weight (display — source: case-data-store.md)

The `rarity_weights` object in each `CaseEntry` stores per-tier drop percentages as pre-computed values (e.g., `mil_spec: 79.92`). Case Browser UI reads these directly — no calculation is performed.

**Display use**: Each tier row in the accordion shows: `"[Tier Name] — [weight]%"` (e.g., `"Mil-Spec — 79.92%"`). Source: `CaseEntry.rarity_weights[tier]`.

---

#### F-REF-3: Affordability Check (comparison — source: virtual-economy.md F2)

```
can_open   = balance >= (casePrice + KEY_COST_USD)    // grid affordability indicator
can_buy    = balance >= casePrice                      // Buy button enable state
```

Both comparisons delegate to `VirtualEconomy.canAfford(amount)`. Case Browser UI does not perform the arithmetic itself — it passes the amount and receives a boolean.

**Display use**: `can_open` drives card opacity (full vs greyed). `can_buy` drives the Buy button enabled state.

## Edge Cases

**E1: Player opens the browser with $0 balance**
All case cards fail `canAfford(casePrice + KEY_COST_USD)` — all cards render greyed. All Buy buttons are disabled (`canAfford(casePrice)` also fails at $0). The browser still opens and the full case archive is browsable. Odds and item pool detail remain accessible via accordion expand. No empty state is shown — having no buying power is not an error.

**E2: `buyCase()` returns false (Virtual Economy rejects the spend)**
Should not occur under normal flow since the Buy button is only enabled when `canAfford(casePrice)` is true. If it occurs (e.g., rapid double-click or a bug): the browser treats the failed buy as a no-op — no confirmation feedback fires, no accordion collapses. The Buy button re-evaluates its state on the next `balance-changed` event. No error toast is required; the silent failure is sufficient because the button will self-disable if balance is truly insufficient.

**E3: `getCaseList()` returns an empty array on open**
Grid renders with zero cards. An empty-state message is shown: `"No cases found — the case database may not have loaded correctly."` The browser is still dismissible. This indicates a Case Data Store load failure, not a Case Browser failure.

**E4: `CaseEntry.image_url` is null for a card**
The card renders a rarity-neutral placeholder (dark grey rectangle with the case name centered). The accordion also uses the placeholder for the larger image. Functionality is unaffected; the placeholder is styled consistently with the CS2 dark UI palette.

**E5: `getCase(id)` returns null when accordion tries to load the detail panel**
The accordion body shows `"Case detail unavailable."` The Buy button is hidden (not disabled — omitted entirely). The player can collapse and select a different case. This is a defensive case only — the Case Data Store is read-only after load, so a case present in `getCaseList()` should always be retrievable by `getCase(id)`.

**E6: Balance drops mid-session due to a case purchase, making another card unaffordable**
`buyCase()` internally calls `VirtualEconomy.spend()`, which fires `balance-changed`. The browser's event listener re-evaluates affordability for all cards immediately. Cards that were affordable before the purchase may become greyed after it. The accordion for the previously expanded card remains open — the Buy button on it re-evaluates its own enable state. If the just-expanded card became unaffordable, its Buy button becomes disabled before the player can click it.

**E7: `CaseEntry.release_date` is missing or unparseable**
The accordion shows `"Release date: Unknown"` for that case. No effect on sorting by date — the case sorts to the end of date-ascending order, or the beginning of date-descending order (treat as epoch 0). All other fields display normally.

## Dependencies

### Upstream (this system depends on)

| System | Why needed | Hard/Soft | Interface |
|--------|-----------|-----------|-----------|
| **Case Data Store** (#1) | Source of all case metadata and item pools | Hard | `getCaseList() → CaseEntry[]`; `getCase(id) → CaseEntry` |
| **Virtual Economy** (#6) | Affordability evaluation and live balance change signals | Hard | `canAfford(amount)`; listens to `balance-changed` DOM event |
| **Case Inventory** (#7) | Purchasing a case (deducts balance, adds to inventory) | Hard | `buyCase(caseId, casePrice) → boolean` |
| **HUD / App Shell** (#11) | Opens and closes the browser modal | Soft | Activation mechanism (→ ADR). Case Browser does not activate itself. |

All hard dependencies must be in their initialized states before the Case Browser can open. If Case Data Store is in Error state, Case Browser will show the empty-state message (E3) rather than failing silently.

### Downstream (systems that depend on this one)

None. Case Browser UI is terminal in the dependency graph — no other system reads from it.

### Bidirectionality Notes

The following upstream GDDs already reference Case Browser UI in their downstream tables and do not require updates:
- `case-data-store.md` — Downstream table lists "Case Browser UI"
- `virtual-economy.md` — Downstream table lists "Case Browser UI (#15)"

The following upstream GDDs must be verified to list Case Browser UI as a dependent:
- `case-inventory.md` — should list Case Browser as a caller of `buyCase()` in its Downstream Dependents table
- `hud-app-shell.md` — should reference Case Browser UI as a modal it opens/closes

## Tuning Knobs

| Knob | Current Value | Safe Range | Effect if too high / too low |
|------|--------------|-----------|------------------------------|
| **`defaultSortOrder`** | `price_asc` (cheapest first) | `price_asc`, `price_desc`, `alpha_asc`, `date_desc` | Changes which cases are most visible on open. `price_asc` prioritises accessible cases; `date_desc` prioritises familiarity for active players. |
| **`affordabilityOpacity`** | `0.50` | `0.25 – 0.70` | Too low (< 0.25): unaffordable cases become nearly invisible — discourages discovery. Too high (> 0.70): greyed and full-color cards look too similar — affordability signal is lost. |
| **`buyConfirmDurationMs`** | `1500` ms | `800 – 3000` ms | Too short: player misses the feedback, uncertain if buy succeeded. Too long: feels slow and blocks re-engagement with the grid. |
| **`accordionAnimDurationMs`** | `200` ms | `100 – 400` ms | Too fast: feels abrupt; too slow: feels sluggish and breaks Zero Friction. |
| **`gridColumns`** | `4` (desktop), `2` (mobile) | Desktop: `3–6` / Mobile: `1–3` | Too few columns: forces excessive scrolling. Too many: cards become too small to read names and prices. |

**Interaction between knobs**: `affordabilityOpacity` and `gridColumns` together define the browse experience density. At high column counts (5–6), low opacity greyed cards can make the page look mostly washed-out if the player has a low balance — prefer higher opacity at higher density, or reduce columns to maintain visual clarity.

## Visual/Audio Requirements

*Note: art-director not consulted — Lean mode. Review against art bible (Sections 1–4 minimum) before UI implementation begins.*

### Visual Requirements

**Source of truth**: CS2 Dark Arsenal visual direction (game-concept.md Visual Identity Anchor).

**Case card — grid tile:**
- Background: `#1b2838` (Steam dark) with a subtle `#2a475e` border
- Cover art: fills the card top area; aspect ratio preserved; placeholder is a dark grey rectangle with the case name if `image_url` is null
- Name: white, sharp sans-serif; price: `#c6d4df` (Steam light grey)
- **Affordable state**: full-color cover art; no overlay
- **Unaffordable state**: cover art at `affordabilityOpacity` (default 50%) opacity; name and price retain full contrast (greying the image, not the text)

**Accordion detail panel:**
- Expands inline — the card grows vertically; no pop-out or separate layer
- Larger case image (2× tile size), flush left; cost breakdown text flush right
- Rarity tier sections use exact CS2 rarity hex values as section headers and item name colors:
  - Mil-Spec: `#4b69ff`
  - Restricted: `#8847ff`
  - Classified: `#d32ce6`
  - Covert: `#eb4b4b`
  - Rare Special (knife/glove): `#e4ae39`

**Sort controls:**
- Minimal dark-UI tabs or a dropdown above the grid; no prominent styling — must not compete with case art for attention

**Buy button:**
- Enabled: high-contrast accent (CS2 green `#5c7e10` or Steam blue `#1a9fff`); confirm at art bible stage
- Disabled: `#3d4450` with `#6c7a8f` text — clearly inactive, not just greyed

**Animation:**
- Accordion expand/collapse: `accordionAnimDurationMs` (default 200ms), ease-out — matches CS2's deceleration language. No bounce, no spring.
- Modal open/close: fade + slight scale (0.95 → 1.0), ~150ms — consistent with CS2's UI overlay transitions

### Audio Requirements

| Event | Sound |
|-------|-------|
| Browser modal opens | Subtle UI swoosh — low volume, short (< 200ms) |
| Case card expand (accordion) | Soft click/tick — same family as reel tick sound, lower pitch |
| Buy Case success | Short positive chime — distinct from the reveal sting; ~300ms |
| Buy Case failure (button click while disabled) | Silent — disabled buttons produce no audio |
| Browser modal closes | No sound (or same subtle swoosh reversed) |

Exact sound files TBD pending Audio System implementation. Sound must come from the CS2-adjacent SFX family — no original audio that conflicts with Pillar 4 (Sound Is Sacred).

## UI Requirements

### Layout

Case Browser UI renders as a **full-screen overlay modal**:
- Z-index above the main screen; backdrop overlay at ~70% opacity blocks interaction with the main screen
- Inner panel: centered, max-width `1200px`, full-height scrollable on desktop; full-screen with internal scroll on mobile
- Close button: top-right corner (`×`), always visible; Escape key also dismisses

### Grid Area

- Scrollable grid of case cards below the sort controls
- Grid columns: `gridColumns` tuning knob (default 4 desktop, 2 mobile)
- Card height: fixed (covers consistent aspect ratio); card width: fills column
- Scroll: vertical only; cards do not paginate — all cases load into the grid at once (MVP case count is small enough to render without virtualization)

### Sort Bar

- Horizontal control strip directly above the grid
- Controls: `[Price ↑]` `[Price ↓]` `[A→Z]` `[Newest]` — toggle tabs or a `<select>` dropdown
- Active sort visually highlighted; default is `[Price ↑]`

### Case Card (grid tile)

```
┌──────────────┐
│   [IMAGE]    │  ← CaseEntry.image_url (cover art)
│              │
├──────────────┤
│ Case Name    │  ← CaseEntry.name
│ $0.49        │  ← CaseEntry.market_price
└──────────────┘
```
- Affordable: full opacity, subtle hover highlight
- Unaffordable: image at `affordabilityOpacity`; name and price full contrast
- Click anywhere on card to expand accordion

### Accordion Detail (expanded card)

```
┌──────────────────────────────────┐
│ [LARGE IMAGE]  Case Name         │
│                Released: 2022-07 │
│                Case: $0.49       │
│                Key: $2.49        │
│                Total: $2.98      │
├──────────────────────────────────┤
│ ■ Mil-Spec — 79.92%              │  ← rarity color header
│   P250 | Re.built                │
│   USP-S | …                      │
├──────────────────────────────────┤
│ ■ Restricted — 15.98%            │
│   …                              │
│   (all 5 tiers listed)           │
├──────────────────────────────────┤
│          [ Buy Case ($0.49) ]    │  ← Buy button, right-aligned
└──────────────────────────────────┘
```
- Item names: `weapon | skin` format per row
- Tier headers: CS2 rarity hex color square + tier name + weight %
- Buy button: right-aligned, full-width on mobile

### Empty State

If `getCaseList()` returns `[]`: centered message inside the grid area — `"No cases found — the case database may not have loaded correctly."` No cards rendered.

### Responsive Breakpoints

| Viewport | Grid columns | Accordion image |
|----------|-------------|-----------------|
| ≥ 1200px | 4 | 2× tile width |
| 768–1199px | 3 | 1.5× tile width |
| < 768px | 2 | Full-width |

## Acceptance Criteria

**AC-CBR-01:** GIVEN the application is loaded, WHEN the player triggers "Browse Cases" from the HUD, THEN the Case Browser UI overlay renders over the main screen, and clicking any HUD element or main-screen button does not trigger its action while the overlay is open.

**AC-CBR-02:** GIVEN the Case Browser overlay opens, WHEN `getCaseList()` is called, THEN the case grid renders with one card per loaded CaseEntry.

**AC-CBR-03:** GIVEN the case grid is rendered with no explicit sort applied, WHEN cards are laid out, THEN the cheapest-priced case appears as the first card (top-left).

**AC-CBR-04:** GIVEN a CaseEntry with `market_price: 0.49` and balance `10.00`, WHEN the grid renders, THEN that card is displayed at full opacity (the player can afford $2.98 total open cost).

**AC-CBR-05:** GIVEN a CaseEntry with `market_price: 8.00` and balance `5.00`, WHEN the grid renders, THEN that card's cover art is rendered at `affordabilityOpacity` (player cannot afford $10.49 total open cost).

**AC-CBR-06:** GIVEN no case card is expanded, WHEN the player clicks a case card, THEN that card expands to show: larger case image, release date, cost breakdown, per-tier item list, and Buy button.

**AC-CBR-07:** GIVEN card A is expanded, WHEN the player clicks card B, THEN card A collapses and card B expands; only one card is expanded at any time.

**AC-CBR-08:** GIVEN a case card with `market_price: 0.49` is expanded, WHEN the accordion detail renders, THEN the cost breakdown displays `"Case: $0.49 + Key: $2.49 = $2.98 to open"`.

**AC-CBR-09:** GIVEN a case card is expanded and the player's balance ≥ `casePrice`, WHEN the Buy button renders, THEN the Buy button is enabled (clickable).

**AC-CBR-10:** GIVEN a case card is expanded and the player's balance < `casePrice`, WHEN the Buy button renders, THEN the Buy button is disabled (not clickable).

**AC-CBR-11:** GIVEN the Buy button is enabled, WHEN the player clicks it, THEN `CaseInventory.buyCase(caseId, casePrice)` is called AND a success confirmation message is visible for at least `buyConfirmDurationMs` milliseconds AND the accordion collapses after the confirmation period.

**AC-CBR-12:** GIVEN a successful buy occurs, WHEN `CaseInventory.buyCase()` returns success, THEN the Case Browser overlay remains open; the player can continue browsing.

**AC-CBR-13:** GIVEN the Case Browser overlay is open, WHEN a `balance-changed` DOM event fires, THEN all case card affordability indicators update to reflect the new balance with no page reload.

**AC-CBR-14:** GIVEN `getCaseList()` returns an empty array, WHEN the grid renders, THEN the grid area shows `"No cases found — the case database may not have loaded correctly."` and zero case cards are rendered.

**AC-CBR-15:** GIVEN a CaseEntry with `image_url: null`, WHEN the case card renders, THEN a placeholder (dark grey rectangle with case name) is shown instead of cover art.

**AC-CBR-16:** GIVEN a case card is expanded, WHEN the accordion item list renders, THEN items are grouped by rarity tier; each tier header shows the tier name and a drop percentage (e.g., `"Mil-Spec — 79.92%"`); each item row shows the item in `weapon | skin` format.

**AC-CBR-17:** GIVEN the Case Browser overlay is open, WHEN the player clicks the close button or presses Escape, THEN the overlay closes and the main screen is interactive again.

**AC-CBR-18:** GIVEN a balance of $0.00, WHEN the case grid renders, THEN all case cards render at `affordabilityOpacity`; the browser remains open and all accordions remain expandable.

**AC-CBR-19:** GIVEN a balance of $1.00 and a case with `market_price: 0.80` (so `canAfford(0.80)` = true but `canAfford(3.29)` = false), WHEN the grid and expanded accordion both render, THEN the grid card displays at `affordabilityOpacity` AND the Buy button is enabled.

**AC-CBR-20:** GIVEN the Buy button is clicked and `CaseInventory.buyCase()` returns `false`, WHEN the call completes, THEN no confirmation feedback is shown, the accordion remains open, and the player's balance is unchanged.

**AC-CBR-21:** GIVEN a CaseEntry whose `release_date` field is absent or null, WHEN the accordion detail renders, THEN the release date field displays `"Unknown"`.

**AC-CBR-22:** GIVEN a case card is expanded and `CaseDataStore.getCase(id)` returns null, WHEN the accordion detail renders, THEN the accordion body shows `"Case detail unavailable"` and no Buy button is rendered.

**AC-CBR-23:** GIVEN the player has opened the browser and expanded one accordion (triggering `getCase(id)` for that card), WHEN the player expands a second different card, THEN `getCaseList()` is NOT called again; the grid data is served from the cached list loaded on browser open.

## Open Questions

**OQ-1: Browser activation mechanism**
How does the HUD/App Shell open and close the Case Browser modal? Options: (a) direct module function call (`CaseBrowser.open()` / `.close()`), (b) DOM custom event (`case-browser-open`), (c) framework router change. The choice here is an architectural constraint that affects how the two modules are coupled.
**Owner**: Technical Director · **Target**: ADR in Technical Setup phase

**OQ-2: Buy button accent color**
The Visual/Audio section lists two candidate accent colors for the enabled Buy button: CS2 green (`#5c7e10`) or Steam blue (`#1a9fff`). Cannot be finalized until the art bible (Sections 1–4) defines the primary interactive-element color.
**Owner**: Art Director · **Target**: After art bible Section 3 (Color Palette) is approved

**OQ-3: Per-item odds display**
The accordion currently shows tier-level odds only (e.g., `"Mil-Spec — 79.92%"`). Should it also show per-item probability (e.g., `"11.42% per item"` for a tier with 7 items)? The per-item formula is already defined in the entity registry (`per_item_probability`). Showing per-item odds increases transparency (Pillar 1: Faithful Over Flashy) but adds visual complexity to the accordion.
**Owner**: Game Designer · **Target**: Before Case Browser UI epic is created in Pre-Production

**OQ-4: Scroll position and sort order persistence within a session**
When the player closes and reopens the Case Browser in the same session, should the scroll position and active sort order be restored? Persisting across full page reloads is out of scope; within-session memory is a simple variable.
**Owner**: UX Designer · **Target**: `/ux-design case-browser` spec in Pre-Production

**OQ-5: Visual treatment for "can buy, can't open" state**
AC-CBR-19 defines the case where a grid card is greyed (can't afford full open cost) but the Buy button is enabled (can afford the case alone). Should the accordion show an advisory message — e.g., `"You can buy this case but will need to earn $1.49 more to open it"` — to help the player understand the state?
**Owner**: Game Designer / UX Designer · **Target**: Before Case Browser UI epic is created
