import { VirtualEconomy }       from './virtual-economy.js';
import { CaseInventory }         from './case-inventory.js';
import { SkinInventory }         from './skin-inventory.js';
import { CapsuleEngine }         from './capsule-engine.js';
import { CapsuleDataStore }      from '../foundation/capsule-data-store.js';
import { ReelAnimationEngine }   from './reel-animation-engine.js';
import { AudioSystem }           from './audio-system.js';

export const CHORD_DECAY_MS = 800;

const STRIP_LENGTH    = 60;
const SELECTED_INDEX  = 55;

let _isAnimating = false;

/**
 * Orchestrates a full capsule open: validate → roll → spend → animate → reveal.
 *
 * @example
 * CapsuleOpeningOrchestrator.open('austin_2025_legends_sticker', 0.27, reelWidth, {
 *   onFrame:   (offset, strip) => CapsuleReelUI.render(offset, strip),
 *   onReveal:  (entry)         => CapsuleRevealUI.show(entry),
 *   onBlocked: (reason)        => HudAppShell.onBlocked(reason),
 *   onReady:   ()              => { CapsuleReelUI.resetSpin(); HudAppShell.onReady(); },
 * });
 */
export const CapsuleOpeningOrchestrator = {
  get isAnimating() { return _isAnimating; },

  open(capsuleId, capsulePrice, viewportWidth, callbacks) {
    const {
      onFrame   = () => {},
      onReveal  = () => {},
      onBlocked = () => {},
      onReady   = () => {},
    } = callbacks ?? {};

    if (_isAnimating) return;

    if (!CaseInventory.hasCase(capsuleId)) { onBlocked('no_case'); return; }
    if (!VirtualEconomy.canAfford(capsulePrice)) { onBlocked('insufficient_funds'); return; }

    let rollResult;
    try {
      rollResult = CapsuleEngine.roll(capsuleId);
    } catch (err) {
      onBlocked('roll_error');
      return;
    }

    VirtualEconomy.spend(capsulePrice);
    CaseInventory.removeCase(capsuleId);
    _isAnimating = true;

    const strip = _buildStrip(capsuleId, rollResult);
    ReelAnimationEngine.spin(null, rollResult, viewportWidth, {
      onFrame,
      onTick:     (pitch) => AudioSystem.playTick(pitch),
      onComplete: () => {
        AudioSystem.playReveal();
        let entry;
        try {
          entry = SkinInventory.addItem(rollResult);
          onReveal(entry);
        } catch (err) {
          console.error('[CapsuleOpeningOrchestrator] addItem threw:', err);
        }
        setTimeout(() => { _isAnimating = false; onReady(); }, CHORD_DECAY_MS);
      },
    }, strip);
  },
};

// extraordinary (Gold) excluded from background — same principle as rare_special in cases
const BACKGROUND_TIERS = ['high_grade', 'remarkable', 'exotic'];

function _buildStrip(capsuleId, selectedItem) {
  const capsule = CapsuleDataStore.getCapsule(capsuleId);
  const weights = capsule?.rarity_weights ?? {};
  const bgTiers = BACKGROUND_TIERS.filter(t => (weights[t] ?? 0) > 0);
  const strip   = new Array(STRIP_LENGTH);

  strip[SELECTED_INDEX] = { ...selectedItem };

  for (let i = 0; i < STRIP_LENGTH; i++) {
    if (i === SELECTED_INDEX) continue;
    const tier  = _pickBackgroundTier(weights, bgTiers);
    const pool  = capsule?.tiers[tier] ?? [];
    const item  = pool.length ? pool[Math.floor(Math.random() * pool.length)] : selectedItem;
    strip[i]    = { ...item, rarity: tier };
  }
  return strip;
}

function _pickBackgroundTier(weights, bgTiers) {
  const total = bgTiers.reduce((s, t) => s + weights[t], 0);
  let r = Math.random() * total;
  for (const t of bgTiers) { r -= weights[t]; if (r <= 0) return t; }
  return bgTiers[bgTiers.length - 1];
}
