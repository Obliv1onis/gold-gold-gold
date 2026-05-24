// Vitest global setup — runs before every test file.
// Provides stubs for browser APIs that jsdom does not implement.
// See ADR-0009 for rationale.

// ─── Web Audio API ──────────────────────────────────────────────────────────
// jsdom does not implement AudioContext. All AudioSystem tests use this stub.
globalThis.AudioContext = class {
  get state()       { return 'running'; }
  get currentTime() { return 0; }
  get destination() { return {}; }

  resume()           { return Promise.resolve(); }

  createOscillator() {
    return {
      type: '',
      frequency: { value: 0 },
      connect:   () => this,
      start:     () => {},
      stop:      () => {},
    };
  }

  createGain() {
    return {
      gain: {
        setValueAtTime:              () => {},
        linearRampToValueAtTime:     () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => this,
    };
  }
};

// ─── requestAnimationFrame ───────────────────────────────────────────────────
// Schedules callback as a resolved microtask. Tests that need deterministic
// frame timing should mock requestAnimationFrame directly in their test file.
let _rafId = 0;
globalThis.requestAnimationFrame = (cb) => {
  const id = ++_rafId;
  Promise.resolve().then(() => cb(Date.now()));
  return id;
};
globalThis.cancelAnimationFrame = () => {};

// ─── Canvas 2D ───────────────────────────────────────────────────────────────
// jsdom canvas support is limited. Provides stubs for SkinImageLoader
// placeholder generation (getContext + toDataURL).
HTMLCanvasElement.prototype.getContext = function (type) {
  if (type !== '2d') return null;
  return {
    fillStyle: '',
    fillRect:  () => {},
  };
};
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,placeholder==';

// ─── localStorage ────────────────────────────────────────────────────────────
// jsdom provides localStorage. Tests should call localStorage.clear() in
// beforeEach to prevent state leakage between tests.
// No mock needed — available natively in jsdom.
