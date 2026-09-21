import { afterEach, describe, expect, it } from 'vitest';
import { MusicKitPlayer } from '../../../src/feature/music-kit-player.js';
import { getMusicKitPreviewId } from '../../../src/foundation/music-kit-previews.js';

afterEach(() => {
  MusicKitPlayer.close();
  document.body.innerHTML = '';
});

describe('MusicKitPlayer', () => {
  it('resolves normal, StatTrak, and upstream naming aliases', () => {
    expect(getMusicKitPreviewId('Music Kit | Matt Levine, Agency')).toBe('Na5KWN7aSk8');
    expect(getMusicKitPreviewId('StatTrak™ Music Kit | Matt Levine, Agency')).toBe('Na5KWN7aSk8');
    expect(getMusicKitPreviewId('Music Kit | TWERL, Ekko & Sidetrack, Under Bright Lights')).toBe('9fg9ic46ik0');
    expect(getMusicKitPreviewId('StatTrak™ Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights')).toBe('9fg9ic46ik0');
  });

  it('opens a playable modal even when an old inventory item has no youtube_id', () => {
    MusicKitPlayer.toggle('Music Kit | Daniel Sadowski, Dead Shot', '');

    const modal = document.querySelector('.music-kit-modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('iframe').src).toContain('/embed/xzTe_0y77O4');
  });
});
