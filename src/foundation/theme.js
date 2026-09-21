import { Events } from './events.js';
import { Persistence } from './persistence.js';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME = 'dark';
const THEMES = new Set(['dark', 'light']);

let _theme = DEFAULT_THEME;

function _apply(theme, persist) {
  _theme = THEMES.has(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = _theme;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', _theme === 'light' ? '#f4f6f8' : '#0f0f0f');
  if (persist) Persistence.save(STORAGE_KEY, _theme);
  document.dispatchEvent(new CustomEvent(Events.THEME_CHANGED, {
    detail: { theme: _theme },
  }));
  return _theme;
}

export const Theme = {
  init() {
    const restored = Persistence.load(
      STORAGE_KEY,
      document.documentElement.dataset.theme ?? DEFAULT_THEME,
    );
    return _apply(restored, false);
  },

  getTheme() { return _theme; },

  setTheme(theme) {
    return _apply(theme, true);
  },

  toggle() {
    return this.setTheme(_theme === 'dark' ? 'light' : 'dark');
  },
};
