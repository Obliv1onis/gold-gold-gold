import { SkinInventory }       from '../core/skin-inventory.js';
import { StickerImageService }  from '../feature/sticker-image-service.js';
import { makePlaceholder }      from '../feature/item-placeholder.js';
import { i18n }                 from '../foundation/i18n.js';

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
    const displayName = i18n.itemName(item.market_hash_name ?? item.name, i18n.getLocale(), item.capsuleType);

    _overlay.innerHTML = '';

    const card = document.createElement('div');
    card.className = `reveal-card rarity-${rarity}`;

    let imgEl;
    if (item.image_url) {
      imgEl = document.createElement('img');
      imgEl.className = 'reveal-image';
      imgEl.alt       = displayName;
      imgEl.src       = item.image_url;
    } else {
      imgEl = makePlaceholder(item.name, 'reveal-size');
    }
    card.appendChild(imgEl);

    const rarityLabel = document.createElement('div');
    rarityLabel.className   = 'reveal-rarity-label';
    rarityLabel.textContent = i18n.rarityLabel(rarity);
    card.appendChild(rarityLabel);

    const typeLabel = document.createElement('div');
    typeLabel.className   = 'reveal-item-type';
    typeLabel.textContent = _itemTypeLabel(item);
    card.appendChild(typeLabel);

    const nameEl = document.createElement('div');
    nameEl.className   = 'reveal-item-name';
    nameEl.textContent = displayName;
    card.appendChild(nameEl);

    const capsuleEl = document.createElement('div');
    capsuleEl.className   = 'reveal-source';
    capsuleEl.textContent = i18n.caseName(item.capsuleName ?? '');
    card.appendChild(capsuleEl);

    const actions = document.createElement('div');
    actions.className = 'reveal-actions';

    const keepBtn = document.createElement('button');
    keepBtn.className   = 'btn-keep';
    keepBtn.textContent = i18n.t('keep');
    keepBtn.addEventListener('click', () => this.hide());

    const sellLabel = item.market_price != null
      ? i18n.t('sell_price', { price: `$${netProceed.toFixed(2)}` })
      : i18n.t('sell');
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
          const realImg = document.createElement('img');
          realImg.className = 'reveal-image';
          realImg.alt       = displayName;
          realImg.src       = url;
          imgEl.replaceWith(realImg);
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
      if (fb) fb.textContent = i18n.t('sold_for', { price: `$${net.toFixed(2)}` });
    } else {
      if (fb) fb.textContent = i18n.t('sell_not_found');
    }
    setTimeout(() => this.hide(), SELL_FEEDBACK_DURATION);
  },
};

function _itemTypeLabel(item) {
  const type = item.capsuleType ?? '';
  if (type === 'charm_capsule') return i18n.t('market_category_charms');
  if (type === 'patch_pack') return i18n.t('market_category_patches');
  if (type === 'pin_capsule') return i18n.t('market_category_pins');
  if (type === 'music_kit_box') return i18n.t('market_category_music');
  return i18n.t('market_category_stickers');
}

function _netProceeds(p) {
  return Math.round((typeof p === 'number' ? p : 0) * (1 - SELL_FEE_RATE) * 100) / 100;
}
