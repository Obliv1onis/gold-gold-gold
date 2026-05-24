# Market Browser UI

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-21
> **Implements Pillar**: Faithful Over Flashy · Every Case Counts · Zero Friction

## Overview

The Market Browser UI is the direct-purchase catalogue for The Vault. It surfaces every CS2 skin across all cases in the data store as a browsable, filterable grid — skin name, weapon type, rarity, and current market price. Where the Case Browser UI lets players buy a case and pull a random item, the Market Browser lets them skip the reel entirely and acquire exactly the skin they want at today's market price. This is the "skip the gamble" half of the Vertical Slice's trading fantasy.

Technically, the Market Browser UI reads its skin catalog from the Case Data Store (all `ItemEntry` objects across all cases), live prices from the Price API Layer (`getPrice(itemId)`), and images from the Skin Image Loader (`getImage(imageUrl, rarity)`). Affordability is evaluated against the Virtual Economy (`canAfford(price)`). Purchasing a skin calls `VirtualEconomy.spend(price)` and `SkinInventory.addItem(itemEntry)` in sequence. The browser listens to `balance-changed` and `price-updated` DOM events to refresh affordability indicators and price displays in real time without user interaction.

The skin catalog requires a new `CaseDataStore.getAllSkins()` interface (or equivalent) that returns a flat list of all `ItemEntry` objects across all cases — the existing case-centric API (`getCaseList()`, `getAllItems(caseId)`) does not expose a cross-case flat catalog. This retrofit is a design requirement surfaced here and must be added to the Case Data Store GDD before implementation. Prices are lazy-fetched via the Price API Layer as items scroll into view; the full catalog is too large to preload upfront.

## Player Fantasy

The Market Browser delivers the other side of the case opening fantasy: targeted acquisition. Opening cases is gambling — you pay for uncertainty, you accept whatever the reel gives you. The Market Browser is the antithesis: you name exactly what you want, you see the price, and you buy it. This is the power that real CS2 money buys on the Steam Market — the ability to just have the skin you want, right now, with no variance.

Standing in front of the full catalog — every AK-47, every knife, every Classified, Covert, or Rare Special ever added to a CS2 case — and browsing by weapon, by rarity, by price, is its own kind of pleasure. Players who have played CS2 will find skins they've wanted for years and always thought were too expensive in the real game. The Market Browser makes those skins accessible at their real prices, but from a $2,000 virtual budget that has no withdrawal pain attached.

The buy moment is deliberately unambiguous: there is no reel, no animation, no suspense. You click Buy, the balance drops, the skin appears in your inventory. What CS2 players call "buyout" — skipping the market listing uncertainty and paying the asking price — is the exact transaction this screen models. The fantasy is competence and control, the complement to the reel's pure chance.

The Market Browser also serves the **Pillar 3 (Every Case Counts)** promise at the skin level: every skin from every case is here. Players can browse the history of CS2 weapon finishes, find items from cases that are no longer dropped, and fill out a virtual collection that would cost thousands of dollars to assemble in the real game.

## Detailed Design

### Core Rules

**Rule 1 — Modal Overlay**

The Market Browser UI is a full-screen modal overlay, opened by a "Browse Market" control in the HUD/App Shell (activation mechanism → ADR, consistent with Case Browser UI OQ-1). While open, the main screen is rendered beneath but is not interactive. The browser is dismissed by a close button (top-right) or the Escape key.

**Rule 2 — Catalog Loading**

On open, the browser calls `CaseDataStore.getAllSkins()` once to load the complete skin catalog into local state. This returns a flat `ItemEntry[]` across all cases — a new method required on Case Data Store (see Dependencies). The list is cached for the lifetime of the open overlay; no re-fetch occurs while the browser is open.

**Rule 3 — Grid and Card Layout**

Skins are displayed in a scrollable grid. **Default sort: price ascending (cheapest first)**, using the fallback `market_price` from Case Data Store (before live prices are fetched). Each skin card shows:

- Skin image (lazy-loaded — see Rule 5)
- Weapon + skin name (`"[item.weapon] | [item.skin]"`)
- Market price from Price API Layer (see Rule 6 for price display)
- Rarity-colored border (`#4B69FF` Mil-Spec → `#E4AE39` Rare Special)
- Affordability indicator: full color if `VirtualEconomy.canAfford(price)` is true; 50% opacity and greyed if false
- **"Buy ($X.XX)"** button — enabled if affordable; disabled if not

**Rule 4 — Filter and Sort Controls**

Controls appear in a persistent bar above the grid:

| Control | Options |
|---------|---------|
| **Rarity filter** | All / Mil-Spec / Restricted / Classified / Covert / Rare Special |
| **Weapon type filter** | All / Rifles / Pistols / SMGs / Shotguns / Snipers / Machine Guns / Knives / Gloves |
| **Sort** | Price (cheap → expensive, default) / Price (expensive → cheap) / Rarity (highest first) / Alphabetical A→Z |

Filters are applied client-side to the in-memory catalog. Changing a filter re-renders the grid immediately; no re-fetch.

**Rule 5 — Lazy Image Loading**

Skin images are not preloaded upfront — the catalog is too large. Instead, `SkinImageLoader.getImage(item.image_url, item.rarity)` is called per card as it renders into the viewport. For cards that haven't been preloaded, `getImage()` returns the rarity placeholder immediately (per Skin Image Loader behavior). If a prior `preloadCase()` call (from the Case Opening flow) already loaded some items, those are served from cache. The Market Browser does not call `preloadCase()`.

**Rule 6 — Price Display**

Each card's price is fetched from `PriceAPILayer.getPrice(item.item_id)` when the card first renders. The display format depends on the returned status:

| Status | Display format | Example |
|--------|---------------|---------|
| `live` | `$X.XX` (full color) | `$12.50` |
| `stale` | `~$X.XX` (muted, small clock icon) | `~$12.50` |
| `fallback` | `~$X.XX ⚠` (muted, warning indicator) | `~$12.50 ⚠` |

The Market Browser listens to the `price-updated` DOM event on `window`. On each event, if the `detail.itemId` matches a currently visible card, that card's price display and affordability indicator are updated immediately.

**Rule 7 — Affordability Updates**

The Market Browser listens to the `balance-changed` DOM event on `document`. On each event, it re-evaluates `VirtualEconomy.canAfford(price)` for every currently visible card and updates the affordability indicator and Buy button state. Price changes (Rule 6) also trigger affordability re-evaluation for the affected card.

**Rule 8 — Buy Flow (with confirmation)**

```
1. Player clicks "Buy ($X.XX)" on an affordable card.

2. Confirmation dialog opens:
   "Buy [weapon] | [skin] for [price_display]?"
   If status is 'stale' or 'fallback': append "(price may be outdated)"
   [Confirm Purchase] [Cancel]

3. Cancel → dialog closes; no state change.

4. Confirm →
   a. Re-validate: VirtualEconomy.canAfford(currentPrice)
      If false (balance dropped since dialog opened): dismiss dialog;
      show error toast "Insufficient balance"; do not proceed.
   b. VirtualEconomy.spend(currentPrice) — deduct balance
   c. SkinInventory.addItem(item.itemEntry) — add skin to player's inventory
   d. Brief success indicator on the card: "Added to inventory" (1500ms)
   e. Dialog closes.
   f. The browser does NOT close — player may buy more skins.
```

The `currentPrice` used in step 4 is the most recent price returned by `PriceAPILayer.getPrice(itemId)` at the moment Confirm is pressed — not the price displayed when the dialog opened (which may be slightly stale). This ensures the spend call uses the best available price data.

**Rule 9 — No Duplicate Purchase Prevention**

The Market Browser does not prevent buying the same skin multiple times. Players may own duplicate instances — consistent with the Skin Inventory's instance model and real CS2 market behavior.

### States and Transitions

| State | Description |
|-------|-------------|
| **Closed** | Not rendered. No event listeners active. |
| **Open — Grid** | Grid visible. Filter/sort controls active. Listening to `balance-changed` and `price-updated`. |
| **Open — Confirming** | Buy confirmation dialog open for a specific skin. Grid visible but not interactive behind the dialog. |

| Transition | Trigger |
|-----------|---------|
| Closed → Open–Grid | HUD opens the browser; `getAllSkins()` loads; grid renders with default sort. |
| Open–Grid → Open–Confirming | Player clicks "Buy" on an affordable card. |
| Open–Confirming → Open–Grid | Player clicks Cancel, or purchase completes (success or insufficient balance). |
| Open–Grid → Closed | Player clicks close button or presses Escape. |
| Open–Confirming → Closed | Player presses Escape. |

### Interactions with Other Systems

| System | Direction | Interface | Notes |
|--------|-----------|-----------|-------|
| **Case Data Store (#1)** | ↑ depends on | `getAllSkins() → ItemEntry[]` | New method required — retrofit to CDS GDD (see Dependencies). Called once on open. |
| **Price API Layer (#16)** | ↑ depends on | `getPrice(itemId)` | Called per visible card on render. Listens to `price-updated` DOM event for live refresh. |
| **Skin Image Loader (#10)** | ↑ depends on | `getImage(item.image_url, item.rarity)` | Lazy, per-card as rendered. No `preloadCase()` call. |
| **Virtual Economy (#6)** | ↑ depends on | `canAfford(price)`, `spend(price)` | `canAfford` per card; `spend` on confirmed buy. Listens to `balance-changed` for affordability refresh. |
| **Skin Inventory (#8)** | ↑ depends on | `addItem(itemEntry)` | Called on confirmed buy to add skin to player's collection. |
| **HUD / App Shell (#11)** | ↓ depended on by | Open/close activation | App Shell opens and closes the browser (mechanism TBD → ADR). |

## Formulas

The Market Browser UI contains no mathematical formulas. All logic is conditional (affordability checks, filter matching, price status display). Formulas from dependency systems that are relevant to this screen:

#### F-REF-1: Total Purchase Cost (referenced, owned by Virtual Economy)

```
direct_purchase_cost = item.market_price   (or PriceAPILayer.getPrice(itemId).price)
```

Direct skin purchase has **no key cost** — `KEY_COST_USD` ($2.49) applies only to case opens via the Case Opening Orchestrator. This is a critical distinction from the Case Browser's total open cost formula.

#### F-REF-2: Affordability Check (referenced, owned by Virtual Economy)

```
can_buy = VirtualEconomy.canAfford(direct_purchase_cost)
```

#### F-REF-3: Estimated Sell Value (display only — owned by Skin Inventory / net_proceeds formula)

```
estimated_sell = price * (1 - sell_fee_rate)   // sell_fee_rate = 0.15
```

Displayed on each skin card as "Sell value: ~$X.XX" to help players assess whether a skin is "worth it" relative to their balance. This is display-only — it is not used in any transaction. The actual sell proceeds are computed at sell time by Skin Inventory using the then-current market price.

*Example: Skin priced at $12.50 → estimated sell value = $12.50 × 0.85 = $10.63*

## Edge Cases

**E1: Balance drops below skin price while the confirmation dialog is open**
Player clicks Buy ($12.50), dialog opens. Before they confirm, another tab or action reduces balance below $12.50.
*Handling*: Rule 8 step 4a — `canAfford()` is re-validated at Confirm time. If it fails, the dialog closes, an error toast shows "Insufficient balance", and no spend/addItem calls are made.

**E2: Price changes between dialog open and Confirm click**
Price API Layer refreshes and the price for this item changes from $12.50 to $14.00.
*Handling*: `currentPrice` in Rule 8 step 4 is `PriceAPILayer.getPrice(itemId)` called at Confirm time — it uses the latest available price. `spend(14.00)` is called. If the player no longer has enough for the new price, the spend returns false → error toast, dialog closes.

**E3: `getAllSkins()` returns an empty array (data error or no cases loaded)**
*Handling*: The browser opens with an empty grid and shows an informational message: "No skins available. Case data may not have loaded." The browser is still closeable. No crash or undefined behavior.

**E4: `getAllSkins()` returns duplicate item IDs (data integrity issue in CDS)**
*Handling*: Market Browser UI deduplicates by `item_id` before rendering. If two entries share an `item_id`, the first encountered is kept. This is a data quality issue in CDS; the browser degrades gracefully.

**E5: `getPrice(itemId)` returns `status: 'fallback'` for a skin (price API unavailable)**
*Handling*: Skin card shows `~$X.XX ⚠` (fallback indicator). Buy button remains enabled at the fallback price. Confirmation dialog appends "(price may be outdated)". Purchase proceeds at the fallback price. This is the intended degradation path from the Price API Layer design.

**E6: `SkinImageLoader.getImage()` returns a rarity placeholder (image load failed)**
*Handling*: The card renders with the rarity-colored placeholder instead of the weapon art. All other card content (name, price, Buy button) renders normally. No user-visible error. The card is fully functional with placeholder art.

**E7: Skin catalog contains thousands of items (performance)**
*Handling*: Filters and sort are applied client-side to the in-memory array. Rendering uses a virtual list or windowing strategy to prevent DOM node explosion with large catalogs. This is an implementation concern flagged here so the architecture ADR accounts for it. The GDD does not prescribe the rendering strategy — only that large catalogs must not cause visible lag.

**E8: Player opens the Market Browser while the reel is animating (`isAnimating` is true)**
*Handling*: Opening the Market Browser is allowed during reel animation — it is a separate modal overlay and does not interact with the reel. There is no race condition: direct purchases use `SkinInventory.addItem()` from the Market Browser flow, which is independent of the Case Opening Orchestrator's `addItem()` call on reel completion.

**E9: Active filter produces an empty grid**
*Handling*: Empty state message shown: "No skins match your filters." Filter controls remain visible and adjustable. No crash or infinite loading state.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface | Hard/Soft |
|--------|-----------|-----------|-----------|
| **Case Data Store (#1)** | Full skin catalog; item metadata per card | `getAllSkins() → ItemEntry[]` — **new method, retrofit required** | Hard |
| **Price API Layer (#16)** | Live prices per skin card | `getPrice(itemId) → PriceResult` | Soft (degrades to CDS fallback prices) |
| **Skin Image Loader (#10)** | Skin art per card | `getImage(imageUrl, rarity) → HTMLImageElement` | Soft (degrades to rarity placeholder) |
| **Virtual Economy (#6)** | Affordability check; balance deduction on purchase | `canAfford(price)`, `spend(price)` | Hard |
| **Skin Inventory (#8)** | Stores purchased skin | `addItem(itemEntry) → InventorySkinEntry` | Hard |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they rely on |
|--------|-----------------|------------------|
| **HUD / App Shell (#11)** | Opens and closes the Market Browser | Shell triggers open/close via mechanism TBD (see OQ-1) |

**Pending GDD retrofits surfaced here:**

- **Case Data Store GDD (#1)**: Must add `getAllSkins(): ItemEntry[]` to its public API — returns a flat list of all `ItemEntry` objects across all cases.
- **HUD / App Shell GDD (#11)**: Must add Market Browser to its downstream dependents table when the activation mechanism is resolved (see case-browser-ui.md OQ-1).
- **Skin Inventory GDD (#8)**: Does not yet list Market Browser UI as a downstream dependent — must be added.
- **Virtual Economy GDD (#6)**: Already lists Market Browser UI — no update required.

## Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|------------|--------|
| `defaultSortOrder` | `price_asc` | `price_asc`, `price_desc`, `rarity_desc`, `alpha_asc` | The sort applied when the browser first opens. `price_asc` makes cheapest skins most visible, reducing barrier to first purchase. |
| `affordabilityOpacity` | `0.50` | `0.20–0.80` | Opacity of unaffordable skin cards. Lower = more obviously inaccessible; higher = harder to distinguish from affordable cards. Mirrors Case Browser UI's matching knob. |
| `buyConfirmDurationMs` | `1500` | `800–3000` | Duration of the "Added to inventory" success indicator on the card after a confirmed purchase. |
| `estimatedSellValueVisible` | `true` | `true / false` | If false, the "Sell value: ~$X.XX" display is hidden from cards. Showing sell value helps players evaluate purchases but adds information density. |
| `gridColumns` | `4 (desktop) / 2 (mobile)` | `2–6` | Number of skin cards per grid row. More columns = more visible at once; fewer = larger cards with more detail. |
| `stalePricePrefix` | `"~"` | any short string | Prefix shown on stale/fallback prices. `"~"` indicates "approximately." Can be changed to `"≈"` or localized. |

## Visual/Audio Requirements

**Visual Direction (CS2 Dark Arsenal)**

The Market Browser UI follows the same visual language as the Case Browser UI:
- Background: `#1b2838` (Steam dark) for the modal backdrop
- Card surfaces: `#2a475e` (Steam mid-dark)
- Rarity-colored borders per skin card (exact CS2 hex values from Skin Image Loader):
  - Mil-Spec `#4B69FF`, Restricted `#8847FF`, Classified `#D32EE6`, Covert `#EB4B4B`, Rare Special `#E4AE39`
- Unaffordable cards: full card at 50% opacity (not just the border)
- Price text: white full-color for `live`; muted grey for `stale`/`fallback` with prefix indicator
- Buy button: rarity-tinted background (same rarity color as card border) when affordable; grey when disabled
- Success feedback: brief green tint flash on card + "Added to inventory" text (1500ms)

**ASCII Card Mockup:**

```
┌──────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← rarity-colored border
│  ┌──────────────┐   │
│  │   [skin img] │   │
│  └──────────────┘   │
│  AK-47 | Asiimov    │
│  $12.50             │  ← live price (full color)
│  Sell: ~$10.63      │  ← estimated sell value
│  [Buy ($12.50)]     │  ← enabled button
└──────────────────────┘
```

Stale price variant: `~$12.50 🕐` (muted + clock indicator)
Fallback price variant: `~$12.50 ⚠` (muted + warning indicator)

**Audio**

| Event | Sound |
|-------|-------|
| Browser opens | Subtle UI whoosh (consistent with Case Browser open sound) |
| Buy button click | UI click / confirm sound |
| Purchase confirmed (success) | Short positive chime (distinct from reel reveal sting) |
| Error toast (insufficient balance) | Short negative tone |
| Browser closes | Subtle UI whoosh (reverse/close) |

All audio is UI-tier — lower priority and shorter than gameplay sounds. No exact Hz values specified here; these are direction notes for the Audio System GDD implementation.

> 📌 **Asset Spec** — Visual/Audio requirements are defined. After the art bible is approved, run `/asset-spec system:market-browser-ui` to produce per-asset visual descriptions, dimensions, and generation prompts from this section.

## UI Requirements

**Layout — Full-Screen Modal**

```
┌──────────────────────────────────────────────────┐
│  Market Browser  [Rarity ▼] [Type ▼] [Sort ▼]  [✕] │
├──────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │
│  │card│ │card│ │card│ │card│   ← 4-col grid      │
│  └────┘ └────┘ └────┘ └────┘                    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │
│  │card│ │card│ │card│ │card│                    │
│  └────┘ └────┘ └────┘ └────┘                    │
│  (scrollable — virtual list for large catalogs)  │
└──────────────────────────────────────────────────┘
```

**Filter/Sort Bar** — persistent, above grid:
- Rarity dropdown filter (All, Mil-Spec, Restricted, Classified, Covert, Rare Special)
- Weapon Type dropdown filter (All, Rifles, Pistols, SMGs, Shotguns, Snipers, Machine Guns, Knives, Gloves)
- Sort dropdown (Price: Low → High, Price: High → Low, Rarity: Highest First, A → Z)
- Result count: "Showing 124 skins" (updates as filters change)

**Skin Card** (per card, min-width 200px, max-width 250px):
- Skin image: 200×200px, lazy-loaded, rarity placeholder until loaded
- Weapon | Skin name (two-line max; overflow ellipsis)
- Price: `$X.XX` (live) or `~$X.XX 🕐` (stale) or `~$X.XX ⚠` (fallback)
- Sell value: `Sell: ~$X.XX` (smaller text, muted)
- Buy button: `Buy ($X.XX)` — enabled/disabled per affordability
- Rarity-colored border (2px, exact CS2 rarity hex)
- Affordability: full opacity if affordable; 50% opacity if not

**Confirmation Dialog** (centered modal over the browser):

```
┌─────────────────────────────────────┐
│  Buy this skin?                     │
│                                     │
│  AK-47 | Asiimov (Field-Tested)     │
│  Price: $12.50                      │
│  [Price may be outdated]  ← if stale│
│                                     │
│  [Confirm Purchase]   [Cancel]      │
└─────────────────────────────────────┘
```

**Responsive breakpoints:**
- Desktop (≥1024px): 4-column grid
- Tablet (≥600px, <1024px): 3-column grid
- Mobile (<600px): 2-column grid

**Empty states:**
- No catalog loaded: "No skins available. Case data may not have loaded."
- Filter results empty: "No skins match your filters. Try adjusting the filters above."

> 📌 **UX Flag — Market Browser UI**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for each screen this system contributes to **before** writing epics.

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-MBR-01 | Market Browser opened | `getAllSkins()` called once; grid renders with all skins sorted cheapest first | BLOCKING |
| AC-MBR-02 | Browser opens with 200 skins | Default sort is price ascending; first card has lowest `market_price` | BLOCKING |
| AC-MBR-03 | Rarity filter "Classified" selected | Grid shows only Classified skins; result count updates | BLOCKING |
| AC-MBR-04 | Weapon filter "Knives" selected | Grid shows only knife skins; result count updates | BLOCKING |
| AC-MBR-05 | Sort "Price: High → Low" selected | Grid re-renders with most expensive skin first | BLOCKING |
| AC-MBR-06 | Skin price ≤ current balance | Card at full opacity; Buy button enabled | BLOCKING |
| AC-MBR-07 | Skin price > current balance | Card at 50% opacity; Buy button disabled | BLOCKING |
| AC-MBR-08 | `balance-changed` fires (balance increases) | Previously unaffordable cards now affordable → full opacity + enabled Buy | BLOCKING |
| AC-MBR-09 | `balance-changed` fires (balance decreases) | Previously affordable cards now unaffordable → 50% opacity + disabled Buy | BLOCKING |
| AC-MBR-10 | `price-updated` fires for a visible skin | That card's price display updates to new price with `live` formatting | BLOCKING |
| AC-MBR-11 | `getPrice()` returns `status: 'live'` | Price shown as `$X.XX` in full color | BLOCKING |
| AC-MBR-12 | `getPrice()` returns `status: 'stale'` | Price shown as `~$X.XX` muted with clock indicator | BLOCKING |
| AC-MBR-13 | `getPrice()` returns `status: 'fallback'` | Price shown as `~$X.XX` muted with warning indicator | BLOCKING |
| AC-MBR-14 | Player clicks "Buy" on affordable card | Confirmation dialog opens with skin name and price | BLOCKING |
| AC-MBR-15 | Stale/fallback price in dialog | Dialog includes "(price may be outdated)" text | BLOCKING |
| AC-MBR-16 | Player clicks Cancel | Dialog closes; balance unchanged; skin not added to inventory | BLOCKING |
| AC-MBR-17 | Player clicks Confirm; balance sufficient | `spend(price)` + `addItem(item)` called; success indicator 1500ms | BLOCKING |
| AC-MBR-18 | Player clicks Confirm; balance dropped since dialog opened | `canAfford()` fails; dialog closes; "Insufficient balance" toast; no spend/addItem | BLOCKING |
| AC-MBR-19 | Price changes between dialog open and Confirm | Confirm uses `getPrice()` at confirm time, not dialog-open price | BLOCKING |
| AC-MBR-20 | Purchase confirmed | Browser remains open; player can buy more skins | BLOCKING |
| AC-MBR-21 | Escape key pressed (browser open) | Browser closes; `balance-changed` and `price-updated` listeners removed | BLOCKING |
| AC-MBR-22 | Escape key pressed (confirmation dialog open) | Dialog closes; browser returns to Open-Grid state | BLOCKING |
| AC-MBR-23 | Filter produces no results | Empty state: "No skins match your filters." | BLOCKING |
| AC-MBR-24 | `getAllSkins()` returns empty array | Empty state: "No skins available. Case data may not have loaded." | BLOCKING |
| AC-MBR-25 | Same skin bought twice | Two separate `InventorySkinEntry` instances in Skin Inventory | BLOCKING |
| AC-MBR-26 | Card renders before image loaded | Rarity placeholder shown; card fully functional (name, price, Buy) | BLOCKING |
| AC-MBR-27 | `getAllSkins()` returns duplicate `item_id` entries | Grid renders one card per unique `item_id`; duplicates dropped | BLOCKING |
| AC-MBR-28 | Card with known `market_price` renders | Sell value shown as `~$(market_price × 0.85)` rounded to 2dp | BLOCKING |
| AC-MBR-29 | Player completes a purchase | `spend()` called with `getPrice()` price at confirm time — NOT `market_price × 0.85`; sell value has no effect on transaction | BLOCKING |
| AC-MBR-30 | `price-updated` fires; new price exceeds balance (was affordable) | Card updates to 50% opacity; Buy button disabled | BLOCKING |
| AC-MBR-31 | `price-updated` fires; new price within balance (was unaffordable) | Card updates to full opacity; Buy button enabled | BLOCKING |
| AC-MBR-32 | Player clicks close button (Open-Grid state) | Browser closes; listeners removed | BLOCKING |
| AC-MBR-33 | Player clicks close button (confirmation dialog open) | Dialog and browser both close; all listeners removed | ADVISORY |
| AC-MBR-34 | Lazy-loaded image finishes loading | Rarity placeholder replaced by skin image; card layout stable | ADVISORY |

## Open Questions

**OQ-1 — Market Browser activation mechanism → ADR (Technical Setup blocker)**
How does the HUD/App Shell open and close the Market Browser? This is the same open question as Case Browser UI OQ-1. Both browsers should use the same activation mechanism — resolve them together in a single Technical Setup ADR covering both. Options: (a) direct JavaScript method call from App Shell, (b) DOM custom event (`open-market-browser` on document), (c) shared overlay manager module.

**OQ-2 — Virtual list / windowing library**
Edge Case E7 flags that large skin catalogs need windowed rendering to avoid DOM node explosion. A virtual list renders only visible viewport items. Options: (a) lightweight custom virtual scroller, (b) a library (e.g., TanStack Virtual). Resolution: Technical Setup ADR for UI rendering strategy. The GDD requires it be handled; the approach is an implementation choice.

**OQ-3 — `getAllSkins()` Case Data Store retrofit (implementation blocker)**
The Market Browser requires `CaseDataStore.getAllSkins(): ItemEntry[]`. The Case Data Store GDD must be updated to add this method before implementation. This is a hard dependency — the Market Browser cannot render its catalog without it. Retrofit must happen before the VS implementation sprint begins.

**OQ-4 — Sell value display at purchase time**
F-REF-3 shows estimated sell value as `market_price × 0.85`. Actual sell value at sell time uses the then-current live price, not the purchase-time price. This could be misleading if prices change. Options: (a) keep as-is (labeled "estimated"), (b) omit sell value display. Decision: UX spec phase.

**OQ-5 — Case origin display on skin cards**
Players may want to know which case a skin comes from (`ItemEntry.case_id` is available). Including case origin adds context; omitting keeps cards clean. Decision: UX spec phase.
