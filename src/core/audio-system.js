// Web Audio API wrapper. All sound is synthesized at runtime — no file fetches.
// State: uninitialized → suspended → active. Calls while suspended are silent no-ops.

export class AudioError extends Error {
  constructor(msg) { super(msg); this.name = 'AudioError'; }
}

let _ctx    = null;  // AudioContext
let _master = null;  // master GainNode

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
