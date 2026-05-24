import { Persistence } from '../foundation/persistence.js';
import { Events } from '../foundation/events.js';
import { CaseDataStore } from '../foundation/case-data-store.js';
import { VirtualEconomy } from './virtual-economy.js';

export class InventoryError extends Error {
  constructor(msg) { super(msg); this.name = 'InventoryError'; }
}

const PERSISTENCE_KEY = 'case_inventory';

function _loadInventory() {
  const raw = Persistence.load(PERSISTENCE_KEY, {});
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const clean = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isInteger(v) && v >= 0) {
      clean[k] = v;
    } else {
      console.warn(`[CaseInventory] Dropping corrupt entry "${k}": ${v}`);
    }
  }
  return clean;
}

let _inventory = _loadInventory();

function _persist() { Persistence.save(PERSISTENCE_KEY, _inventory); }

function _emit(caseId, count) {
  document.dispatchEvent(new CustomEvent(Events.CASE_INVENTORY_CHANGED, { detail: { caseId, count } }));
}

export const CaseInventory = {
  getCaseCount(caseId) { return _inventory[caseId] ?? 0; },
  hasCase(caseId)      { return (_inventory[caseId] ?? 0) > 0; },
  getInventory()       { return { ..._inventory }; },

  addCase(caseId, quantity = 1) {
    if (quantity <= 0) return;
    if (!CaseDataStore.getCase(caseId)) return;
    _inventory[caseId] = (_inventory[caseId] ?? 0) + quantity;
    _persist();
    _emit(caseId, _inventory[caseId]);
  },

  buyCase(caseId, unitPrice, quantity = 1) {
    if (quantity <= 0)  throw new InventoryError('quantity must be positive');
    if (unitPrice <= 0) throw new InventoryError('unitPrice must be positive');
    if (!CaseDataStore.getCase(caseId)) return false;
    if (!VirtualEconomy.spend(unitPrice * quantity)) return false;
    _inventory[caseId] = (_inventory[caseId] ?? 0) + quantity;
    _persist();
    _emit(caseId, _inventory[caseId]);
    return true;
  },

  removeCase(caseId) {
    const current = _inventory[caseId] ?? 0;
    if (current === 0) return false;
    _inventory[caseId] = current - 1;
    if (_inventory[caseId] === 0) delete _inventory[caseId];
    _persist();
    _emit(caseId, _inventory[caseId] ?? 0);
    return true;
  },

  clearInventory() {
    _inventory = {};
    _persist();
    _emit(null, 0);
  },
};
