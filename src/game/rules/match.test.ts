import { describe, expect, it } from 'vitest';
import { settleDeal, type MatchProgress } from './match';

function progress(
  teamALevel: MatchProgress['team-a']['level'] = '2',
  teamBLevel: MatchProgress['team-b']['level'] = '2',
  teamAFailures = 0,
  teamBFailures = 0,
): MatchProgress {
  return {
    'team-a': { level: teamALevel, aFailures: teamAFailures },
    'team-b': { level: teamBLevel, aFailures: teamBFailures },
  };
}

describe('settleDeal', () => {
  it('upgrades three levels when head and second place are teammates', () => {
    const result = settleDeal(progress(), [0, 2]);

    expect(result).toMatchObject({ headTeam: 'team-a', upgradedBy: 3, nextLevel: '5' });
    expect(result.teams['team-a']).toEqual({ level: '5', aFailures: 0 });
  });

  it('upgrades two or one levels for head plus third or last place', () => {
    const headAndThird = settleDeal(progress('8'), [0, 1, 2, 3]);
    const headAndLast = settleDeal(progress('8'), [0, 1, 3, 2]);

    expect(headAndThird).toMatchObject({ upgradedBy: 2, nextLevel: '10' });
    expect(headAndLast).toMatchObject({ upgradedBy: 1, nextLevel: '9' });
  });

  it('wins at A only with head plus second or third place', () => {
    const success = settleDeal(progress('A'), [0, 1, 2, 3]);
    const failure = settleDeal(progress('A'), [0, 1, 3, 2]);

    expect(success.matchWinner).toBe('team-a');
    expect(failure.matchWinner).toBeNull();
    expect(failure.teams['team-a']).toEqual({ level: 'A', aFailures: 1 });
  });

  it('counts an A failure when the opponent takes head without clearing prior failures', () => {
    const result = settleDeal(progress('A', '7', 1), [1, 0, 3, 2]);

    expect(result.teams['team-a']).toEqual({ level: 'A', aFailures: 2 });
    expect(result.teams['team-b'].level).toBe('9');
  });

  it('demotes an A team to 2 after its third failure', () => {
    const result = settleDeal(progress('A', '7', 2), [1, 0, 3, 2]);

    expect(result.teams['team-a']).toEqual({ level: '2', aFailures: 0 });
  });

  it('rejects an incomplete finish order that is not a same-team double down', () => {
    expect(() => settleDeal(progress(), [0, 1])).toThrow(/名次/);
  });
});
