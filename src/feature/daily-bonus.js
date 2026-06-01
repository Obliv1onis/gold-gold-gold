import { Persistence }    from '../foundation/persistence.js';
import { VirtualEconomy } from '../core/virtual-economy.js';

const BONUS_AMOUNT    = 200;
const COOLDOWN_MS     = 24 * 60 * 60 * 1000;
const PERSISTENCE_KEY = 'daily_bonus_last_claim';

export const DailyBonus = {
  isAvailable() {
    const last = Persistence.load(PERSISTENCE_KEY, 0);
    return (Date.now() - last) >= COOLDOWN_MS;
  },

  claim() {
    if (!this.isAvailable()) return false;
    VirtualEconomy.earn(BONUS_AMOUNT);
    Persistence.save(PERSISTENCE_KEY, Date.now());
    return true;
  },

  /** Milliseconds until next claim is available (0 if already available). */
  msUntilNext() {
    const last = Persistence.load(PERSISTENCE_KEY, 0);
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
  },

  BONUS_AMOUNT,
};
