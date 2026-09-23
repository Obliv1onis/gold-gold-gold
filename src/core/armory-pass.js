import { Persistence } from '../foundation/persistence.js';
import { Events } from '../foundation/events.js';
import { VirtualEconomy } from './virtual-economy.js';

export const ARMORY_PASS_PRICE_USD = 15.99;
export const ARMORY_PASS_DRAWS = 10;
const PERSISTENCE_KEY = 'armory_pass_draws';

function loadRemaining() {
  const value = Persistence.load(PERSISTENCE_KEY, 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

let _remaining = loadRemaining();

function saveAndEmit() {
  Persistence.save(PERSISTENCE_KEY, _remaining);
  document.dispatchEvent(new CustomEvent(Events.ARMORY_PASS_CHANGED, {
    detail: { remaining: _remaining },
  }));
}

export const ArmoryPass = {
  getRemaining() { return _remaining; },

  purchase() {
    if (!VirtualEconomy.spend(ARMORY_PASS_PRICE_USD)) return false;
    _remaining += ARMORY_PASS_DRAWS;
    saveAndEmit();
    return true;
  },

  consume() {
    if (_remaining <= 0) return false;
    _remaining--;
    saveAndEmit();
    return true;
  },

  reset() {
    _remaining = 0;
    saveAndEmit();
  },
};
