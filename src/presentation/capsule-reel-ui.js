import { Events }          from '../foundation/events.js';
import { CapsuleDataStore }  from '../foundation/capsule-data-store.js';
import { makePlaceholder }   from '../feature/item-placeholder.js';
import { i18n }              from '../foundation/i18n.js';
import { visualRarity }      from '../foundation/visual-rarity.js';

const CARD_WIDTH_PX     = 250;
const IDLE_CENTER_INDEX = 30;
const VIEWPORT_FALLBACK = 800;
const PREVIEW_TRANSITION_MS = 420;
const PREVIEW_RARITIES = ['high_grade', 'remarkable', 'exotic', 'extraordinary'];

let _container         = null;
let _viewport          = null;
let _strip             = null;
let _preview           = null;
let _rollStage         = null;
let _transitionPromise = null;
let _spinActive        = false;

/**
 * DOM rendering layer for the capsule opening reel animation.
 * Call `initialize(container, capsuleId)` once on capsule select, then pass
 * `CapsuleReelUI.render` as the `onFrame` callback to the Orchestrator.
 *
 * @example
 * CapsuleReelUI.initialize(reelContainer, 'austin_2025_legends_sticker');
 * // Later, in Orchestrator callbacks:
 * CapsuleOpeningOrchestrator.open(capsuleId, price, CapsuleReelUI.viewportWidth, {
 *   onFrame: (offset, strip) => CapsuleReelUI.render(offset, strip),
 *   ...
 * });
 */
export const CapsuleReelUI = {
  get viewportWidth() {
    return _viewport?.offsetWidth || VIEWPORT_FALLBACK;
  },

  initialize(container, capsuleId) {
    _container = container;
    _spinActive = false;
    _transitionPromise = null;
    container.classList.remove('is-roll-mode');

    container.innerHTML = `
      <section class="case-opening-preview" aria-live="polite"></section>
      <div class="reel-roll-stage" aria-hidden="true">
        <div class="reel-viewport">
          <div class="reel-strip"></div>
          <div class="reel-center-marker"></div>
        </div>
      </div>
    `;
    _preview  = container.querySelector('.case-opening-preview');
    _rollStage = container.querySelector('.reel-roll-stage');
    _viewport = container.querySelector('.reel-viewport');
    _strip    = container.querySelector('.reel-strip');

    _buildCapsulePreview(capsuleId);
    _buildIdleStrip(capsuleId);

    document.dispatchEvent(new CustomEvent(Events.REEL_READY, { detail: { capsuleId } }));
  },

  transitionToRoll() {
    if (!_container || !_rollStage || _container.classList.contains('is-roll-mode')) {
      return Promise.resolve();
    }
    if (_transitionPromise) return _transitionPromise;

    _rollStage.setAttribute('aria-hidden', 'false');
    _transitionPromise = new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        _container.classList.add('is-roll-mode');
      }));
      setTimeout(() => {
        if (_preview) _preview.setAttribute('aria-hidden', 'true');
        _transitionPromise = null;
        resolve();
      }, PREVIEW_TRANSITION_MS);
    });
    return _transitionPromise;
  },

  returnToPreview() {
    if (!_container || !_preview || !_rollStage) return;
    _preview.setAttribute('aria-hidden', 'false');
    _rollStage.setAttribute('aria-hidden', 'true');
    _container.classList.remove('is-roll-mode');
  },

  render(offset, strip) {
    if (!_strip) return;

    if (!_spinActive) {
      _spinActive = true;
      _buildCards(strip);
    }

    _strip.style.transform = `translateX(-${offset}px)`;
  },

  resetSpin() {
    _spinActive = false;
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _buildCards(strip) {
  _strip.innerHTML = '';
  const frag = document.createDocumentFragment();
  strip.forEach(item => frag.appendChild(_makeCard(item)));
  _strip.appendChild(frag);
}

function _buildCapsulePreview(capsuleId) {
  if (!_preview) return;
  const capsule = CapsuleDataStore.getCapsule(capsuleId);
  if (!capsule) return;

  _preview.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = 'case-opening-hero';
  if (capsule.image_url) {
    const image = document.createElement('img');
    image.className = 'case-opening-hero__image';
    image.src = capsule.image_url;
    image.alt = i18n.caseName(capsule.name ?? '');
    hero.appendChild(image);
  }
  const title = document.createElement('h1');
  title.className = 'case-opening-hero__title';
  title.textContent = i18n.caseName(capsule.name ?? '');
  hero.appendChild(title);

  const contents = document.createElement('section');
  contents.className = 'case-contents-preview';
  const heading = document.createElement('h2');
  heading.className = 'case-contents-preview__title';
  heading.textContent = i18n.t('case_contents');
  contents.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'case-contents-grid';
  for (const rarity of PREVIEW_RARITIES) {
    const items = capsule.tiers?.[rarity] ?? [];
    [...items]
      .sort((a, b) => _itemName(a, capsule.type).localeCompare(_itemName(b, capsule.type), i18n.getLocale()))
      .forEach(item => grid.appendChild(_makePreviewCard(item, rarity, capsule.type)));
  }
  contents.appendChild(grid);
  _preview.append(hero, contents);
}

function _makePreviewCard(item, rarity, capsuleType) {
  const displayItem = { ...item, rarity, capsuleType: capsuleType ?? 'sticker_capsule' };
  const card = document.createElement('article');
  card.className = `case-content-card rarity-${visualRarity(displayItem, rarity)}`;

  let image;
  if (item.image_url) {
    image = document.createElement('img');
    image.src = item.image_url;
    image.alt = _itemName(item, capsuleType);
  } else {
    image = makePlaceholder(item.name ?? '', 'card-size');
  }
  image.classList.add('case-content-card__image');

  const name = document.createElement('span');
  name.className = 'case-content-card__name';
  name.textContent = _itemName(item, capsuleType);

  const rarityLabel = document.createElement('span');
  rarityLabel.className = 'case-content-card__rarity';
  rarityLabel.textContent = i18n.rarityLabel(rarity);
  card.append(image, name, rarityLabel);
  return card;
}

function _itemName(item, capsuleType) {
  return i18n.itemName(
    item.market_hash_name ?? item.name ?? '',
    i18n.getLocale(),
    capsuleType ?? 'sticker_capsule',
  );
}

const BACKGROUND_TIERS = ['high_grade', 'remarkable', 'exotic'];

function _pickBackgroundTier(weights) {
  const total = BACKGROUND_TIERS.reduce((sum, t) => sum + (weights[t] ?? 0), 0);
  if (total === 0) return BACKGROUND_TIERS[0];
  const r = Math.random();
  let cumulative = 0;
  for (const tier of BACKGROUND_TIERS) {
    cumulative += (weights[tier] ?? 0) / total;
    if (r < cumulative) return tier;
  }
  return BACKGROUND_TIERS[BACKGROUND_TIERS.length - 1];
}

function _buildIdleStrip(capsuleId) {
  const capsule = CapsuleDataStore.getCapsule(capsuleId);
  if (!capsule) return;
  const weights = capsule.rarity_weights ?? {};

  const strip = [];
  for (let i = 0; i < 60; i++) {
    const tier  = _pickBackgroundTier(weights);
    const pool  = capsule.tiers?.[tier] ?? [];
    if (pool.length > 0) strip.push({
      ...pool[Math.floor(Math.random() * pool.length)],
      rarity: tier,
      capsuleType: capsule.type ?? 'sticker_capsule',
    });
  }
  if (!strip.length) return;

  _buildCards(strip);
  _strip.style.transform = `translateX(-${IDLE_CENTER_INDEX * CARD_WIDTH_PX}px)`;
}

function _makeCard(item) {
  const div = document.createElement('div');
  div.className = `reel-card rarity-${visualRarity(item, 'high_grade')}`;

  if (item.image_url) {
    const img = document.createElement('img');
    img.className = 'card-image';
    img.alt = item.name ?? '';
    img.src = item.image_url;
    div.appendChild(img);
  } else {
    div.appendChild(makePlaceholder(item.name ?? '', 'reel-size'));
  }

  const name = document.createElement('span');
  name.className   = 'card-name';
  name.textContent = i18n.itemName(
    item.market_hash_name ?? item.name ?? '',
    i18n.getLocale(),
    item.capsuleType,
  );

  div.appendChild(name);
  return div;
}
