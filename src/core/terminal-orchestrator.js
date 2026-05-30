import { DropRateEngine, RollError } from './drop-rate-engine.js';
import { VirtualEconomy }            from './virtual-economy.js';
import { SkinInventory }             from './skin-inventory.js';
import { FloatService }              from '../foundation/float-service.js';
import { AudioSystem }               from './audio-system.js';

const MAX_OFFERS = 5;

let _terminalId  = null;
let _offerCount  = 0;
let _offeredIds  = new Set(); // item_ids already shown this session
let _onOffer     = null;
let _onClose     = null;
let _onBlocked   = null;

function _round(v) { return Math.round(v * 100) / 100; }

/**
 * Manages a terminal opening session: rolls offers, handles buy/skip/end.
 * Opening a terminal is free; only Buy deducts the skin's price.
 *
 * @example
 * TerminalOrchestrator.open('terminal_genesis', {
 *   onOffer:   (skin, offerNum, isFinal) => TerminalUI.renderOffer(skin, offerNum, isFinal),
 *   onClose:   ()                        => TerminalUI.hide(),
 *   onBlocked: (reason)                  => TerminalUI.showError(reason),
 * });
 */
export const TerminalOrchestrator = {
  /**
   * Starts a terminal session. Charges `entryCost` upfront before showing any offer.
   * @param {string}   terminalId
   * @param {number}   entryCost  - market_price of the terminal (charged on open)
   * @param {object}   callbacks
   * @param {function} callbacks.onOffer   - (skin, offerNum, isFinal)
   * @param {function} callbacks.onClose   - ()
   * @param {function} callbacks.onBlocked - (reason: string)
   */
  open(terminalId, entryCost, { onOffer, onClose, onBlocked } = {}) {
    _terminalId = terminalId;
    _offerCount = 0;
    _offeredIds = new Set();
    _onOffer    = onOffer   ?? (() => {});
    _onClose    = onClose   ?? (() => {});
    _onBlocked  = onBlocked ?? (() => {});

    if (entryCost > 0) {
      if (!VirtualEconomy.canAfford(entryCost)) {
        _onBlocked('insufficient_funds');
        return;
      }
      VirtualEconomy.spend(entryCost);
    }

    this._nextOffer();
  },

  /** Accept the current offer — spends the skin price and adds it to inventory. */
  buy(skin) {
    if (!VirtualEconomy.canAfford(skin.market_price)) {
      _onBlocked('insufficient_funds');
      return;
    }
    VirtualEconomy.spend(skin.market_price);
    SkinInventory.addItem({ ...skin, case_id: _terminalId });
    _onClose();
  },

  /** Skip the current offer. On the 5th offer, closes with nothing awarded. */
  skip() {
    if (_offerCount >= MAX_OFFERS) {
      _onClose();
      return;
    }
    this._nextOffer();
  },

  _nextOffer() {
    _offerCount++;
    let rolled;
    const MAX_RETRIES = 50;
    let attempts = 0;
    try {
      do {
        rolled = DropRateEngine.roll(_terminalId);
        attempts++;
      } while (_offeredIds.has(rolled.item_id) && attempts < MAX_RETRIES);
    } catch (e) {
      if (e instanceof RollError) { _onClose(); return; }
      throw e;
    }
    _offeredIds.add(rolled.item_id);
    const floatVal = FloatService.generateFloat();
    const wearTier = FloatService.getWearTier(floatVal);
    const adjPrice = _round((rolled.market_price ?? 0) * FloatService.getPriceMultiplier(floatVal));
    const skin     = { ...rolled, float: floatVal, wear_tier: wearTier, market_price: adjPrice };
    AudioSystem.playReveal();
    _onOffer(skin, _offerCount, _offerCount >= MAX_OFFERS);
  },
};
