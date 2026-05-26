import { Events } from '../foundation/events.js';

/**
 * Fetches live skin and case prices from the Steam Community Market.
 *
 * In development the Vite dev server proxies /api/steam → steamcommunity.com
 * (bypassing browser CORS). In production set VITE_PRICE_API_BASE to a
 * serverless proxy URL (e.g. Netlify Function). See ADR-0008.
 *
 * Fires Events.PRICE_UPDATED on document after each successful fetch:
 *   { detail: { hashName: string, price: number } }
 *
 * @example
 * PriceAPILayer.prefetch('AK-47 | Redline (Field-Tested)');
 * document.addEventListener(Events.PRICE_UPDATED, e => console.log(e.detail));
 *
 * const price = await PriceAPILayer.getPrice('Recoil Case');
 */

const BASE_URL    = import.meta.env?.VITE_PRICE_API_BASE ?? '/api/steam';
const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes
const QUEUE_DELAY = 300;             // ms between requests (rate-limit safety)
const APPID       = 730;
const CURRENCY    = 1;               // USD

const WEAR_LABELS = {
  fn: 'Factory New',
  mw: 'Minimal Wear',
  ft: 'Field-Tested',
  ww: 'Well-Worn',
  bs: 'Battle-Scarred',
};

// In-memory price cache: hashName → { price: number, fetchedAt: number }
const _cache = new Map();
// Request queue: [{ hashName, resolve, reject }]
const _queue = [];
let   _processing = false;
// Pending set: hashNames already in the queue (dedup)
const _pending = new Set();

function _parsePriceStr(str) {
  if (!str || typeof str !== 'string') return null;
  const n = parseFloat(str.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function _fetchOne(hashName) {
  const url = `${BASE_URL}?currency=${CURRENCY}&appid=${APPID}&market_hash_name=${encodeURIComponent(hashName)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error('Steam API success: false');
  const price = _parsePriceStr(data.median_price ?? data.lowest_price);
  if (price === null) throw new Error('No valid price in response');
  return price;
}

async function _processQueue() {
  _processing = true;
  while (_queue.length) {
    const { hashName, resolve, reject } = _queue.shift();
    _pending.delete(hashName);
    try {
      const price = await _fetchOne(hashName);
      _cache.set(hashName, { price, fetchedAt: Date.now() });
      document.dispatchEvent(new CustomEvent(Events.PRICE_UPDATED, {
        detail: { hashName, price },
      }));
      resolve(price);
    } catch (err) {
      reject(err);
    }
    if (_queue.length) await new Promise(r => setTimeout(r, QUEUE_DELAY));
  }
  _processing = false;
}

function _enqueue(hashName) {
  return new Promise((resolve, reject) => {
    if (_pending.has(hashName)) {
      // Already queued — resolve with cached value when it arrives
      // by attaching to the PRICE_UPDATED event once
      const handler = e => {
        if (e.detail.hashName !== hashName) return;
        document.removeEventListener(Events.PRICE_UPDATED, handler);
        resolve(e.detail.price);
      };
      document.addEventListener(Events.PRICE_UPDATED, handler);
      return;
    }
    _pending.add(hashName);
    _queue.push({ hashName, resolve, reject });
    if (!_processing) _processQueue();
  });
}

export const PriceAPILayer = {
  /**
   * Returns the cached price for hashName synchronously, or null if not yet fetched.
   * Use this when you need an immediate (possibly stale) value.
   * @param {string} hashName
   * @returns {number|null}
   */
  getCachedPrice(hashName) {
    return _cache.get(hashName)?.price ?? null;
  },

  /**
   * Resolves to the live Steam price for hashName.
   * Returns the cache if still fresh; queues a fetch otherwise.
   * Rejects if the fetch fails and there is no stale cache.
   * @param {string} hashName
   * @returns {Promise<number>}
   */
  async getPrice(hashName) {
    const entry = _cache.get(hashName);
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) return entry.price;
    try {
      return await _enqueue(hashName);
    } catch {
      if (entry) return entry.price; // stale cache beats failure
      throw new Error(`No price available for "${hashName}"`);
    }
  },

  /**
   * Queues a fetch without waiting for it. When the price arrives,
   * Events.PRICE_UPDATED fires on document. No-ops if cache is fresh.
   * @param {string} hashName
   */
  prefetch(hashName) {
    const entry = _cache.get(hashName);
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) return;
    _enqueue(hashName).catch(() => {});
  },

  /**
   * Builds the Steam Community Market hash name for a skin listing.
   *
   * Hash name format:
   *   Regular:         "AK-47 | Redline (Field-Tested)"
   *   StatTrak™:       "StatTrak™ AK-47 | Redline (Field-Tested)"
   *   Knife:           "★ Karambit | Fade (Factory New)"
   *   StatTrak™ Knife: "★ StatTrak™ Karambit | Fade (Factory New)"
   *   Vanilla Knife:   "★ Karambit" (no wear suffix)
   *
   * @param {{ weapon: string, skin: string }} item
   * @param {string} wearTier  'fn'|'mw'|'ft'|'ww'|'bs'
   * @param {boolean} [statTrak=false]
   * @returns {string}
   */
  buildSkinHashName(item, wearTier, statTrak = false) {
    const wear    = WEAR_LABELS[wearTier] ?? 'Field-Tested';
    const isKnife = item.skin?.startsWith('★');

    if (isKnife) {
      const bare      = item.skin.slice(1).trim();
      const isVanilla = bare.toLowerCase() === 'vanilla';
      if (isVanilla) {
        return statTrak ? `★ StatTrak™ ${item.weapon}` : `★ ${item.weapon}`;
      }
      return statTrak
        ? `★ StatTrak™ ${item.weapon} | ${bare} (${wear})`
        : `★ ${item.weapon} | ${bare} (${wear})`;
    }

    return statTrak
      ? `StatTrak™ ${item.weapon} | ${item.skin} (${wear})`
      : `${item.weapon} | ${item.skin} (${wear})`;
  },

  /**
   * Builds the Steam Market hash name for a weapon case.
   * Cases use their display name directly (e.g. "Recoil Case").
   * @param {string} caseName
   * @returns {string}
   */
  buildCaseHashName(caseName) {
    return caseName;
  },
};
