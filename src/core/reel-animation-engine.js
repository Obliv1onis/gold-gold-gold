import { CaseDataStore } from '../foundation/case-data-store.js';

export class ReelError extends Error {
  constructor(msg) { super(msg); this.name = 'ReelError'; }
}

export const CARD_WIDTH       = 250;
const STRIP_LENGTH     = 60;
const SELECTED_INDEX   = 55;
export const SPIN_DURATION_MS = 7800;
const PITCH_LOW        = 220;
const PITCH_HIGH       = 880;
const STOP_OFFSET_RANGE = 30; // px — random variance on final landing position

function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }

const TIERS            = ['consumer_grade', 'industrial_grade', 'mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];
const BACKGROUND_TIERS = ['consumer_grade', 'industrial_grade', 'mil_spec', 'restricted', 'classified', 'covert'];

// Background cards never show rare_special — weights re-normalised over non-rare tiers
// so that a gold passing by the crosshair cannot create false hope.
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

function _buildStrip(caseId, selectedItem) {
  const caseEntry = CaseDataStore.getCase(caseId);
  const weights = caseEntry?.rarity_weights ?? {};
  const strip = new Array(STRIP_LENGTH);
  strip[SELECTED_INDEX] = selectedItem;
  for (let i = 0; i < STRIP_LENGTH; i++) {
    if (i === SELECTED_INDEX) continue;
    const tier  = _pickBackgroundTier(weights);
    const items = CaseDataStore.getItems(caseId, tier);
    strip[i] = { ...items[Math.floor(Math.random() * items.length)], rarity: tier };
  }
  return strip;
}

let _state = 'idle'; // 'idle' | 'spinning'

export const ReelAnimationEngine = {
  CARD_WIDTH,
  SPIN_DURATION_MS,

  getState() { return _state; },

  spin(caseId, selectedItem, viewportWidth, callbacks, prebuiltStrip = null) {
    if (_state === 'spinning') throw new ReelError('Animation already in progress');

    if (!prebuiltStrip && !CaseDataStore.getCase(caseId))
      throw new ReelError(`Cannot build strip for case ${caseId}: no items`);

    const strip      = prebuiltStrip ?? _buildStrip(caseId, selectedItem);
    const stopOffset = (Math.random() * STOP_OFFSET_RANGE * 2) - STOP_OFFSET_RANGE;
    const targetOffset = (SELECTED_INDEX * CARD_WIDTH)
                        - (viewportWidth / 2 - CARD_WIDTH / 2)
                        + stopOffset;

    _state = 'spinning';

    const { onFrame, onTick, onComplete } = callbacks;

    let startTime    = null;
    let prevTime     = null;
    let prevOffset   = 0;
    let lastTickCard = 0;

    function frame(now) {
      if (startTime === null) { startTime = now; prevTime = now; }

      const elapsed       = Math.min(now - startTime, SPIN_DURATION_MS);
      const t             = elapsed / SPIN_DURATION_MS;
      const currentOffset = easeOutQuint(t) * targetOffset;

      // Tick detection — fires each time a card boundary is crossed
      const frameDeltaMs  = now - prevTime;
      const cardsCrossed  = Math.floor(currentOffset / CARD_WIDTH);
      if (cardsCrossed > lastTickCard) {
        let pitch = PITCH_LOW;
        if (frameDeltaMs > 0) {
          const velocity    = (currentOffset - prevOffset) / (frameDeltaMs / 1000);
          const maxVelocity = (targetOffset / (SPIN_DURATION_MS / 1000)) * 5;
          const norm        = Math.min(Math.max(velocity / maxVelocity, 0), 1);
          pitch             = PITCH_LOW + norm * (PITCH_HIGH - PITCH_LOW);
        }
        onTick(pitch);
        lastTickCard = cardsCrossed;
      }

      onFrame(currentOffset, strip);

      prevOffset = currentOffset;
      prevTime   = now;

      if (t >= 1) {
        _state = 'idle';
        onComplete();
        return;
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  },
};
