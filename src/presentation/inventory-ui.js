import { SkinInventory }   from '../core/skin-inventory.js';
import { SkinImageLoader } from '../feature/skin-image-loader.js';
import { FloatService }    from '../foundation/float-service.js';
import { Events }          from '../foundation/events.js';

let _container          = null;
let _visible            = false;
let _dirty              = false; // re-render pending while view is hidden
let _activeMusicKitName = null;  // kit name currently playing in the YouTube player

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

    const countEl = _container.querySelector('.item-count');
    const gridEl  = _container.querySelector('.inventory-grid');
    const emptyEl = _container.querySelector('.inventory-empty');

    if (!gridEl) return;

    if (countEl) countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

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
    const item        = entry.item;
    const isMusicKit  = !item.weapon && typeof item.name === 'string' && (item.name.startsWith('Music Kit |') || item.name.startsWith('StatTrak™ Music Kit |'));
    const isSticker   = !item.weapon && !!item.name && !isMusicKit;
    const isStatTrak  = !!item.stat_trak;
    const salePrice   = item.market_price ?? 0;
    const net         = Math.round(salePrice * 0.85 * 100) / 100;
    const displayName = (isSticker || isMusicKit) ? item.name : _formatItemName(item.weapon, item.skin);

    const card = document.createElement('div');
    card.className = `inventory-card rarity-${item.rarity ?? 'unknown'}`;
    if (isMusicKit) card.classList.add('music-kit-card');

    let img;
    if (isSticker || isMusicKit) {
      img = document.createElement('img');
      img.src = item.image_url ?? '';
      img.onerror = () => { img.src = ''; img.className = 'card-image card-image--missing'; };
    } else {
      img = SkinImageLoader.getLazyImage(item.image_url ?? null, item.rarity);
    }
    img.className = 'card-image';
    img.alt       = displayName;

    if (isMusicKit) {
      const playIndicator = document.createElement('div');
      playIndicator.className = 'music-kit-playing';
      playIndicator.textContent = '♪';
      card.appendChild(playIndicator);

      card.dataset.kitName = item.name;
      card.dataset.youtubeId = item.youtube_id ?? '';

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-sell, .sell-confirm')) return;
        _toggleMusicKit(item.name, item.youtube_id ?? '');
      });

      // Reflect active state if already playing
      card.classList.toggle('is-playing', _activeMusicKitName === item.name);
    }

    const name = document.createElement('div');
    name.className = 'card-name';
    if (isStatTrak) {
      const stSpan = document.createElement('span');
      stSpan.className   = 'stat-trak-prefix';
      stSpan.textContent = 'StatTrak™ ';
      name.appendChild(stSpan);
      name.appendChild(document.createTextNode(displayName));
    } else {
      name.textContent = displayName;
    }

    // Float row: wear badge + float value (skins only — stickers have no float)
    const floatRow = document.createElement('div');
    floatRow.className = 'float-row';
    if (!isSticker && item.float != null) {
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
    if (isStatTrak) {
      const killsEl = document.createElement('div');
      killsEl.className   = 'stat-trak-kills';
      killsEl.textContent = '☆ 0 Kills';
      card.appendChild(killsEl);
    }
    card.appendChild(price);
    card.appendChild(sellBtn);
    card.appendChild(confirm);
    return card;
  },
};

function _closeMusicPlayer() {
  document.querySelector('.music-kit-modal')?.remove();
  _activeMusicKitName = null;
  document.querySelectorAll('.music-kit-card').forEach(c => c.classList.remove('is-playing'));
}

function _toggleMusicKit(kitName, youtubeId) {
  if (_activeMusicKitName === kitName) {
    _closeMusicPlayer();
    return;
  }

  // Remove any existing modal first
  document.querySelector('.music-kit-modal')?.remove();
  _activeMusicKitName = kitName;

  const displayName = kitName.replace(/^(StatTrak™ )?Music Kit \| /, '');

  // Backdrop
  const modal = document.createElement('div');
  modal.className = 'music-kit-modal';
  modal.addEventListener('click', (e) => {
    if (e.target === modal) _closeMusicPlayer();
  });

  // Dialog box
  const dialog = document.createElement('div');
  dialog.className = 'music-kit-dialog';

  const header = document.createElement('div');
  header.className = 'music-kit-dialog-header';

  const title = document.createElement('span');
  title.className   = 'music-kit-dialog-title';
  title.textContent = displayName;

  const closeBtn = document.createElement('button');
  closeBtn.className   = 'music-kit-dialog-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', _closeMusicPlayer);

  header.appendChild(title);
  header.appendChild(closeBtn);

  const iframe = document.createElement('iframe');
  iframe.className = 'music-kit-dialog-iframe';
  iframe.setAttribute('allow', 'autoplay; encrypted-media');
  iframe.setAttribute('allowfullscreen', '');
  iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;

  dialog.appendChild(header);
  dialog.appendChild(iframe);
  modal.appendChild(dialog);
  document.body.appendChild(modal);

  // Update card play states
  document.querySelectorAll('.music-kit-card').forEach(c => {
    c.classList.toggle('is-playing', c.dataset.kitName === kitName);
  });
}

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
