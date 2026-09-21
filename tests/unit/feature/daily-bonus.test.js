import { describe, expect, it } from 'vitest';
import { formatDailyBonusCountdown } from '../../../src/feature/daily-bonus.js';

describe('formatDailyBonusCountdown', () => {
  it('formats a full 24-hour cooldown', () => {
    expect(formatDailyBonusCountdown(24 * 60 * 60 * 1000)).toBe('24:00:00');
  });

  it('rounds partial seconds up so the timer never reaches zero early', () => {
    expect(formatDailyBonusCountdown(3_661_001)).toBe('01:01:02');
    expect(formatDailyBonusCountdown(1)).toBe('00:00:01');
    expect(formatDailyBonusCountdown(0)).toBe('00:00:00');
  });
});
