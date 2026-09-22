import { SkinImageLoader } from '../feature/skin-image-loader.js';
import { Events }          from '../foundation/events.js';
import { CaseDataStore }   from '../foundation/case-data-store.js';
import { i18n }            from '../foundation/i18n.js';
import rareMaskUrl         from '../gold.png';

const CARD_WIDTH_PX      = 250;
const IDLE_CENTER_INDEX  = 30;
const VIEWPORT_FALLBACK  = 800; // px — used when container is not in DOM (E4)
const PREVIEW_TRANSITION_MS = 420;
const PREVIEW_RARITIES = [
  'consumer_grade', 'industrial_grade', 'mil_spec', 'restricted',
  'classified', 'covert', 'rare_special',
];

let _container        = null;  // outer element passed to initialize()
let _viewport         = null;  // .reel-viewport element
let _strip            = null;  // .reel-strip element
let _preview          = null;  // pre-opening case and contents panel
let _rollStage        = null;  // reel panel revealed after Open is clicked
let _transitionPromise = null;
let _spinActive       = false; // true from first render() call until next initialize()
let _rareWinningCard  = null;  // DOM card element for a rare_special winning item

/**
 * DOM rendering layer for the case opening reel animation.
 * Call `initialize(container, caseId)` once on startup, then pass
 * `ReelUI.render` as the `onFrame` callback to the Orchestrator.
 *
 * @example
 * await ReelUI.initialize(document.querySelector('.reel-container'), 'recoil_case');
 * // Later, in Orchestrator callbacks:
 * CaseOpeningOrchestrator.open(caseId, price, ReelUI.viewportWidth, {
 *   onFrame: (offset, strip) => ReelUI.render(offset, strip),
 *   ...
 * });
 */
export const ReelUI = {
  /** Width of the reel viewport element in px (fallback 800px when not in DOM). */
  get viewportWidth() {
    return _viewport?.offsetWidth || VIEWPORT_FALLBACK;
  },

  /**
   * Preloads all images for the case, builds the static strip, and emits
   * `reel-ready` when complete. Must be awaited before the Open button is enabled.
   *
   * @param {HTMLElement} container - Element that will hold the reel DOM
   * @param {string} caseId
   */
  async initialize(container, caseId) {
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

    await SkinImageLoader.preloadCase(caseId);
    _buildCasePreview(caseId);

    // Build idle strip using all items from the image loader cache
    // (items array already available via SkinImageLoader internals — we
    // rebuild from CaseDataStore via the loader's getAllItems reference)
    _buildIdleStrip(caseId);

    document.dispatchEvent(new CustomEvent(Events.REEL_READY, { detail: { caseId } }));
  },

  /** Smoothly replaces the case contents preview with the roll viewport. */
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

  /** Restores the case and contents preview after the result is revealed. */
  returnToPreview() {
    if (!_container || !_preview || !_rollStage) return;
    _preview.setAttribute('aria-hidden', 'false');
    _rollStage.setAttribute('aria-hidden', 'true');
    _container.classList.remove('is-roll-mode');
  },

  /**
   * Per-frame callback wired via Orchestrator into ReelAnimationEngine.spin().
   * On the first call of a spin, rebuilds card DOM elements.
   * On subsequent calls, updates the CSS transform only.
   *
   * @param {number} offset - px to translate the strip left
   * @param {Array}  strip  - 60-item array of ItemEntry objects
   */
  render(offset, strip) {
    if (!_strip) return;

    if (!_spinActive) {
      _spinActive = true;
      _buildCards(strip);
    }

    _strip.style.transform = `translateX(-${offset}px)`;
  },

  /** Resets internal spin state so the next open rebuilds cards. */
  resetSpin() {
    _spinActive = false;
    _rareWinningCard = null;
  },

  /**
   * Swaps the masked rare-special card with the actual item visuals.
   * Called by the orchestrator when the reveal overlay appears.
   *
   * @param {object} item - InventorySkinEntry with image_url, weapon, skin
   */
  revealRareCard(item) {
    if (!_rareWinningCard) return;
    const imgEl  = _rareWinningCard.querySelector('.card-image');
    const nameEl = _rareWinningCard.querySelector('.card-name');
    if (imgEl)  {
      imgEl.src = item.image_url ?? '';
      imgEl.alt = i18n.skinName(item.weapon, item.skin);
      imgEl.classList.remove('rare-special-mask');
    }
    if (nameEl) nameEl.textContent = i18n.skinName(item.weapon, item.skin);
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _buildCards(strip) {
  _strip.innerHTML = '';
  const frag = document.createDocumentFragment();
  strip.forEach(item => frag.appendChild(_makeCard(item)));
  _strip.appendChild(frag);
}

function _buildCasePreview(caseId) {
  if (!_preview) return;
  const caseEntry = CaseDataStore.getCase(caseId);
  if (!caseEntry) return;

  _preview.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = 'case-opening-hero';
  if (caseEntry.image_url) {
    const image = document.createElement('img');
    image.className = 'case-opening-hero__image';
    image.src = caseEntry.image_url;
    image.alt = i18n.caseName(caseEntry.name ?? '');
    hero.appendChild(image);
  }
  const title = document.createElement('h1');
  title.className = 'case-opening-hero__title';
  title.textContent = i18n.caseName(caseEntry.name ?? '');
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
    const items = CaseDataStore.getItems(caseId, rarity);
    if (!items.length) continue;
    if (rarity === 'rare_special') {
      grid.appendChild(_makePreviewCard(null, rarity));
      continue;
    }
    [...items]
      .sort((a, b) => i18n.skinName(a.weapon, a.skin).localeCompare(i18n.skinName(b.weapon, b.skin), i18n.getLocale()))
      .forEach(item => grid.appendChild(_makePreviewCard(item, rarity)));
  }
  contents.appendChild(grid);
  _preview.append(hero, contents);
}

function _makePreviewCard(item, rarity) {
  const card = document.createElement('article');
  card.className = `case-content-card rarity-${rarity}`;

  let image;
  if (rarity === 'rare_special') {
    image = document.createElement('img');
    image.src = rareMaskUrl;
    image.alt = i18n.t('rare_special_label');
    image.className = 'case-content-card__image rare-special-mask';
  } else {
    image = SkinImageLoader.getImage(item?.image_url ?? null, rarity);
    image.className = 'case-content-card__image';
    image.alt = i18n.skinName(item.weapon, item.skin);
  }

  const name = document.createElement('span');
  name.className = 'case-content-card__name';
  name.textContent = rarity === 'rare_special'
    ? i18n.t('rare_special_label')
    : i18n.skinName(item.weapon, item.skin);

  const rarityLabel = document.createElement('span');
  rarityLabel.className = 'case-content-card__rarity';
  rarityLabel.textContent = i18n.rarityLabel(rarity);
  card.append(image, name, rarityLabel);
  return card;
}

const BACKGROUND_TIERS = ['mil_spec', 'restricted', 'classified', 'covert'];

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

function _buildIdleStrip(caseId) {
  const caseEntry = CaseDataStore.getCase(caseId);
  if (!caseEntry) return;
  const weights = caseEntry.rarity_weights ?? {};

  const strip = [];
  for (let i = 0; i < 60; i++) {
    const tier  = _pickBackgroundTier(weights);
    const items = CaseDataStore.getItems(caseId, tier);
    if (items.length > 0) strip.push({ ...items[Math.floor(Math.random() * items.length)], rarity: tier });
  }
  if (!strip.length) return;

  _buildCards(strip);
  const idleOffset = IDLE_CENTER_INDEX * CARD_WIDTH_PX;
  _strip.style.transform = `translateX(-${idleOffset}px)`;
}

function _makeCard(item) {
  const div = document.createElement('div');
  div.className = `reel-card rarity-${item.rarity ?? 'unknown'}`;

  const isRare = item.rarity === 'rare_special';

  let img;
  if (isRare) {
    img = document.createElement('img');
    img.src = rareMaskUrl;
    img.alt = 'Rare Special Item';
  } else {
    img = SkinImageLoader.getImage(item.image_url ?? null, item.rarity);
  }
  img.className = 'card-image';
  if (isRare) img.classList.add('rare-special-mask');

  const name = document.createElement('span');
  name.className   = 'card-name';
  name.textContent = isRare ? i18n.t('rare_special_label') : i18n.skinName(item.weapon, item.skin);

  div.appendChild(img);
  div.appendChild(name);

  if (isRare) _rareWinningCard = div;

  return div;
}
