# Inventory UI

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-20
> **Implements Pillar**: Zero Friction · Faithful Over Flashy

## Overview

The Inventory UI is the player's collection view — a grid of every skin they currently own, sorted newest-first, with portfolio value at the top. Each card shows a skin's image, name, rarity, and market price, with a per-card Sell button that triggers an inline confirmation before calling `SkinInventory.sellItem()`. The view updates reactively via a `skin-inventory-changed` DOM event whenever items are added (after a reveal) or removed (after a sell).

The Inventory UI is accessed via a navigation element in the App Shell. It coexists with the Reel UI — navigating to Inventory does not cancel an active spin. When the player returns to the main reel view, any animation that was in progress has either completed or is still running per the Orchestrator's state.

This system is the final output display of the case opening economy. It answers the question every case-opening player asks: "What do I have to show for this?"

## Player Fantasy

The inventory is the trophy case. After a run of opens, coming here to see what accumulated — some blues, a purple, maybe a red — is the session's balance sheet. The dollar values on each card tell the economic story: was this profitable? How much did the knife cost in opens to get here?

The Sell button makes the inventory active, not passive. Sitting on a classified skin worth $5.00 while your balance is too low to open another case is a real decision point. Selling it gives you two more opens. Keeping it means less fuel for the next run. The inline confirmation ("Sell for $X.XX?") makes the stakes clear without being friction — one more click to confirm, then the balance ticks up and the card disappears.

For players building toward a balance-positive run, the inventory is a resource board. For players who open and sell immediately, it's nearly always empty. Both are valid patterns and the UI supports both without opinion.

## Detailed Design

### Core Rules

**Grid layout:**

```html
<div class="inventory-view">
  <div class="inventory-header">
    <span class="item-count">[N] items</span>
    <span class="portfolio-value">Portfolio value: $[X.XX]</span>
  </div>
  <div class="inventory-grid">
    <!-- one .inventory-card per InventorySkinEntry -->
    <div class="inventory-card rarity-[tier]">
      <img class="card-image" />
      <div class="card-name">[Weapon | Skin]</div>
      <div class="card-price">$[market_price]</div>
      <button class="btn-sell">Sell</button>
      <div class="sell-confirm" hidden>
        Sell for $[net_proceeds]?
        <button class="btn-confirm">Confirm</button>
        <button class="btn-cancel">Cancel</button>
      </div>
    </div>
  </div>
  <div class="inventory-empty" hidden>No skins yet. Open some cases!</div>
</div>
```

**Rendering:**

1. On view open (and on `skin-inventory-changed` event): call `SkinInventory.getItems()` → re-render the full grid.
2. Sort order: newest-first (matching `getItems()` output order).
3. Each card calls `SkinImageLoader.getImage(entry.item.image_url, entry.item.rarity)` for its image.
4. Empty state: if `getItems()` returns `[]`, show `.inventory-empty`; hide `.inventory-grid`.

**Sell flow per card:**

```
1. Player clicks "Sell" → show inline confirmation ("Sell for $[net_proceeds]?" + Confirm/Cancel)
2. Player clicks Cancel → hide confirmation; restore Sell button
3. Player clicks Confirm:
   a. Disable Confirm button immediately
   b. SkinInventory.sellItem(entry.instanceId, entry.item.market_price)
   c. If true: re-render grid (card disappears); portfolio value and count update
   d. If false: show inline "Could not sell" error; restore Sell button
```

**Portfolio value (header):**

Computed from `getItems()` at render time. Updated on every grid re-render.

**Reactivity:**

Listens for `skin-inventory-changed` DOM event from Skin Inventory. When it fires:
- If Inventory view is visible: re-render grid immediately.
- If not visible: mark dirty; re-render on next view open.

*`skin-inventory-changed` requires Skin Inventory to fire a DOM event on `addItem()`, `sellItem()`, and `clearInventory()`. This is a pending GDD update.*

### States and Transitions

| State | Description |
|-------|-------------|
| **Hidden** | Not the active view |
| **Visible (populated)** | View open, ≥1 items in grid |
| **Visible (empty)** | View open, 0 items — empty state shown |
| **Confirming sell** | A card's inline confirmation is open |

**Transitions:**
- `Hidden → Visible`: Player navigates to Inventory
- `Visible → Hidden`: Player navigates away
- `Visible → Confirming sell`: Player clicks Sell on a card
- `Confirming sell → Visible`: Cancel clicked; or sell confirmed and processed

### Interactions with Other Systems

| System | Direction | Interface | Notes |
|--------|-----------|-----------|-------|
| **Skin Inventory** (#8) | ↑ depends on | `getItems()`, `sellItem(instanceId, marketPrice)` | Listens to `skin-inventory-changed` DOM event |
| **Skin Image Loader** (#10) | ↑ depends on | `getImage(imageUrl, rarity)` | Per-card image fetch; synchronous |
| **App Shell / HUD** (#11) | ↓ depended on by | — | App Shell renders Inventory inside the content region on navigation |

## Formulas

#### F1: Net Proceeds Per Card

```
net_proceeds = market_price * (1 - SELL_FEE_RATE)
net_proceeds = market_price * 0.85
```

Displayed in the inline sell confirmation as `"Sell for $[net_proceeds.toFixed(2)]?"`. Matches the registry `net_proceeds` formula (owned by Skin Inventory GDD). Passed as `salePrice` to `sellItem()`.

#### F2: Portfolio Value (header)

```
portfolio_value = Σ (entry.item.market_price * 0.85)  for all entries in getItems()
```

Displayed as `"Portfolio value: $[portfolio_value.toFixed(2)]"`. This is the `portfolio_value` formula from the Skin Inventory GDD.

*Example: 2 items at $0.50 and $5.00:*
`(0.50 × 0.85) + (5.00 × 0.85) = 0.425 + 4.25 = 4.675 → "$4.68"`

## Edge Cases

**E1: `sellItem()` returns false (item already removed — e.g., sold via Reveal UI)**
*Handling*: Show inline "Could not sell" error on the card; restore Sell button. Item is already gone from inventory, so the next `skin-inventory-changed` event will remove the stale card on re-render. No double-deduction of balance.

**E2: `getImage()` returns placeholder (image not preloaded for old inventory items)**
*Handling*: Card renders with a rarity-colored 250×250 placeholder. Name, price, and Sell button still display correctly. Sell flow is unaffected.

**E3: Inventory view opened during an active reel spin**
*Handling*: Inventory renders from the current `getItems()` snapshot. If a new item arrives mid-view via `skin-inventory-changed`, the grid re-renders and the new card appears at the top (newest-first). No special handling required — reactivity handles it.

**E4: Very large inventory (100+ items)**
*Handling*: MVP renders all cards in a scrollable grid. No virtualization. Accepted for MVP — if performance degrades, virtualization is a post-MVP optimization.

**E5: `skin-inventory-changed` fires while a sell confirmation is open**
*Handling*: Re-render the full grid. If the item with an open confirmation is still in the inventory, the new card will also show the confirmation open (since the grid is rebuilt). If the item is gone (sold elsewhere), the card disappears. Simplest correct behavior.

**E6: Inventory opened for the first time with 0 items**
*Handling*: Empty state — `.inventory-empty` shown, `.inventory-grid` hidden, header reads "0 items | Portfolio value: $0.00".

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Skin Inventory** (#8) | Source of all inventory items; processes sell actions | `getItems()`, `sellItem(instanceId, marketPrice)`, `skin-inventory-changed` DOM event |
| **Skin Image Loader** (#10) | Provides skin images for each inventory card | `getImage(imageUrl, rarity)` — synchronous |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they rely on |
|--------|-----------------|------------------|
| **App Shell / HUD** (#11) | Renders Inventory UI in the content region on navigation | Navigation routing — App Shell swaps content region on nav click |

**Pending GDD update:**
- **Skin Inventory GDD**: Must be updated to specify that `addItem()`, `sellItem()`, and `clearInventory()` each fire a `skin-inventory-changed` custom DOM event on `document`. This is a prerequisite for Inventory UI reactivity.

## Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|------------|--------|
| `SELL_FEE_RATE` | 0.15 | Must match registry `sell_fee_rate` (0.15) | Affects net proceeds displayed in confirmation and passed to `sellItem()`. Change only via registry — do not hardcode here. |
| `GRID_COLUMNS` | Auto (CSS responsive) | 2–6 columns | Number of columns in the inventory grid. MVP uses CSS `auto-fill` with a minimum card width, no JS involvement. |

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-INV-UI-01 | Inventory view opened with 3 items in `SkinInventory` | 3 cards rendered; header reads "3 items" | BLOCKING |
| AC-INV-UI-02 | Inventory view opened with 0 items | Empty state shown ("No skins yet. Open some cases!"); header reads "0 items \| Portfolio value: $0.00" | BLOCKING |
| AC-INV-UI-03 | 2 items at `market_price` $0.50 and $5.00 | Portfolio value displays "$4.68" (0.425 + 4.25 = 4.675 → rounds to 4.68) | BLOCKING |
| AC-INV-UI-04 | Player clicks "Sell" on a card | Inline confirmation appears with "Sell for $[net_proceeds]?", Confirm and Cancel buttons; Sell button hidden | BLOCKING |
| AC-INV-UI-05 | Player clicks Cancel on sell confirmation | Confirmation hides; Sell button restored; no `sellItem()` called | BLOCKING |
| AC-INV-UI-06 | Player clicks Confirm on sell confirmation | Confirm button disabled immediately; `sellItem(instanceId, marketPrice)` called once; card removed from grid; portfolio value and count update | BLOCKING |
| AC-INV-UI-07 | `skin-inventory-changed` event fires while Inventory view is visible | Grid re-renders to reflect current `getItems()` | BLOCKING |
| AC-INV-UI-08 | Item card with `null` image URL | Card shows rarity-colored placeholder image; name, price, and Sell button still visible | BLOCKING |
| AC-INV-UI-09 | `sellItem()` returns false | Inline "Could not sell" error shown on the card; Sell button restored | BLOCKING |
| AC-INV-UI-10 | Inventory opened after 3 consecutive case opens | Cards sorted newest-first (most recently added item at top-left) | BLOCKING |
