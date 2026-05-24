import { SkinInventory }   from '../core/skin-inventory.js';
import { SkinImageLoader } from '../feature/skin-image-loader.js';
import { FloatService }    from '../foundation/float-service.js';
import { Events }          from '../foundation/events.js';

let _container = null;
let _visible   = false;
let _dirty     = false; // re-render pending while view is hidden

/**
 * Grid view of the player's skin inventory with inline sell confirmation.
 * Listens for `skin-inventory-changed` to stay in sync.
 *
 * @example
 * InventoryUI.init(document.querySelector('.inventory-container'));
 */
export const InventoryUI = {
  /**
   * Mounts the inventory view into `container` and starts listening for events.
   * @param {HTMLElement} container
   */
  init(container) {
    _container = container;
    _visible   = false;

    container.innerHTML = `
      <div class="inventory-view">
        <div class="inventory-header">
          <span class="item-count">0 items</span>
          <span class="portfolio-value">Portfolio value: $0.00</span>
        </div>
        <div class="inventory-grid"></div>
        <div class="inventory-empty">No skins yet. Open some cases!</div>
      </div>
    `;

    document.addEventListener(Events.SKIN_INVENTORY_CHANGED, () => {
      if (_visible) this._render();
      else _dirty = true;
    });

    this._render();
  },

  show() {
    if (!_container) return;
    _visible = true;
    if (_dirty) { this._render(); _dirty = false; }
  },

  hide() {
    if (!_container) return;
    _visible = false;
  },

  _render() {
    if (!_container) return;
    const items = SkinInventory.getItems();

    const countEl    = _container.querySelector('.item-count');
    const valueEl    = _container.querySelector('.portfolio-value');
    const gridEl     = _container.querySelector('.inventory-grid');
    const emptyEl    = _container.querySelector('.inventory-empty');

    if (!gridEl) return;

    // Header
    const totalValue = items.reduce((sum, e) => sum + (e.item.market_price ?? 0), 0);
    if (countEl) countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
    if (valueEl) valueEl.textContent = `Portfolio value: $${totalValue.toFixed(2)}`;

    // Grid vs empty state
    if (items.length === 0) {
      gridEl.hidden  = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    gridEl.hidden  = false;
    if (emptyEl) emptyEl.hidden = true;

    gridEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach(entry => frag.appendChild(this._makeCard(entry)));
    gridEl.appendChild(frag);
  },

  _makeCard(entry) {
    const item       = entry.item;
    const salePrice  = item.market_price ?? 0;
    const net        = Math.round(salePrice * 0.85 * 100) / 100;
    const displayName = _formatItemName(item.weapon, item.skin);

    const card = document.createElement('div');
    card.className = `inventory-card rarity-${item.rarity ?? 'unknown'}`;

    const img     = SkinImageLoader.getImage(item.image_url ?? null, item.rarity);
    img.className = 'card-image';
    img.alt       = displayName;

    const name = document.createElement('div');
    name.className   = 'card-name';
    name.textContent = displayName;

    // Float row: wear badge + float value (only for items that have a float)
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

    const price = document.createElement('div');
    price.className   = 'card-price';
    price.textContent = `$${salePrice.toFixed(2)}`;

    const sellBtn = document.createElement('button');
    sellBtn.className   = 'btn-sell';
    sellBtn.textContent = 'Sell';

    const confirm = document.createElement('div');
    confirm.className = 'sell-confirm';
    confirm.hidden    = true;
    confirm.innerHTML = `
      <span>Sell for $${net.toFixed(2)}?</span>
      <button class="btn-confirm">Confirm</button>
      <button class="btn-cancel">Cancel</button>
    `;

    sellBtn.addEventListener('click', () => {
      sellBtn.hidden  = true;
      confirm.hidden  = false;
    });
    confirm.querySelector('.btn-cancel').addEventListener('click', () => {
      confirm.hidden  = true;
      sellBtn.hidden  = false;
    });
    confirm.querySelector('.btn-confirm').addEventListener('click', () => {
      const confirmBtn = confirm.querySelector('.btn-confirm');
      confirmBtn.disabled = true;
      try {
        const ok = SkinInventory.sellItem(entry.instanceId, salePrice);
        if (!ok) {
          confirm.querySelector('span').textContent = 'Could not sell.';
          confirmBtn.disabled = false;
        }
        // skin-inventory-changed fires → grid re-renders, removing this card
      } catch {
        confirm.querySelector('span').textContent = 'Could not sell.';
        confirmBtn.disabled = false;
      }
    });

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(floatRow);
    card.appendChild(price);
    card.appendChild(sellBtn);
    card.appendChild(confirm);
    return card;
  },
};

/**
 * Formats a skin name in standard CS2 display format.
 * Knives/gloves: skin field starts with ★ — reorder to "★ Weapon | Finish".
 * Vanilla knives: "★ Weapon" (no pipe).
 * Regular weapons: "Weapon | Skin".
 */
function _formatItemName(weapon, skin) {
  if (skin && skin.startsWith('★')) {
    const bare = skin.slice(1).trim();
    if (bare.toLowerCase() === 'vanilla') return `★ ${weapon}`;
    return `★ ${weapon} | ${bare}`;
  }
  return `${weapon} | ${skin}`;
}
