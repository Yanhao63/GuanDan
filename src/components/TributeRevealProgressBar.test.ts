import { describe, expect, it } from 'vitest';
import { getTributeRevealProgress } from './TributeRevealProgressBar';

describe('tribute reveal progress', () => {
  it('counts down as a percentage without displaying seconds', () => {
    expect(getTributeRevealProgress(6_000, 6_000, 0)).toBe(100);
    expect(getTributeRevealProgress(6_000, 6_000, 3_000)).toBe(50);
    expect(getTributeRevealProgress(6_000, 6_000, 7_000)).toBe(0);
  });
});
