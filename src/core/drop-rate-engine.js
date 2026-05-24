import { CaseDataStore } from '../foundation/case-data-store.js';

export class RollError extends Error {
  constructor(msg) { super(msg); this.name = 'RollError'; }
}

const TIERS = ['mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];

export const DropRateEngine = {
  // rng is injectable for deterministic testing (default: Math.random).
  // See GDD Open Question re: RNG injection for testability.
  roll(caseId, rng = Math.random) {
    const entry = CaseDataStore.getCase(caseId);
    if (!entry) throw new RollError(`Case not found: ${caseId}`);

    const weights = entry.rarity_weights;

    // Phase 1 — weighted tier selection
    let selectedTier = TIERS[TIERS.length - 1]; // rare_special fallback (float-sum guard)
    const r1 = rng();
    let cumulative = 0;
    for (const tier of TIERS) {
      cumulative += (weights[tier] ?? 0) / 100;
      if (r1 < cumulative) { selectedTier = tier; break; }
    }

    // Phase 2 — uniform item selection within tier
    const items = CaseDataStore.getItems(caseId, selectedTier);
    if (items.length === 0) throw new RollError(`Empty item pool for tier ${selectedTier} in case ${caseId}`);

    return { ...items[Math.floor(rng() * items.length)], rarity: selectedTier };
  },
};
