import { CaseDataStore } from '../foundation/case-data-store.js';

const PLACEHOLDER_SIZE_PX = 250;

const PLACEHOLDER_COLORS = {
  mil_spec:     '#4B69FF',
  restricted:   '#8847FF',
  classified:   '#D32EE6',
  covert:       '#EB4B4B',
  rare_special: '#E4AE39',
  unknown:      '#808080',
};

// URLs that loaded successfully — getImage will set src to the real URL
const _loadedUrls = new Set();
// URLs whose network fetch failed
const _failedUrls = new Set();
// rarity key → data URI string (canvas-generated once, reused as src for new <img> elements)
const _placeholderSrcs = new Map();

function _loadUrl(url) {
  return new Promise(resolve => {
    const img   = new Image();
    img.onload  = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src     = url;
  });
}

function _getPlaceholderSrc(rarity) {
  const key = rarity ?? 'unknown';
  if (_placeholderSrcs.has(key)) return _placeholderSrcs.get(key);

  const color  = PLACEHOLDER_COLORS[key] ?? PLACEHOLDER_COLORS.unknown;
  const canvas = document.createElement('canvas');
  canvas.width  = PLACEHOLDER_SIZE_PX;
  canvas.height = PLACEHOLDER_SIZE_PX;
  const ctx    = canvas.getContext('2d');
  let   src    = '';
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, PLACEHOLDER_SIZE_PX, PLACEHOLDER_SIZE_PX);
    src = canvas.toDataURL();
  }
  // E7: ctx null (headless env) — src stays '', renders as broken-image glyph
  _placeholderSrcs.set(key, src);
  return src;
}

function _makeImg(src) {
  const img = new Image();
  img.src   = src;
  return img;
}

/**
 * Stateful image cache for all skin and case artwork.
 * Call `preloadCase(caseId)` before `getImage()` for items in that case.
 * Each call to `getImage` / `getPlaceholder` returns a **new** HTMLImageElement
 * so the same src can be inserted into multiple DOM positions simultaneously.
 *
 * @example
 * await SkinImageLoader.preloadCase('recoil_case');
 * const img = SkinImageLoader.getImage(item.image_url, 'covert');
 * cardEl.appendChild(img);
 */
export const SkinImageLoader = {
  /**
   * Fetches all images for a case in parallel. Resolves after all settle.
   * URLs already settled are not re-fetched.
   *
   * @param {string} caseId
   * @returns {Promise<{loaded: number, failed: number, skipped: number}>}
   * @example
   * const { loaded, failed } = await SkinImageLoader.preloadCase('recoil_case');
   */
  async preloadCase(caseId) {
    const items = CaseDataStore.getAllItems(caseId);
    let loaded = 0, failed = 0, skipped = 0;

    await Promise.allSettled(items.map(async item => {
      const url = item.image_url ?? null;

      if (!url) { skipped++; return; }

      // Already settled — report historical outcome without re-fetching
      if (_loadedUrls.has(url)) { loaded++; return; }
      if (_failedUrls.has(url)) { failed++; return; }

      const ok = await _loadUrl(url);
      if (ok) { _loadedUrls.add(url); loaded++; }
      else    { _failedUrls.add(url); failed++; }
    }));

    return { loaded, failed, skipped };
  },

  /**
   * Returns a fresh HTMLImageElement for `imageUrl` (if preloaded successfully),
   * or a rarity-colored placeholder. Always returns an element — never null.
   *
   * @param {string|null} imageUrl
   * @param {string}      rarity - rarity tier key (e.g. 'covert')
   * @returns {HTMLImageElement}
   * @example
   * cardEl.appendChild(SkinImageLoader.getImage(item.image_url, 'mil_spec'));
   */
  getImage(imageUrl, rarity) {
    if (imageUrl && _loadedUrls.has(imageUrl)) return _makeImg(imageUrl);
    return this.getPlaceholder(rarity);
  },

  /**
   * Returns an HTMLImageElement that loads `imageUrl` lazily without requiring
   * a prior `preloadCase` call. Falls back to a rarity placeholder on error.
   * Use this wherever images haven't been batch-preloaded (e.g. market rows).
   *
   * @param {string|null} imageUrl
   * @param {string}      rarity
   * @returns {HTMLImageElement}
   * @example
   * marketRow.appendChild(SkinImageLoader.getLazyImage(item.image_url, 'covert'));
   */
  getLazyImage(imageUrl, rarity) {
    if (!imageUrl) return this.getPlaceholder(rarity);
    if (_loadedUrls.has(imageUrl)) return _makeImg(imageUrl);
    if (_failedUrls.has(imageUrl)) return this.getPlaceholder(rarity);
    const img = new Image();
    img.onload  = () => _loadedUrls.add(imageUrl);
    img.onerror = () => { _failedUrls.add(imageUrl); img.src = _getPlaceholderSrc(rarity); };
    img.src = imageUrl;
    return img;
  },

  /**
   * Returns a fresh rarity-colored placeholder HTMLImageElement.
   * The canvas data URI is generated once per rarity and cached; only the
   * wrapping <img> element is new on each call.
   *
   * @param {string} rarity - rarity tier key
   * @returns {HTMLImageElement}
   * @example
   * cardEl.appendChild(SkinImageLoader.getPlaceholder('rare_special'));
   */
  getPlaceholder(rarity) {
    return _makeImg(_getPlaceholderSrc(rarity));
  },

  /**
   * Clears all caches. For testing only — never called at runtime.
   * @example SkinImageLoader.clearCache(); // in beforeEach
   */
  clearCache() {
    _loadedUrls.clear();
    _failedUrls.clear();
    _placeholderSrcs.clear();
  },
};
