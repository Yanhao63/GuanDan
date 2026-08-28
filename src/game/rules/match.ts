import type { PlainRank } from './types';

export type Seat = 0 | 1 | 2 | 3;
export type TeamId = 'team-a' | 'team-b';

export interface TeamProgress {
  level: PlainRank;
  aFailures: number;
}

export interface MatchProgress {
  'team-a': TeamProgress;
  'team-b': TeamProgress;
}

export interface DealSettlement {
  headTeam: TeamId;
  upgradedBy: 1 | 2 | 3;
  nextLevel: PlainRank;
  teams: MatchProgress;
  matchWinner: TeamId | null;
}

const LEVELS: PlainRank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

export function getTeamForSeat(seat: Seat): TeamId {
  return seat % 2 === 0 ? 'team-a' : 'team-b';
}

function cloneProgress(progress: MatchProgress): MatchProgress {
  return {
    'team-a': { ...progress['team-a'] },
    'team-b': { ...progress['team-b'] },
  };
}

function validateFinishOrder(finishOrder: Seat[]): void {
  const isDoubleDown = finishOrder.length === 2
    && getTeamForSeat(finishOrder[0]) === getTeamForSeat(finishOrder[1]);
  const isCompleteOrder = finishOrder.length === 4;

  if ((!isDoubleDown && !isCompleteOrder) || new Set(finishOrder).size !== finishOrder.length) {
    throw new Error('名次必须是同队头游、二游，或四个不重复座位的完整顺序');
  }
}

function advanceLevel(level: PlainRank, steps: number): PlainRank {
  const currentIndex = LEVELS.indexOf(level);
  return LEVELS[Math.min(currentIndex + steps, LEVELS.length - 1)];
}

function getUpgradeSteps(finishOrder: Seat[]): 1 | 2 | 3 {
  const headTeam = getTeamForSeat(finishOrder[0]);
  const teammateIndex = finishOrder.findIndex(
    (seat, index) => index > 0 && getTeamForSeat(seat) === headTeam,
  );

  if (teammateIndex === 1) {
    return 3;
  }
  if (teammateIndex === 2) {
    return 2;
  }
  return 1;
}

function recordAFailure(team: TeamProgress): TeamProgress {
  const failures = team.aFailures + 1;
  return failures >= 3
    ? { level: '2', aFailures: 0 }
    : { level: 'A', aFailures: failures };
}

export function settleDeal(progress: MatchProgress, finishOrder: Seat[]): DealSettlement {
  validateFinishOrder(finishOrder);

  const teams = cloneProgress(progress);
  const headTeam = getTeamForSeat(finishOrder[0]);
  const upgradedBy = getUpgradeSteps(finishOrder);
  const headProgress = teams[headTeam];
  const headTeamPassedA = headProgress.level === 'A' && upgradedBy >= 2;
  const matchWinner = headTeamPassedA ? headTeam : null;

  if (headProgress.level !== 'A') {
    teams[headTeam] = {
      level: advanceLevel(headProgress.level, upgradedBy),
      aFailures: 0,
    };
  }

  for (const teamId of ['team-a', 'team-b'] as const) {
    if (progress[teamId].level !== 'A' || teamId === matchWinner) {
      continue;
    }

    const teamHasHead = teamId === headTeam;
    if (!teamHasHead || upgradedBy === 1) {
      teams[teamId] = recordAFailure(progress[teamId]);
    }
  }

  return {
    headTeam,
    upgradedBy,
    nextLevel: teams[headTeam].level,
    teams,
    matchWinner,
  };
}
