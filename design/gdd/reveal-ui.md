# Reveal UI

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-20
> **Implements Pillar**: Faithful Over Flashy · Zero Friction

## Overview

The Reveal UI is an overlay panel that appears over the reel the moment the selected item is delivered. It is triggered by the `onReveal(entry: InventorySkinEntry)` event from the Case Opening Orchestrator and displays the item the player just won: a full skin image, the item's name, its rarity tier with matching color glow, and the net sell price. The player has two choices: **Keep** (dismiss the overlay, item stays in inventory) or **Sell** (call `SkinInventory.sellItem()` to convert the item to balance, then dismiss).

The overlay appears on top of the reel without replacing it — the reel is visible behind and the selected item is still locked at center. When the player dismisses, the reel is back in full view, ready for the next open. The entire flow from reel-stop to overlay-dismiss can take under 2 seconds for experienced players who immediately click Keep and open again.

The Reveal UI does not own the reveal sound — `playReveal()` is called by the Orchestrator before `onReveal` fires. It receives the item already in inventory (`addItem()` has already run). Its only write-side action is the optional `sellItem()` call.

## Player Fantasy

The reveal is the emotional payoff of the entire case opening loop. The reel stops, the chord fires, and then — the overlay. That transition from reel to reveal is the moment. The item fills more of the screen: a larger image, the rarity glow around it, the name appearing. For a rare drop, the gold or red glow amplifies what the reel already showed. For a common drop, the clean, honest presentation of a blue-bordered item says "you got a blue — that's what it is."

The Keep / Sell decision is a micro-moment of engagement on top of the reveal. Players don't agonize long — they either know they want the skin (Keep) or they don't (Sell). Showing the net proceeds on the Sell button (`Sell ($X.XX)`) makes that decision instant: no math required, no need to check the market, just a yes or no. The balance ticking up after a Sell is its own small reward — recouping even partial cost from a common drop keeps the economic loop satisfying.

The overlay must disappear fast when dismissed. Zero Friction means the player who wants to open ten cases in a row should be able to click Keep or Sell and be back at the reel in under a second.

## Detailed Design

### Core Rules

1. **Trigger**: The Reveal UI is shown by the App Shell when `onReveal(entry: InventorySkinEntry)` fires from the Orchestrator. The App Shell passes the `entry` to the Reveal UI's `show(entry)` method.

2. **Overlay structure:**

```html
<div class="reveal-overlay">                          <!-- full-screen semi-transparent backdrop -->
  <div class="reveal-card rarity-[tier]">             <!-- rarity-colored border/glow -->
    <img class="reveal-image" />                      <!-- skin image from SkinImageLoader -->
    <div class="reveal-item-name">[Weapon | Skin]</div>
    <div class="reveal-rarity-label">[Rarity Tier]</div>
    <div class="reveal-actions">
      <button class="btn-keep">Keep</button>
      <button class="btn-sell">Sell ($[net_proceeds])</button>
    </div>
  </div>
</div>
```

3. **Image source**: `SkinImageLoader.getImage(entry.item.image_url, entry.item.rarity)` — synchronous, already preloaded from Reel UI's `initialize()` call.

4. **Net proceeds display**: `(entry.item.market_price * 0.85).toFixed(2)` displayed on the Sell button as `"Sell ($X.XX)"`. Uses `sell_fee_rate = 0.15` (registry constant).

5. **Keep action**: Hides the overlay. No state changes. Item stays in inventory.

6. **Sell action**:
   ```
   1. Disable Sell button immediately (prevent double-sell)
   2. result = SkinInventory.sellItem(entry.instanceId, entry.item.market_price)
   3a. if result === true:
         show "Sold for $[net_proceeds]!" feedback for SELL_FEEDBACK_DURATION_MS
         hide overlay
   3b. if result === false:
         show "Could not sell — item not found." feedback
         hide overlay
   ```

7. **Blocking overlay**: While visible, the overlay is `pointer-events: all` and covers the interface. The App Shell tracks overlay visibility and does not call `openCase()` while `revealVisible === true`.

8. **No auto-dismiss**: The overlay stays visible until the player explicitly clicks Keep or Sell. No timeout.

9. **Rarity glow**: CSS class `rarity-[tier]` applies a colored box-shadow matching the rarity. For `rare_special` items, glow radius is multiplied by `RARE_SPECIAL_GLOW_MULTIPLIER` (2×).

### States and Transitions

| State | Description | Entry |
|-------|-------------|-------|
| **Hidden** | Overlay not rendered | App load; after Keep or Sell |
| **Visible** | Overlay displayed | `show(entry)` called by App Shell |
| **Selling** | Sell button clicked; `sellItem()` in progress; button disabled | Player clicks Sell |

**Transitions:**
- `Hidden → Visible`: `show(entry)` called
- `Visible → Hidden`: Player clicks Keep
- `Visible → Selling`: Player clicks Sell
- `Selling → Hidden`: `sellItem()` resolves; feedback shown; overlay hides

### Interactions with Other Systems

| System | Direction | Interface | Notes |
|--------|-----------|-----------|-------|
| **Case Opening Orchestrator** (#9) | ↑ depends on | Listens for `onReveal(entry)` (routed via App Shell) | App Shell calls `show(entry)` on this event |
| **Skin Inventory** (#8) | ↑ depends on | `sellItem(instanceId, marketPrice)` | Called only if player clicks Sell |
| **Skin Image Loader** (#10) | ↑ depends on | `getImage(imageUrl, rarity)` | Synchronous; image already preloaded |
| **App Shell / HUD** (#11) | ↓ depended on by | — | App Shell shows/hides overlay and tracks reveal visibility for Open button blocking |

## Formulas

#### F1: Net Proceeds Display

```
display_net_proceeds = market_price * (1 - SELL_FEE_RATE)
display_net_proceeds = market_price * 0.85
```

Displayed on the Sell button as `"Sell ($[display_net_proceeds.toFixed(2)])"`. Matches the `net_proceeds` formula (registry, owned by Skin Inventory GDD). The same value is passed to `sellItem()` as `salePrice`.

| Variable | Value | Source |
|----------|-------|--------|
| `market_price` | `entry.item.market_price` | InventorySkinEntry → ItemEntry |
| `SELL_FEE_RATE` | 0.15 | Registry constant `sell_fee_rate` (owned by Skin Inventory GDD) |

## Edge Cases

**E1: `entry.item.market_price` is 0 or undefined**
*Handling*: Sell button shows `"Sell ($0.00)"`. Clicking Sell calls `sellItem(instanceId, 0)`, which throws `InventoryError`. Reveal UI catches this, shows "Could not sell — invalid price" feedback, then hides. Player retains the item.

**E2: `sellItem()` returns false (item already removed from inventory)**
*Handling*: Sell button shows "Could not sell — item not found" feedback; overlay hides.

**E3: Player double-clicks Sell**
*Handling*: Sell button is disabled immediately after the first click (Selling state). Only one `sellItem()` call is made per reveal.

**E4: `getImage()` returns a placeholder (image not loaded)**
*Handling*: Reveal card shows the rarity-colored placeholder. Name and rarity labels still display correctly. Keep and Sell still work.

**E5: Reveal shown for a `rare_special` item (knife/gloves)**
*Handling*: CSS class `rarity-rare_special` applies the gold glow at `RARE_SPECIAL_GLOW_MULTIPLIER` (2×) radius. No special logic beyond CSS.

**E6: Player opens the next case while Reveal overlay is visible**
*Handling*: The App Shell must not call `openCase()` while `revealVisible === true`. The overlay covers the interface physically (pointer-events), and the App Shell enforces this as a state guard.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Case Opening Orchestrator** (#9) | Supplies the won item entry via `onReveal` event | App Shell routes `onReveal(entry)` to `show(entry)` |
| **Skin Inventory** (#8) | Processes sell action | `sellItem(instanceId, marketPrice)` |
| **Skin Image Loader** (#10) | Provides skin image for the reveal card | `getImage(imageUrl, rarity)` — synchronous, already preloaded |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they rely on |
|--------|-----------------|------------------|
| **App Shell / HUD** (#11) | Tracks overlay state to block Open button | `show(entry)` and `hide()` methods; or `reveal-open`/`reveal-closed` DOM events |

## Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|------------|--------|
| `SELL_FEE_RATE` | 0.15 | Must match registry `sell_fee_rate` (0.15) | Affects net proceeds display and `sellItem()` call. Change only via registry — do not hardcode here. |
| `SELL_FEEDBACK_DURATION_MS` | 500ms | 200–1500ms | How long "Sold for $X.XX!" shows before overlay hides. Shorter = faster loop; longer = more satisfying feedback. |
| `RARE_SPECIAL_GLOW_MULTIPLIER` | 2× | 1–4× | Visual amplifier for glow shadow radius on `rare_special` items. |

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-RVL-01 | `show(entry)` called with a valid `InventorySkinEntry` | Reveal overlay appears; item name, rarity, and image are displayed | BLOCKING |
| AC-RVL-02 | Player clicks Keep | Overlay hides; item remains in Skin Inventory (no `sellItem()` called) | BLOCKING |
| AC-RVL-03 | Player clicks Sell | `sellItem(entry.instanceId, entry.item.market_price)` is called exactly once; feedback shown; overlay hides | BLOCKING |
| AC-RVL-04 | Sell button label for item with `market_price = 0.50` | Sell button reads `"Sell ($0.43)"` (0.50 × 0.85 = 0.425 → $0.43 rounded) | BLOCKING |
| AC-RVL-05 | Sell button label for item with `market_price = 7.77` | Sell button reads `"Sell ($6.60)"` (7.77 × 0.85 = 6.6045 → $6.60) | BLOCKING |
| AC-RVL-06 | Sell button clicked twice rapidly | `sellItem()` called exactly once; second click is no-op (button disabled) | BLOCKING |
| AC-RVL-07 | `sellItem()` returns false | "Could not sell — item not found" feedback shown; overlay hides | BLOCKING |
| AC-RVL-08 | Item with `null` image URL | Reveal card shows rarity-colored placeholder; name and rarity still visible | BLOCKING |
| AC-RVL-09 | Overlay visible | Open button blocked (overlay covers it or App Shell enforces guard) | BLOCKING |
| AC-RVL-10 | Reveal card for a covert item | Has class `rarity-covert`; visual glow matches `#EB4B4B` | ADVISORY |
