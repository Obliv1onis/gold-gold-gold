import { SkinImageLoader } from '../feature/skin-image-loader.js';
import { SkinInventory }   from '../core/skin-inventory.js';
import { FloatService }    from '../foundation/float-service.js';

const SELL_FEE_RATE           = 0.15;
const SELL_FEEDBACK_DURATION  = 1800; // ms — "Sold!" message display time

let _overlay   = null;
let _visible   = false;
let _onDismiss = null; // callback fired when overlay hides (Keep or post-Sell)

/**
 * Full-screen overlay shown when a case open completes.
 * App Shell calls `show(entry)` on the `onReveal` Orchestrator callback.
 *
 * @example
 * RevealUI.init(document.getElementById('app'), () => HudAppShell.onRevealDismissed());
 * // In Orchestrator callback:
 * onReveal: (entry) => RevealUI.show(entry),
 */
export const RevealUI = {
  get isVisible() { return _visible; },

  /**
   * Creates the overlay element and appends it to `container` (hidden).
   * @param {HTMLElement} container
   * @param {function}    [onDismiss] - called when overlay hides
   */
  init(container, onDismiss) {
    _onDismiss = onDismiss ?? null;
    _overlay   = document.createElement('div');
    _overlay.className = 'reveal-overlay';
    _overlay.setAttribute('hidden', '');
    container.appendChild(_overlay);
  },

  /**
   * Populates and displays the overlay with the won item.
   * @param {object} entry - InventorySkinEntry from SkinInventory.addItem()
   */
  show(entry) {
    if (!_overlay) return;
    _visible = true;

    const item        = entry.item;
    const netProceeds = _netProceeds(item.market_price);
    const displayName = _formatItemName(item.weapon, item.skin);
    const img         = SkinImageLoader.getImage(item.image_url ?? null, item.rarity);
    img.className     = 'reveal-image';
    img.alt           = displayName;

    _overlay.innerHTML = '';
    const card = document.createElement('div');
    card.className = `reveal-card rarity-${item.rarity ?? 'unknown'}`;

    const rarityLabel = document.createElement('div');
    rarityLabel.className = 'reveal-rarity-label';
    rarityLabel.textContent = _formatRarity(item.rarity);

    // Float row: wear badge + float value
    const floatRow = document.createElement('div');
    floatRow.className = 'float-row';
    if (item.float != null) {
      const wearTier = item.wear_tier ?? FloatService.getWearTier(item.float);
      const wearBadge = document.createElement('span');
      wearBadge.className = `wear-badge wear-${wearTier}`;
      wearBadge.textContent = FloatService.getWearLabel(wearTier);
      const floatVal = document.createElement('span');
      floatVal.className = 'float-value';
      floatVal.textContent = FloatService.formatFloat(item.float);
      floatRow.appendChild(wearBadge);
      floatRow.appendChild(floatVal);
    }

    const nameEl = document.createElement('div');
    nameEl.className   = 'reveal-item-name';
    nameEl.textContent = displayName;

    const actions = document.createElement('div');
    actions.className = 'reveal-actions';

    const keepBtn = document.createElement('button');
    keepBtn.className   = 'btn-keep';
    keepBtn.textContent = 'Keep';
    keepBtn.addEventListener('click', () => this.hide());

    const sellBtn = document.createElement('button');
    sellBtn.className   = 'btn-sell';
    sellBtn.textContent = `Sell ($${netProceeds.toFixed(2)})`;
    sellBtn.addEventListener('click', () => this._handleSell(entry, sellBtn));

    const feedback = document.createElement('div');
    feedback.className = 'reveal-feedback';

    actions.appendChild(keepBtn);
    actions.appendChild(sellBtn);
    card.appendChild(img);
    card.appendChild(rarityLabel);
    card.appendChild(floatRow);
    card.appendChild(nameEl);
    card.appendChild(actions);
    card.appendChild(feedback);
    _overlay.appendChild(card);

    _overlay.removeAttribute('hidden');
    // store feedback ref for sell handler
    _overlay._feedbackEl = feedback;
  },

  /** Hides the overlay and fires onDismiss. */
  hide() {
    if (!_overlay) return;
    _overlay.setAttribute('hidden', '');
    _visible = false;
    _onDismiss?.();
  },

  _handleSell(entry, sellBtn) {
    sellBtn.disabled = true; // prevent double-sell (E: blocking overlay)
    const item    = entry.item;
    const price   = item.market_price ?? 0;
    const net     = _netProceeds(price);
    const result  = SkinInventory.sellItem(entry.instanceId, price);
    const feedback = _overlay?._feedbackEl;

    if (result) {
      if (feedback) feedback.textContent = `Sold for $${net.toFixed(2)}!`;
      setTimeout(() => this.hide(), SELL_FEEDBACK_DURATION);
    } else {
      if (feedback) feedback.textContent = 'Could not sell — item not found.';
      setTimeout(() => this.hide(), SELL_FEEDBACK_DURATION);
    }
  },
};

function _netProceeds(marketPrice) {
  const p = typeof marketPrice === 'number' ? marketPrice : 0;
  return Math.round(p * (1 - SELL_FEE_RATE) * 100) / 100;
}

function _formatRarity(rarity) {
  if (!rarity) return '';
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function _formatItemName(weapon, skin) {
  if (skin && skin.startsWith('★')) {
    const bare = skin.slice(1).trim();
    if (bare.toLowerCase() === 'vanilla') return `★ ${weapon}`;
    return `★ ${weapon} | ${bare}`;
  }
  return `${weapon} | ${skin}`;
}
