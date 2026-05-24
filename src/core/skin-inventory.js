import { Persistence } from '../foundation/persistence.js';
import { Events } from '../foundation/events.js';
import { VirtualEconomy } from './virtual-economy.js';

export class InventoryError extends Error {
  constructor(msg) { super(msg); this.name = 'InventoryError'; }
}

export const SELL_FEE_RATE   = 0.15;
const PERSISTENCE_KEY = 'skin_inventory';

function _round(v) { return Math.round(v * 100) / 100; }

function _uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function _loadInventory() {
  const raw = Persistence.load(PERSISTENCE_KEY, []);
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of raw) {
    if (!entry || typeof entry.instanceId !== 'string') {
      console.warn('[SkinInventory] Dropping entry missing instanceId');
      continue;
    }
    if (seen.has(entry.instanceId)) {
      console.warn(`[SkinInventory] Dropping duplicate instanceId: ${entry.instanceId}`);
      continue;
    }
    seen.add(entry.instanceId);
    result.push(entry);
  }
  return result;
}

let _inventory = _loadInventory();

function _persist() { Persistence.save(PERSISTENCE_KEY, _inventory); }

function _emit() {
  document.dispatchEvent(new CustomEvent(Events.SKIN_INVENTORY_CHANGED, { detail: { inventory: [..._inventory] } }));
}

export const SkinInventory = {
  SELL_FEE_RATE,

  addItem(item) {
    const entry = { instanceId: _uuid(), acquiredAt: Date.now(), item };
    _inventory.unshift(entry);
    _persist();
    _emit();
    return entry;
  },

  getItems()          { return [..._inventory]; },
  getItem(instanceId) { return _inventory.find(e => e.instanceId === instanceId) ?? null; },
  hasItem(instanceId) { return _inventory.some(e => e.instanceId === instanceId); },

  sellItem(instanceId, salePrice) {
    if (salePrice < 0) throw new InventoryError('salePrice cannot be negative');
    const idx = _inventory.findIndex(e => e.instanceId === instanceId);
    if (idx === -1) return false;
    _inventory.splice(idx, 1);
    VirtualEconomy.earn(_round(salePrice * (1 - SELL_FEE_RATE)));
    _persist();
    _emit();
    return true;
  },

  clearInventory() {
    _inventory = [];
    _persist();
    _emit();
  },
};
