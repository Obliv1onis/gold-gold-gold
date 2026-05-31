import { Persistence } from '../foundation/persistence.js';
import { Events } from '../foundation/events.js';

export class EconomyError extends Error {
  constructor(msg) { super(msg); this.name = 'EconomyError'; }
}

export const KEY_COST_USD     = 2.49;
export const STARTING_BALANCE = 2000.00;
const BALANCE_FLOOR    = 0.00;
const SANITY_CEILING   = 9_999_999;
const PERSISTENCE_KEY  = 'balance';

function _round(v) { return Math.round(v * 100) / 100; }

function _loadBalance() {
  const raw = Persistence.load(PERSISTENCE_KEY, STARTING_BALANCE);
  if (raw === 'Infinity') return Infinity;
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!isFinite(n) || isNaN(n)) return STARTING_BALANCE;
  if (n < BALANCE_FLOOR) return BALANCE_FLOOR;
  if (n > SANITY_CEILING) return SANITY_CEILING;
  return _round(n);
}

function _persistBalance(v) {
  Persistence.save(PERSISTENCE_KEY, v === Infinity ? 'Infinity' : v);
}

let _balance = _loadBalance();

function _persist() { _persistBalance(_balance); }

function _emit() {
  document.dispatchEvent(new CustomEvent(Events.BALANCE_CHANGED, { detail: { balance: _balance } }));
}

export const VirtualEconomy = {
  KEY_COST_USD,
  STARTING_BALANCE,

  getBalance()         { return _balance; },
  canAfford(amount)    { return _balance >= amount; },

  spend(amount) {
    if (amount <= 0) throw new EconomyError('amount must be positive');
    if (_balance < amount) return false;
    _balance = _round(_balance - amount);
    _persist();
    _emit();
    return true;
  },

  earn(amount) {
    if (amount <= 0) throw new EconomyError('amount must be positive');
    _balance = _round(_balance + amount);
    _persist();
    _emit();
  },

  forceSet(amount) {
    _balance = amount === Infinity ? Infinity : _round(Math.max(BALANCE_FLOOR, amount));
    _persist();
    _emit();
  },

  reset() {
    _balance = STARTING_BALANCE;
    _persist();
    _emit();
  },
};
