import { SkinImageLoader } from '../feature/skin-image-loader.js';
import { Events }          from '../foundation/events.js';
import { CaseDataStore }   from '../foundation/case-data-store.js';

const CARD_WIDTH_PX      = 250;
const IDLE_CENTER_INDEX  = 30;
const VIEWPORT_FALLBACK  = 800; // px — used when container is not in DOM (E4)

let _container  = null;  // outer element passed to initialize()
let _viewport   = null;  // .reel-viewport element
let _strip      = null;  // .reel-strip element
let _spinActive = false; // true from first render() call until next initialize()

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

    container.innerHTML = `
      <div class="reel-viewport">
        <div class="reel-strip"></div>
        <div class="reel-center-marker"></div>
      </div>
    `;
    _viewport = container.querySelector('.reel-viewport');
    _strip    = container.querySelector('.reel-strip');

    await SkinImageLoader.preloadCase(caseId);

    // Build idle strip using all items from the image loader cache
    // (items array already available via SkinImageLoader internals — we
    // rebuild from CaseDataStore via the loader's getAllItems reference)
    _buildIdleStrip(caseId);

    document.dispatchEvent(new CustomEvent(Events.REEL_READY, { detail: { caseId } }));
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
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _buildCards(strip) {
  _strip.innerHTML = '';
  const frag = document.createDocumentFragment();
  strip.forEach(item => frag.appendChild(_makeCard(item)));
  _strip.appendChild(frag);
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

  const img = SkinImageLoader.getImage(item.image_url ?? null, item.rarity);
  img.className = 'card-image';
  img.alt = `${item.weapon} | ${item.skin}`;

  const name = document.createElement('span');
  name.className  = 'card-name';
  name.textContent = `${item.weapon} | ${item.skin}`;

  div.appendChild(img);
  div.appendChild(name);
  return div;
}

