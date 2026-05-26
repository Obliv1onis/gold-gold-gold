import { SkinInventory }       from '../core/skin-inventory.js';
import { StickerImageService } from '../feature/sticker-image-service.js';

const SELL_FEE_RATE          = 0.15;
const SELL_FEEDBACK_DURATION = 1800;

let _overlay   = null;
let _visible   = false;
let _onDismiss = null;

export const CapsuleRevealUI = {
  get isVisible() { return _visible; },

  init(container, onDismiss) {
    _onDismiss = onDismiss ?? null;
    _overlay   = document.createElement('div');
    _overlay.className = 'reveal-overlay';
    _overlay.setAttribute('hidden', '');
    container.appendChild(_overlay);
  },

  show(entry) {
    if (!_overlay) return;
    _visible = true;

    const item       = entry.item;
    const rarity     = item.rarity ?? 'high_grade';
    const netProceed = _netProceeds(item.market_price);

    _overlay.innerHTML = '';

    const card = document.createElement('div');
    card.className = `reveal-card rarity-${rarity}`;

    const img = document.createElement('img');
    img.className = 'reveal-image';
    img.alt       = item.name;
    if (item.image_url) {
      img.src           = item.image_url;
      img.style.opacity = '1';
    } else {
      img.src           = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
      img.style.opacity = '0.4';
    }
    card.appendChild(img);

    const rarityLabel = document.createElement('div');
    rarityLabel.className   = 'reveal-rarity-label';
    rarityLabel.textContent = _formatRarity(rarity);
    card.appendChild(rarityLabel);

    const typeLabel = document.createElement('div');
    typeLabel.className   = 'reveal-item-type';
    typeLabel.textContent = 'Sticker';
    card.appendChild(typeLabel);

    const nameEl = document.createElement('div');
    nameEl.className   = 'reveal-item-name';
    nameEl.textContent = item.name;
    card.appendChild(nameEl);

    const capsuleEl = document.createElement('div');
    capsuleEl.className   = 'reveal-source';
    capsuleEl.textContent = item.capsuleName ?? '';
    card.appendChild(capsuleEl);

    const actions = document.createElement('div');
    actions.className = 'reveal-actions';

    const keepBtn = document.createElement('button');
    keepBtn.className   = 'btn-keep';
    keepBtn.textContent = 'Keep';
    keepBtn.addEventListener('click', () => this.hide());

    const sellLabel = item.market_price != null
      ? `Sell ($${netProceed.toFixed(2)})`
      : 'Sell';
    const sellBtn = document.createElement('button');
    sellBtn.className   = 'btn-sell';
    sellBtn.textContent = sellLabel;
    sellBtn.addEventListener('click', () => this._handleSell(entry, sellBtn));

    const feedback = document.createElement('div');
    feedback.className = 'reveal-feedback';

    actions.appendChild(keepBtn);
    actions.appendChild(sellBtn);
    card.appendChild(actions);
    card.appendChild(feedback);

    _overlay.appendChild(card);
    _overlay._feedbackEl = feedback;
    _overlay.removeAttribute('hidden');

    // If no baked image, try Steam API as fallback
    if (!item.image_url) {
      StickerImageService.getImageUrl(item.market_hash_name).then(url => {
        if (url && _visible) {
          img.src           = url;
          img.style.opacity = '1';
        }
      });
    }
  },

  hide() {
    if (!_overlay) return;
    _overlay.setAttribute('hidden', '');
    _visible = false;
    _onDismiss?.();
  },

  _handleSell(entry, sellBtn) {
    sellBtn.disabled = true;
    const item   = entry.item;
    const price  = item.market_price ?? 0;
    const net    = _netProceeds(price);
    const result = SkinInventory.sellItem(entry.instanceId, price);
    const fb     = _overlay?._feedbackEl;
    if (result) {
      if (fb) fb.textContent = `Sold for $${net.toFixed(2)}!`;
    } else {
      if (fb) fb.textContent = 'Could not sell — item not found.';
    }
    setTimeout(() => this.hide(), SELL_FEEDBACK_DURATION);
  },
};

function _netProceeds(p) {
  return Math.round((typeof p === 'number' ? p : 0) * (1 - SELL_FEE_RATE) * 100) / 100;
}

function _formatRarity(rarity) {
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
