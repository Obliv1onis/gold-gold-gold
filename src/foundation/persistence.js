// localStorage wrapper. All keys namespaced with vault_ prefix.
// Gracefully degrades when storage is unavailable (Safari private, quota exceeded).
// See ADR-0005 for atomic mutation contract and key schema.

let _available = false;
try {
  localStorage.setItem('__vault_probe__', '1');
  localStorage.removeItem('__vault_probe__');
  _available = true;
} catch (_) { /* private mode or quota exceeded */ }

const PREFIX = 'vault_';

export const Persistence = {
  isAvailable() { return _available; },

  save(key, value) {
    if (!_available) return;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (_) { /* quota exceeded — degrade silently */ }
  },

  load(key, defaultValue = null) {
    if (!_available) return defaultValue;
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    try { return JSON.parse(raw); }
    catch (_) { return defaultValue; }
  },

  delete(key) {
    if (!_available) return;
    localStorage.removeItem(PREFIX + key);
  },

  clearAll() {
    if (!_available) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};
