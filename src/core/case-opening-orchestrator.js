import { VirtualEconomy, KEY_COST_USD } from './virtual-economy.js';
import { CaseInventory }                from './case-inventory.js';
import { SkinInventory }                from './skin-inventory.js';
import { DropRateEngine, RollError }    from './drop-rate-engine.js';
import { ReelAnimationEngine }          from './reel-animation-engine.js';
import { AudioSystem }                  from './audio-system.js';
import { FloatService }                 from '../foundation/float-service.js';
import { CaseDataStore }                from '../foundation/case-data-store.js';

/** How long the Open button stays locked after the reveal chord starts (ms). */
export const CHORD_DECAY_MS = 800;

const STAT_TRAK_CHANCE     = 0.10; // 10 % of drops are StatTrak™
const STAT_TRAK_MULTIPLIER = 1.50; // StatTrak™ price premium

let _isAnimating = false;

/**
 * Single entry point for a case open. Coordinates the full step chain:
 * validate → roll → spend → animate → reveal.
 *
 * @example
 * CaseOpeningOrchestrator.open('recoil_case', 0.50, reelEl.offsetWidth, {
 *   onFrame:   (offset, strip) => ReelUI.render(offset, strip),
 *   onReveal:  (entry) => RevealUI.show(entry),
 *   onBlocked: (reason) => HUD.showBlocked(reason),
 *   onReady:   () => HUD.enableOpenButton(),
 * });
 */
export const CaseOpeningOrchestrator = {
  /** True while a spin or chord-decay is in progress. */
  get isAnimating() { return _isAnimating; },

  /**
   * Initiates a case open. Silent no-op if `isAnimating` is true.
   *
   * @param {string} caseId
   * @param {number} casePrice - Market price of the case in USD
   * @param {number} viewportWidth - Reel viewport pixel width (from ReelUI)
   * @param {object} callbacks
   * @param {function} callbacks.onFrame   - (offset, strip) per-frame reel render
   * @param {function} callbacks.onReveal  - (InventorySkinEntry) when item is awarded
   * @param {function} callbacks.onBlocked - (reason: string) when open is rejected
   * @param {function} callbacks.onReady   - () when isAnimating resets to false
   */
  open(caseId, casePrice, viewportWidth, callbacks) {
    const {
      onFrame   = () => {},
      onReveal  = () => {},
      onBlocked = () => {},
      onReady   = () => {},
    } = callbacks ?? {};

    // Re-entry guard — silent, no event (E1)
    if (_isAnimating) return;

    // Step 1: Case ownership check (E2, E9)
    if (!CaseInventory.hasCase(caseId)) {
      onBlocked('no_case');
      return;
    }

    // Step 2: Affordability check (E3)
    const isSouvenirCase = CaseDataStore.getCase(caseId)?.type === 'souvenir_package';
    const totalCost = isSouvenirCase ? _round(casePrice) : _round(casePrice + KEY_COST_USD);
    if (!VirtualEconomy.canAfford(totalCost)) {
      onBlocked('insufficient_funds');
      return;
    }

    // Step 3: Roll — before spend so a bad case data aborts cleanly (E4)
    let selectedItem;
    try {
      const rolled = DropRateEngine.roll(caseId);
      // Attach float, wear tier, and float-adjusted market price
      const floatVal    = FloatService.generateFloat();
      const wearTier    = FloatService.getWearTier(floatVal);
      const basePrice   = rolled.market_price ?? 0;
      const adjPrice    = _round(basePrice * FloatService.getPriceMultiplier(floatVal));
      const isStatTrak  = !isSouvenirCase && !_isGlove(rolled.weapon) && Math.random() < STAT_TRAK_CHANCE;
      const finalPrice  = isStatTrak ? _round(adjPrice * STAT_TRAK_MULTIPLIER) : adjPrice;
      selectedItem = { ...rolled, case_id: caseId, float: floatVal, wear_tier: wearTier, market_price: finalPrice, stat_trak: isStatTrak };
    } catch (err) {
      if (err instanceof RollError) {
        onBlocked('roll_error');
        return;
      }
      throw err;
    }

    // Steps 4 & 5: Commit (irreversible)
    VirtualEconomy.spend(totalCost);
    const removed = CaseInventory.removeCase(caseId);
    if (!removed) {
      // E5: hasCase passed but removeCase returned false — log and continue
      console.error(`[CaseOpeningOrchestrator] removeCase(${caseId}) returned false after hasCase passed`);
    }

    // Step 6: Lock re-entry
    _isAnimating = true;

    // Step 7: Start reel animation
    ReelAnimationEngine.spin(caseId, selectedItem, viewportWidth, {
      onFrame,
      onTick: (pitch) => AudioSystem.playTick(pitch),
      onComplete: () => {
        AudioSystem.playReveal();

        let newEntry;
        try {
          newEntry = SkinInventory.addItem(selectedItem);
          onReveal(newEntry);
        } catch (err) {
          // E6: addItem threw — log but always unblock (game must not stay locked)
          console.error('[CaseOpeningOrchestrator] addItem() threw in onComplete:', err);
        }

        setTimeout(() => {
          _isAnimating = false;
          onReady();
        }, CHORD_DECAY_MS);
      },
    });
  },
};

function _round(v) { return Math.round(v * 100) / 100; }

function _isGlove(weapon) {
  return typeof weapon === 'string' && (weapon.includes('Gloves') || weapon.includes('Wraps'));
}
