// Web Audio API wrapper. All sound is synthesized at runtime — no file fetches.
// State: uninitialized → suspended → active. Calls while suspended are silent no-ops.

export class AudioError extends Error {
  constructor(msg) { super(msg); this.name = 'AudioError'; }
}

let _ctx    = null;  // AudioContext
let _master = null;  // master GainNode

let _musicKitTimer   = null; // setInterval handle for looping melody
let _activeMusicKit  = null; // name of kit currently playing

// FNV-1a 32-bit hash — deterministic seed from a string
function _hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export const AudioSystem = {
  /** 'uninitialized' | 'suspended' | 'active' */
  get state() {
    if (!_ctx) return 'uninitialized';
    return _ctx.state === 'running' ? 'active' : 'suspended';
  },

  /**
   * Creates the AudioContext. Idempotent — subsequent calls are no-ops.
   * Must be called at application startup before any sound method.
   * @example AudioSystem.init();
   */
  init() {
    if (_ctx) return;
    _ctx    = new AudioContext();
    _master = _ctx.createGain();
    _master.gain.value = 0.5;
    _master.connect(_ctx.destination);
  },

  /**
   * Resumes a suspended AudioContext. Must be called on the first user interaction.
   * No-op if already active.
   * @returns {Promise<void>}
   * @example button.addEventListener('click', () => AudioSystem.resume());
   */
  resume() {
    if (!_ctx) throw new AudioError('Call AudioSystem.init() before resume()');
    return _ctx.resume();
  },

  /**
   * Plays a short tick at the given frequency. Silent if context is not active.
   * @param {number} pitch - Frequency in Hz (220–880 for reel ticks)
   * @example AudioSystem.playTick(440);
   */
  playTick(pitch) {
    if (!_ctx || _ctx.state !== 'running') return;
    const osc  = _ctx.createOscillator();
    const gain = _ctx.createGain();
    osc.type            = 'square';
    osc.frequency.value = Math.max(1, pitch);
    gain.gain.value     = 0.3;
    osc.connect(gain);
    gain.connect(_master);
    const now = _ctx.currentTime;
    gain.gain.setTargetAtTime(0, now + 0.01, 0.005);
    osc.start(now);
    osc.stop(now + 0.03);
  },

  /**
   * Plays a three-oscillator reveal chord. Silent if context is not active.
   * @example AudioSystem.playReveal();
   */
  playReveal() {
    if (!_ctx || _ctx.state !== 'running') return;
    [220, 330, 440].forEach(freq => {
      const osc  = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.value     = 0.4;
      osc.connect(gain);
      gain.connect(_master);
      const now = _ctx.currentTime;
      gain.gain.setTargetAtTime(0, now + 0.1, 0.08);
      osc.start(now);
      osc.stop(now + 0.8);
    });
  },

  /**
   * Starts a looping pentatonic melody unique to the given music kit name.
   * Each kit produces a distinct sequence derived from a hash of its name.
   * Calling again with the same name stops the melody (toggle).
   * Calling with a different name switches to that kit.
   * @param {string} kitName
   * @returns {boolean} true if now playing, false if stopped
   * @example AudioSystem.playMusicKit('Music Kit | DRYDEN, Feel The Power');
   */
  playMusicKit(kitName) {
    if (_activeMusicKit === kitName) {
      this.stopMusicKit();
      return false;
    }
    this.stopMusicKit();
    if (!_ctx || _ctx.state !== 'running') return false;

    _activeMusicKit = kitName;
    const seed = _hash(kitName);

    // Root note: one of seven A3–G4 choices
    const ROOTS  = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392];
    const root   = ROOTS[seed % ROOTS.length];
    // Pentatonic semitone intervals — two octaves
    const PENTA  = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    // Build 8-note sequence from seed bits
    const seq = Array.from({ length: 8 }, (_, i) => {
      const idx = ((seed >>> (i * 3)) & 0x7) % PENTA.length;
      const oct = (seed >>> (i + 24)) & 1 ? 0.5 : 1;
      return root * oct * Math.pow(2, PENTA[idx] / 12);
    });

    const bpm     = 80 + (seed % 41);          // 80–120 bpm
    const noteMs  = Math.round(60000 / bpm);   // ms per beat
    let   step    = 0;

    const playNote = () => {
      if (!_ctx || _ctx.state !== 'running') return;
      const freq = seq[step % seq.length];
      const osc  = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type            = 'triangle';
      osc.frequency.value = freq;
      gain.gain.value     = 0.22;
      osc.connect(gain);
      gain.connect(_master);
      const now = _ctx.currentTime;
      gain.gain.setTargetAtTime(0, now + (noteMs / 1000) * 0.65, 0.04);
      osc.start(now);
      osc.stop(now + noteMs / 1000);
      step++;
    };

    playNote();
    _musicKitTimer = setInterval(playNote, noteMs);
    return true;
  },

  /**
   * Stops any currently-playing music kit melody.
   * @example AudioSystem.stopMusicKit();
   */
  stopMusicKit() {
    if (_musicKitTimer) { clearInterval(_musicKitTimer); _musicKitTimer = null; }
    _activeMusicKit = null;
  },

  /** Returns the name of the currently-playing kit, or null. */
  get activeMusicKit() { return _activeMusicKit; },

  /**
   * Plays a short UI click feedback sound. Silent if context is not active.
   * @example AudioSystem.playUIClick();
   */
  playUIClick() {
    if (!_ctx || _ctx.state !== 'running') return;
    const osc  = _ctx.createOscillator();
    const gain = _ctx.createGain();
    osc.type            = 'square';
    osc.frequency.value = 80;
    gain.gain.value     = 0.15;
    osc.connect(gain);
    gain.connect(_master);
    const now = _ctx.currentTime;
    gain.gain.setTargetAtTime(0, now + 0.005, 0.002);
    osc.start(now);
    osc.stop(now + 0.02);
  },
};
