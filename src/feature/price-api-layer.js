import { Events } from '../foundation/events.js';

/**
 * Live skin price layer.
 *
 * Primary source: Skinport public bulk API — one request loads prices for every
 * CS2 item and populates the local cache. No API key required.
 * Fallback: Steam Community Market priceoverview, one item at a time, for anything
 * Skinport doesn't cover (very rare).
 *
 * In development, both endpoints are proxied through the Vite dev server to avoid
 * CORS. In production set VITE_PRICE_API_BASE (Steam) and VITE_SKINPORT_BASE
 * (Skinport) to serverless proxy URLs. See ADR-0008.
 *
 * After a price is resolved, Events.PRICE_UPDATED fires on document:
 *   { detail: { hashName: string, price: number } }
 *
 * @example
 * PriceAPILayer.prefetch('AWP | Dragon Lore (Factory New)');
 * document.addEventListener(Events.PRICE_UPDATED, e => console.log(e.detail));
 */

const SKINPORT_URL = import.meta.env?.VITE_SKINPORT_BASE ?? '/api/skinport';
const STEAM_URL    = import.meta.env?.VITE_PRICE_API_BASE ?? '/api/steam';
const CACHE_TTL    = 10 * 60 * 1000; // 10 minutes
const STEAM_DELAY  = 300;             // ms between Steam fallback requests
const APPID        = 730;
const CURRENCY     = 1;               // USD

const WEAR_LABELS = {
  fn: 'Factory New',
  mw: 'Minimal Wear',
  ft: 'Field-Tested',
  ww: 'Well-Worn',
  bs: 'Battle-Scarred',
};

// Price cache: hashName → { price: number, fetchedAt: number }
const _cache = new Map();

// ── Skinport bulk loader ────────────────────────────────────────────────────

let _bulkLoadPromise = null;
let _bulkLoaded      = false;

async function _loadSkinportBulk() {
  try {
    const res = await fetch(`${SKINPORT_URL}?app_id=${APPID}&currency=USD`, {
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Skinport HTTP ${res.status}`);
    const items = await res.json();
    const now = Date.now();
    let count = 0;
    for (const item of items) {
      const price = item.suggested_price ?? item.mean_price ?? item.min_price;
      if (item.market_hash_name && price > 0) {
        _cache.set(item.market_hash_name, { price, fetchedAt: now });
        count++;
      }
    }
    console.info(`[PriceAPILayer] Skinport loaded ${count} prices`);
  } catch (err) {
    console.warn('[PriceAPILayer] Skinport bulk load failed, will use Steam fallback:', err.message);
  }
  _bulkLoaded = true;
}

function _ensureBulkLoaded() {
  if (!_bulkLoadPromise) _bulkLoadPromise = _loadSkinportBulk();
  return _bulkLoadPromise;
}

// ── Steam per-item fallback ─────────────────────────────────────────────────

const _steamQueue   = [];
const _steamPending = new Set();
let   _steamRunning = false;

function _parsePriceStr(str) {
  if (!str || typeof str !== 'string') return null;
  const n = parseFloat(str.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function _fetchSteam(hashName) {
  const url = `${STEAM_URL}?currency=${CURRENCY}&appid=${APPID}&market_hash_name=${encodeURIComponent(hashName)}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Steam HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error('Steam success: false');
  const price = _parsePriceStr(data.median_price ?? data.lowest_price);
  if (price === null) throw new Error('No valid price in Steam response');
  return price;
}

async function _runSteamQueue() {
  _steamRunning = true;
  while (_steamQueue.length) {
    const { hashName, resolve, reject } = _steamQueue.shift();
    _steamPending.delete(hashName);
    try {
      const price = await _fetchSteam(hashName);
      _cache.set(hashName, { price, fetchedAt: Date.now() });
      document.dispatchEvent(new CustomEvent(Events.PRICE_UPDATED, {
        detail: { hashName, price },
      }));
      resolve(price);
    } catch (err) {
      reject(err);
    }
    if (_steamQueue.length) await new Promise(r => setTimeout(r, STEAM_DELAY));
  }
  _steamRunning = false;
}

function _enqueueSteam(hashName) {
  return new Promise((resolve, reject) => {
    if (_steamPending.has(hashName)) {
      const handler = e => {
        if (e.detail.hashName !== hashName) return;
        document.removeEventListener(Events.PRICE_UPDATED, handler);
        resolve(e.detail.price);
      };
      document.addEventListener(Events.PRICE_UPDATED, handler);
      return;
    }
    _steamPending.add(hashName);
    _steamQueue.push({ hashName, resolve, reject });
    if (!_steamRunning) _runSteamQueue();
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export const PriceAPILayer = {
  /**
   * Returns the cached price synchronously, or null if not yet fetched.
   * @param {string} hashName
   * @returns {number|null}
   */
  getCachedPrice(hashName) {
    return _cache.get(hashName)?.price ?? null;
  },

  /**
   * Resolves to the live price for hashName.
   * Waits for the Skinport bulk load; if the item isn't in Skinport, falls
   * back to a per-item Steam fetch.
   * @param {string} hashName
   * @returns {Promise<number>}
   */
  async getPrice(hashName) {
    await _ensureBulkLoaded();
    const entry = _cache.get(hashName);
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) return entry.price;
    return _enqueueSteam(hashName);
  },

  /**
   * Kicks off bulk price loading and fires Events.PRICE_UPDATED for `hashName`
   * as soon as its price is known. Safe to call many times — deduped internally.
   * @param {string} hashName
   */
  prefetch(hashName) {
    _ensureBulkLoaded().then(() => {
      const entry = _cache.get(hashName);
      if (entry) {
        // Bulk cache hit — notify immediately (next microtask so DOM is ready)
        Promise.resolve().then(() => {
          document.dispatchEvent(new CustomEvent(Events.PRICE_UPDATED, {
            detail: { hashName, price: entry.price },
          }));
        });
      } else {
        // Not in Skinport — fall back to Steam
        _enqueueSteam(hashName).catch(() => {});
      }
    });
  },

  /**
   * Builds the Steam / Skinport market hash name for a skin.
   *
   *   Regular:          "AK-47 | Redline (Field-Tested)"
   *   StatTrak™:        "StatTrak™ AK-47 | Redline (Field-Tested)"
   *   Knife:            "★ Karambit | Fade (Factory New)"
   *   StatTrak™ Knife:  "★ StatTrak™ Karambit | Fade (Factory New)"
   *   Vanilla Knife:    "★ Karambit"
   *
   * @param {{ weapon: string, skin: string }} item
   * @param {string|null} wearTier  'fn'|'mw'|'ft'|'ww'|'bs'|null
   * @param {boolean} [statTrak=false]
   * @returns {string}
   */
  buildSkinHashName(item, wearTier, statTrak = false, souvenir = false) {
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

    if (souvenir) return `Souvenir ${item.weapon} | ${item.skin} (${wear})`;

    return statTrak
      ? `StatTrak™ ${item.weapon} | ${item.skin} (${wear})`
      : `${item.weapon} | ${item.skin} (${wear})`;
  },

  /** @param {string} caseName @returns {string} */
  buildCaseHashName(caseName) {
    return caseName;
  },

  /**
   * Kicks off the Skinport bulk load immediately in the background.
   * Call once at app startup so prices are warm by the time the market opens.
   */
  warmup() {
    _ensureBulkLoaded();
  },
};
