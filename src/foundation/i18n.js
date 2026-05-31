/**
 * Minimal i18n module. Supports template variables: t('key', { n: 5 }) → "5 items".
 * Fires 'locale-changed' on document when setLocale() is called.
 *
 * Adding a new language: create src/foundation/languages/<locale>.js,
 * import it below, and add it to TRANSLATIONS.
 */

import enUS from './languages/en-US.js';
import zhCN from './languages/zh-CN.js';

const TRANSLATIONS = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

let _locale = 'en-US';

export const i18n = {
  /** Returns the current locale string. */
  getLocale() { return _locale; },

  /**
   * Sets the active locale and re-applies translations to all [data-i18n] elements.
   * @param {string} locale
   */
  setLocale(locale) {
    if (!TRANSLATIONS[locale] || locale === _locale) return;
    _locale = locale;
    this.applyToDOM();
    document.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale } }));
  },

  /**
   * Returns the translated string for key, interpolating {var} placeholders.
   * Falls back to en-US, then the raw key.
   * @param {string} key
   * @param {Record<string,string|number>} [vars]
   */
  t(key, vars = {}) {
    const str = TRANSLATIONS[_locale]?.[key] ?? TRANSLATIONS['en-US']?.[key] ?? key;
    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  },

  /** Translated wear label for a tier key ('fn'|'mw'|'ft'|'ww'|'bs'). */
  wearLabel(tier) {
    return this.t('wear.' + tier);
  },

  /** Translated case/capsule name, falling back to the original English name. */
  caseName(name) {
    const result = TRANSLATIONS[_locale]?.['case_name.' + name];
    return result ?? name;
  },

  /** Translated rarity label, falling back to title-cased English key. */
  rarityLabel(rarity) {
    const result = TRANSLATIONS[_locale]?.['rarity.' + rarity];
    if (result) return result;
    return rarity ? rarity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
  },

  /**
   * Translated skin display name, falling back to formatted English.
   * Handles knife/glove ★ prefix repositioning for English display.
   * @param {string} weapon
   * @param {string} skin
   */
  skinName(weapon, skin) {
    const full = `${weapon} | ${skin}`;
    const translated = TRANSLATIONS[_locale]?.['skin_name.' + full];
    if (translated) return translated;
    // English fallback — reposition ★ for knives/gloves
    if (skin?.startsWith('★')) {
      const bare = skin.slice(1).trim();
      if (bare.toLowerCase() === 'vanilla') return `★ ${weapon}`;
      return `★ ${weapon} | ${bare}`;
    }
    return full;
  },

  /** Updates every [data-i18n] and [data-i18n-ph] element in the document. */
  applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPh);
    });
  },
};
