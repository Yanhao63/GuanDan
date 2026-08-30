import { describe, expect, it } from 'vitest';
import { getTurnProgress } from './TurnProgressBar';

describe('turn progress bar', () => {
  it('returns the remaining percentage without exposing seconds', () => {
    expect(getTurnProgress('30秒', 40_000, 25_000)).toBe(50);
    expect(getTurnProgress('60秒', 10_000, 20_000)).toBe(0);
    expect(getTurnProgress('90秒', 100_000, 0)).toBe(100);
  });

  it('stays hidden for an unlimited table', () => {
    expect(getTurnProgress('不限时', null, 0)).toBeNull();
  });
});
