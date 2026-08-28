import type { PlayComparison, PlayInterpretation } from './types';

function isBombFamily(play: PlayInterpretation): boolean {
  return play.bombTier > 0;
}

export function comparePlays(challenger: PlayInterpretation, current: PlayInterpretation): PlayComparison {
  const challengerIsBomb = isBombFamily(challenger);
  const currentIsBomb = isBombFamily(current);

  if (challengerIsBomb || currentIsBomb) {
    if (!challengerIsBomb) {
      return { canBeat: false, reason: 'bomb-required' };
    }
    if (!currentIsBomb) {
      return { canBeat: true, reason: 'higher' };
    }
    if (challenger.bombTier !== current.bombTier) {
      return challenger.bombTier > current.bombTier
        ? { canBeat: true, reason: 'higher' }
        : { canBeat: false, reason: 'lower' };
    }
    if (challenger.primaryStrength === current.primaryStrength) {
      return { canBeat: false, reason: 'equal' };
    }
    return challenger.primaryStrength > current.primaryStrength
      ? { canBeat: true, reason: 'higher' }
      : { canBeat: false, reason: 'lower' };
  }

  if (challenger.kind !== current.kind) {
    return { canBeat: false, reason: 'different-kind' };
  }
  if (challenger.cardCount !== current.cardCount) {
    return { canBeat: false, reason: 'different-size' };
  }
  if (challenger.primaryStrength === current.primaryStrength) {
    return { canBeat: false, reason: 'equal' };
  }
  return challenger.primaryStrength > current.primaryStrength
    ? { canBeat: true, reason: 'higher' }
    : { canBeat: false, reason: 'lower' };
}
