import { CaseDataStore } from '../foundation/case-data-store.js';
import { FloatService }  from '../foundation/float-service.js';

/**
 * Rarity progression for Trade-Up Contracts.
 * Covert is the ceiling; rare_special (knives/gloves) cannot be traded up.
 */
const NEXT_RARITY = {
  mil_spec:   'restricted',
  restricted: 'classified',
  classified: 'covert',
};

export const CONTRACT_SIZE      = 10;
const        STAT_TRAK_MULT     = 1.50;

/**
 * Business logic for CS2 Trade-Up Contracts.
 *
 * Rules enforced:
 *  - Exactly 10 skins, all identical rarity (mil_spec / restricted / classified)
 *  - All StatTrak™ or all non-StatTrak™ — no mixing
 *  - Each input contributes 1/10 weight toward next-rarity skins of its case
 *  - Output float = Avg(input floats) × (1.0 − 0.0) + 0.0  =  Avg(input floats)
 *    (skin-specific float caps not tracked; [0, 1] range assumed for all skins)
 *
 * @example
 * const result = TradeUpEngine.execute(tenItems);
 * const entry  = SkinInventory.addItem(result);
 * SkinInventory.consumeItems(tenItems.map(it => it.instanceId)); // caller handles
 */
export const TradeUpEngine = {

  /**
   * Validates 10 input item objects for a trade-up contract.
   * @param {object[]} items  Array of InventorySkinEntry.item objects
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  validate(items) {
    if (!Array.isArray(items) || items.length !== CONTRACT_SIZE) {
      return { ok: false, reason: 'need_ten' };
    }

    const rarity = items[0].rarity;
    if (!NEXT_RARITY[rarity]) {
      return { ok: false, reason: 'ineligible_rarity' };
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
   * Builds a weighted outcome pool from 10 input items.
   *
   * Each input contributes 1/10 weight distributed equally across the
   * next-rarity skins of its source case.  If 7 inputs are from Case A
   * (3 next-tier skins) and 3 are from Case B (2 next-tier skins):
   *   Case A skin weight each = 7 / 3 ≈ 2.33
   *   Case B skin weight each = 3 / 2 = 1.50
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
   * @param {function} [rng=Math.random]  injectable for deterministic tests
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
   *
   * Formula: Output Float = Avg × (Max − Min) + Min
   * With Min = 0.0, Max = 1.0 (full skin range in this simulator):
   *   Output Float = Avg(input floats)
   *
   * @param {object[]} items
   * @returns {number}  clamped to [0, 1]
   */
  calcOutputFloat(items) {
    const avg = items.reduce((s, it) => s + (it.float ?? 0), 0) / items.length;
    return Math.min(1, Math.max(0, avg));
  },

  /**
   * Executes a full trade-up contract. Returns the output skin item object.
   * The caller must:
   *   1. Add the result to SkinInventory via addItem()
   *   2. Remove the 10 input items via consumeItems()
   *
   * @param {object[]} items  InventorySkinEntry.item objects (must pass validate)
   * @param {function} [rng=Math.random]
   * @returns {object}  skin item ready for SkinInventory.addItem()
   * @throws {Error}  reason matches validate().reason or 'empty_pool'
   */
  execute(items, rng = Math.random) {
    const valid = this.validate(items);
    if (!valid.ok) throw new Error(valid.reason);

    const pool = this.buildPool(items);
    if (!pool.length) throw new Error('empty_pool');

    const isStatTrak  = !!(items[0].stat_trak);
    const outputFloat = this.calcOutputFloat(items);
    const wearTier    = FloatService.getWearTier(outputFloat);
    const rolledItem  = this.rollFromPool(pool, rng);
    const basePrice   = rolledItem.market_price ?? 0;
    const adjPrice    = Math.round(basePrice * FloatService.getPriceMultiplier(outputFloat) * 100) / 100;
    const finalPrice  = isStatTrak ? Math.round(adjPrice * STAT_TRAK_MULT * 100) / 100 : adjPrice;

    return {
      ...rolledItem,
      float:        outputFloat,
      wear_tier:    wearTier,
      market_price: finalPrice,
      stat_trak:    isStatTrak,
    };
  },
};
