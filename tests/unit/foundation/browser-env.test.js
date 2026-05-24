// Smoke test — verifies the Vitest + jsdom environment has all browser APIs
// needed by Foundation layer modules. Not testing game logic.
// See ADR-0009.

import { describe, it, expect, beforeEach } from 'vitest';

describe('browser environment smoke tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('localStorage is available and isolated between tests', () => {
    localStorage.setItem('vault_test', 'hello');
    expect(localStorage.getItem('vault_test')).toBe('hello');
  });

  it('localStorage.clear() removes all keys', () => {
    localStorage.setItem('vault_a', '1');
    localStorage.setItem('vault_b', '2');
    localStorage.clear();
    expect(localStorage.getItem('vault_a')).toBeNull();
  });

  it('document.dispatchEvent + addEventListener round-trips a CustomEvent', () => {
    const received = [];
    const handler = (e) => received.push(e.detail);
    document.addEventListener('test-event', handler);
    document.dispatchEvent(new CustomEvent('test-event', { detail: { value: 42 } }));
    document.removeEventListener('test-event', handler);
    expect(received).toEqual([{ value: 42 }]);
  });

  it('AudioContext stub is available and resume() resolves', async () => {
    const ctx = new AudioContext();
    await expect(ctx.resume()).resolves.toBeUndefined();
    expect(ctx.state).toBe('running');
  });

  it('AudioContext.createOscillator() returns a stub with frequency', () => {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    osc.frequency.value = 440;
    expect(osc.frequency.value).toBe(440);
  });

  it('Canvas getContext("2d") returns a stub', () => {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    expect(typeof ctx.fillRect).toBe('function');
  });

  it('canvas.toDataURL() returns a data URI string', () => {
    const canvas = document.createElement('canvas');
    expect(canvas.toDataURL()).toMatch(/^data:/);
  });
});
