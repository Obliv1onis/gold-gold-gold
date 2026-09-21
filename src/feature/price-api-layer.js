import { Events } from '../foundation/events.js';

/**
 * Live skin price layer.
 *
 * The bundled Steam-only snapshot provides immediate prices for the full
 * catalogue. Visible listings are then refreshed through Steam Community
 * Market priceoverview so displayed prices converge on the current lowest
 * sell listing without blocking initial rendering.
 *
 * In development, Steam is proxied through the Vite dev server to avoid CORS.
 * In production VITE_PRICE_API_BASE points to the serverless Steam proxy.
 *
 * After a price is resolved, Events.PRICE_UPDATED fires on document:
 *   { detail: { hashName: string, price: number } }
 *
 * @example
 * PriceAPILayer.prefetch('AWP | Dragon Lore (Factory New)');
 * document.addEventListener(Events.PRICE_UPDATED, e => console.log(e.detail));
 */

const STEAM_URL    = import.meta.env?.VITE_PRICE_API_BASE ?? '/api/steam';
const SNAPSHOT_URL = '/data/steam-prices.json';
const CACHE_TTL    = 10 * 60 * 1000; // 10 minutes
const STEAM_DELAY  = 300;             // ms between Steam fallback requests
const APPID        = 730;
const CURRENCY     = 1;               // USD
const COUNTRY      = 'US';

const WEAR_LABELS = {
  fn: 'Factory New',
  mw: 'Minimal Wear',
  ft: 'Field-Tested',
  ww: 'Well-Worn',
  bs: 'Battle-Scarred',
};

// Price cache: hashName → { price: number, fetchedAt: number }
const _cache = new Map();

// ── Bundled Steam snapshot loader ───────────────────────────────────────────

let _snapshotLoadPromise = null;
let _snapshotPrices = null;
let _snapshotVerifiedAt = 0;

function _snapshotEntry(hashName) {
  const quote = _snapshotPrices?.[hashName];
  if (!(quote?.price > 0)) return null;
  const parsedAt = Date.parse(quote.updated_at ?? '');
  return {
    price: quote.price,
    fetchedAt: Number.isFinite(parsedAt) ? parsedAt : _snapshotVerifiedAt,
    source: 'steam',
  };
}

function _cachedEntry(hashName) {
  return _cache.get(hashName) ?? _snapshotEntry(hashName);
}

async function _loadSteamSnapshot() {
  try {
    const res = await fetch(SNAPSHOT_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
    const snapshot = await res.json();
    _snapshotPrices = snapshot.prices ?? {};
    const verifiedAt = Date.parse(snapshot.catalog?.verified_at ?? '');
    _snapshotVerifiedAt = Number.isFinite(verifiedAt) ? verifiedAt : 0;
    const count = snapshot.catalog?.items ?? Object.keys(_snapshotPrices).length;
    console.info(`[PriceAPILayer] Loaded ${count} bundled Steam prices`);
  } catch (err) {
    console.warn('[PriceAPILayer] Steam snapshot load failed; using live requests:', err.message);
  }
}

function _ensureSnapshotLoaded() {
  if (!_snapshotLoadPromise) _snapshotLoadPromise = _loadSteamSnapshot();
  return _snapshotLoadPromise;
}

// ── Steam per-item fallback ─────────────────────────────────────────────────

const _steamQueue   = [];
const _steamPending = new Map();
let   _steamRunning = false;

function _parsePriceStr(str) {
  if (!str || typeof str !== 'string') return null;
  const n = parseFloat(str.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function _fetchSteam(hashName) {
  const url = `${STEAM_URL}?currency=${CURRENCY}&country=${COUNTRY}&appid=${APPID}&market_hash_name=${encodeURIComponent(hashName)}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Steam HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error('Steam success: false');
  const price = _parsePriceStr(data.lowest_price ?? data.median_price);
  if (price === null) throw new Error('No valid price in Steam response');
  return price;
}

async function _runSteamQueue() {
  _steamRunning = true;
  while (_steamQueue.length) {
    const { hashName, resolve, reject } = _steamQueue.shift();
    try {
      const price = await _fetchSteam(hashName);
      _cache.set(hashName, { price, fetchedAt: Date.now(), source: 'steam' });
      document.dispatchEvent(new CustomEvent(Events.PRICE_UPDATED, {
        detail: { hashName, price, source: 'steam' },
      }));
      resolve(price);
    } catch (err) {
      reject(err);
    } finally {
      _steamPending.delete(hashName);
    }
    if (_steamQueue.length) await new Promise(r => setTimeout(r, STEAM_DELAY));
  }
  _steamRunning = false;
}

function _enqueueSteam(hashName) {
  if (_steamPending.has(hashName)) return _steamPending.get(hashName);
  const request = new Promise((resolve, reject) => {
    _steamQueue.push({ hashName, resolve, reject });
    if (!_steamRunning) _runSteamQueue();
  });
  _steamPending.set(hashName, request);
  return request;
}

// ── Public API ──────────────────────────────────────────────────────────────

export const PriceAPILayer = {
  /**
   * Returns the cached price synchronously, or null if not yet fetched.
   * @param {string} hashName
   * @returns {number|null}
   */
  getCachedPrice(hashName, source = null) {
    const entry = _cachedEntry(hashName);
    if (source && entry?.source !== source) return null;
    return entry?.price ?? null;
  },

  /**
   * Resolves to the live price for hashName.
   * Uses a fresh cached Steam quote or refreshes the item from Steam.
   * @param {string} hashName
   * @returns {Promise<number>}
   */
  async getPrice(hashName) {
    await _ensureSnapshotLoaded();
    const entry = _cachedEntry(hashName);
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) return entry.price;
    try {
      return await _enqueueSteam(hashName);
    } catch (error) {
      if (entry) return entry.price;
      throw error;
    }
  },

  /**
   * Emits a snapshot price immediately, then refreshes stale entries from Steam.
   * @param {string} hashName
   */
  prefetch(hashName) {
    _ensureSnapshotLoaded().then(() => {
      const entry = _cachedEntry(hashName);
      if (entry) {
        Promise.resolve().then(() => {
          document.dispatchEvent(new CustomEvent(Events.PRICE_UPDATED, {
            detail: { hashName, price: entry.price, source: 'steam' },
          }));
        });
      }
      if (!entry || Date.now() - entry.fetchedAt >= CACHE_TTL) {
        _enqueueSteam(hashName).catch(() => {});
      }
    });
  },

  /** Compatibility alias: all catalogue and live prices now come from Steam. */
  prefetchSteam(hashName) {
    this.prefetch(hashName);
  },

  /**
   * Builds the Steam market hash name for a skin.
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
   * Loads the bundled Steam snapshot immediately in the background.
   * Call once at app startup so prices are warm by the time the market opens.
   */
  warmup() {
    _ensureSnapshotLoaded();
  },
};
