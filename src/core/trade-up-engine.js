import { CaseDataStore } from '../foundation/case-data-store.js';
import { FloatService }  from '../foundation/float-service.js';

/**
 * Rarity progression for Trade-Up Contracts.
 * Covert (red) contracts produce a Rare Special Item (knife / glove).
 */
const NEXT_RARITY = {
  mil_spec:   'restricted',
  restricted: 'classified',
  classified: 'covert',
  covert:     'rare_special',
};

export const CONTRACT_SIZE        = 10;  // mil_spec / restricted / classified
export const CONTRACT_SIZE_COVERT = 5;   // covert → rare_special

function _contractSizeFor(rarity) {
  return rarity === 'covert' ? CONTRACT_SIZE_COVERT : CONTRACT_SIZE;
}

function _isVanilla(item) {
  return item.skin?.startsWith('★') && item.skin.slice(1).trim().toLowerCase() === 'vanilla';
}

/**
 * Business logic for CS2 Trade-Up Contracts.
 *
 * Rules enforced:
 *  - Mil-Spec / Restricted / Classified: exactly 10 skins, all same rarity
 *  - Covert (red): exactly 5 skins → one Rare Special Item (knife / glove)
 *  - All StatTrak™ or all non-StatTrak™ — no mixing
 *  - Output skin: randomly pick one input skin, look up its case, then pick
 *    one skin of the next rarity from that case (uniform distribution)
 *  - Output float = Avg(input floats) (vanilla knives have no float)
 *
 * @example
 * const result = TradeUpEngine.execute(fiveCovertItems);
 * SkinInventory.addItem(result);
 * SkinInventory.consumeItems(fiveCovertItems.map(it => it.instanceId));
 */
export const TradeUpEngine = {

  /**
   * Validates input items for a trade-up contract.
   * @param {object[]} items  Array of InventorySkinEntry.item objects
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  validate(items) {
    if (!Array.isArray(items) || items.length < 1) {
      return { ok: false, reason: 'need_ten' };
    }

    const rarity = items[0].rarity;
    if (!NEXT_RARITY[rarity]) {
      return { ok: false, reason: 'ineligible_rarity' };
    }

    const required = _contractSizeFor(rarity);
    if (items.length !== required) {
      return { ok: false, reason: rarity === 'covert' ? 'need_five' : 'need_ten' };
    }

    if (items.some(it => it.rarity !== rarity)) {
      return { ok: false, reason: 'mixed_rarity' };
    }
    if (items.some(it => !it.case_id)) {
      return { ok: false, reason: 'missing_case_id' };
    }

    const hasST  = items.some(it => !!it.stat_trak);
    const hasSTD = items.some(it => !it.stat_trak);
    if (hasST && hasSTD) {
      return { ok: false, reason: 'mixed_stat_trak' };
    }

    return { ok: true };
  },

  /**
   * Builds a weighted outcome pool from input items.
   * Each input contributes 1/N weight toward next-rarity skins of its case.
   * Kept for backward compatibility; execute() uses simpler uniform selection.
   *
   * @param {object[]} items
   * @returns {Array<{ item: object, weight: number }>}
   */
  buildPool(items) {
    const nextRarity = NEXT_RARITY[items[0].rarity];

    const caseCount = {};
    for (const it of items) {
      caseCount[it.case_id] = (caseCount[it.case_id] ?? 0) + 1;
    }

    const pool = [];
    for (const [caseId, count] of Object.entries(caseCount)) {
      const nextItems = CaseDataStore.getItems(caseId, nextRarity);
      if (!nextItems.length) continue;

      const caseEntry = CaseDataStore.getCase(caseId);
      const caseName  = caseEntry?.name ?? caseId;
      const perSkinWt = count / nextItems.length;

      for (const nextItem of nextItems) {
        pool.push({
          item:   { ...nextItem, rarity: nextRarity, case_id: caseId, case_name: caseName },
          weight: perSkinWt,
        });
      }
    }
    return pool;
  },

  /**
   * Picks a weighted-random item from the pool.
   * @param {Array<{ item: object, weight: number }>} pool
   * @param {function} [rng=Math.random]
   * @returns {object}
   */
  rollFromPool(pool, rng = Math.random) {
    if (!pool.length) throw new Error('empty_pool');
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = rng() * total;
    for (const entry of pool) {
      r -= entry.weight;
      if (r <= 0) return entry.item;
    }
    return pool[pool.length - 1].item;
  },

  /**
   * Calculates the output float from the average of input floats.
   * @param {object[]} items
   * @returns {number}  clamped to [0, 1]
   */
  calcOutputFloat(items) {
    const avg = items.reduce((s, it) => s + (it.float ?? 0), 0) / items.length;
    return Math.min(1, Math.max(0, avg));
  },

  /**
   * Executes a full trade-up contract. Returns the output skin item object.
   *
   * Algorithm:
   *   1. Randomly pick one of the input skins (uniform)
   *   2. Look up its source case
   *   3. Pick one skin of the next rarity from that case (uniform)
   *
   * The caller must:
   *   1. Add the result to SkinInventory via addItem()
   *   2. Remove input items via consumeItems()
   *
   * @param {object[]} items  InventorySkinEntry.item objects (must pass validate)
   * @param {function} [rng=Math.random]
   * @returns {object}  skin item ready for SkinInventory.addItem()
   * @throws {Error}  reason matches validate().reason or 'empty_pool'
   */
  execute(items, rng = Math.random) {
    const valid = this.validate(items);
    if (!valid.ok) throw new Error(valid.reason);

    const nextRarity = NEXT_RARITY[items[0].rarity];

    // Pick a random pivot input → source case → uniform pick from next-tier pool
    const pivot      = items[Math.floor(rng() * items.length)];
    const caseId     = pivot.case_id;
    const nextItems  = CaseDataStore.getItems(caseId, nextRarity);
    if (!nextItems.length) throw new Error('empty_pool');

    const caseEntry  = CaseDataStore.getCase(caseId);
    const caseName   = caseEntry?.name ?? caseId;
    const rolledItem = nextItems[Math.floor(rng() * nextItems.length)];

    const isStatTrak  = !!(items[0].stat_trak);
    const vanilla     = _isVanilla(rolledItem);
    const outputFloat = vanilla ? null : this.calcOutputFloat(items);
    const wearTier    = outputFloat !== null ? FloatService.getWearTier(outputFloat) : null;

    return {
      ...rolledItem,
      rarity:       nextRarity,
      case_id:      caseId,
      case_name:    caseName,
      float:        outputFloat,
      wear_tier:    wearTier,
      stat_trak:    isStatTrak,
      market_price: null,
    };
  },
};
