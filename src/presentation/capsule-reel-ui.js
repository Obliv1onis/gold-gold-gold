import { Events }          from '../foundation/events.js';
import { CapsuleDataStore } from '../foundation/capsule-data-store.js';

const CARD_WIDTH_PX     = 250;
const IDLE_CENTER_INDEX = 30;
const VIEWPORT_FALLBACK = 800;

let _container  = null;
let _viewport   = null;
let _strip      = null;
let _spinActive = false;

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

    container.innerHTML = `
      <div class="reel-viewport">
        <div class="reel-strip"></div>
        <div class="reel-center-marker"></div>
      </div>
    `;
    _viewport = container.querySelector('.reel-viewport');
    _strip    = container.querySelector('.reel-strip');

    _buildIdleStrip(capsuleId);

    document.dispatchEvent(new CustomEvent(Events.REEL_READY, { detail: { capsuleId } }));
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
    if (pool.length > 0) strip.push({ ...pool[Math.floor(Math.random() * pool.length)], rarity: tier });
  }
  if (!strip.length) return;

  _buildCards(strip);
  _strip.style.transform = `translateX(-${IDLE_CENTER_INDEX * CARD_WIDTH_PX}px)`;
}

function _makeCard(item) {
  const div = document.createElement('div');
  div.className = `reel-card rarity-${item.rarity ?? 'high_grade'}`;

  const img = document.createElement('img');
  img.className = 'card-image';
  img.alt = item.name ?? '';
  if (item.image_url) {
    img.src = item.image_url;
  } else {
    img.src = '';
    img.style.opacity = '0.3';
  }

  const name = document.createElement('span');
  name.className   = 'card-name';
  name.textContent = item.name ?? item.market_hash_name ?? '';

  div.appendChild(img);
  div.appendChild(name);
  return div;
}
