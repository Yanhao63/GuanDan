import type { CardData, Rank } from '../types';
import { FIVE_CARD_SEQUENCES, PLAIN_RANKS_ASCENDING, getBombTier, getRankStrength, isPlainRank } from './ranks';
import type { PlainRank, PlainSuit, PlayInterpretation, WildcardAssignment } from './types';

function isWildcard(card: CardData, level: PlainRank): boolean {
  return card.rank === level && card.suit === 'hearts';
}

function hasUniqueCardIds(cards: CardData[]): boolean {
  return new Set(cards.map((card) => card.id)).size === cards.length;
}

function assignWildcards(
  wildcards: CardData[],
  representedRanks: PlainRank[],
  representedSuit?: PlainSuit,
): WildcardAssignment[] {
  return wildcards.map((wildcard, index) => ({
    cardId: wildcard.id,
    represents: {
      rank: representedRanks[index],
      ...(representedSuit === undefined ? {} : { suit: representedSuit }),
    },
  }));
}

function makeSameRankInterpretation(
  cards: CardData[],
  level: PlainRank,
  rank: Rank,
  kind: 'pair' | 'triple' | 'bomb',
  wildcards: CardData[],
): PlayInterpretation {
  const wildcardAssignments = isPlainRank(rank)
    ? assignWildcards(wildcards, wildcards.map(() => rank))
    : [];
  const bombTier = kind === 'bomb' ? getBombTier('bomb', cards.length) : 0;

  return {
    kind,
    cards,
    primaryRank: rank,
    primaryStrength: getRankStrength(rank, level),
    cardCount: cards.length,
    bombTier,
    wildcardAssignments,
    description: kind === 'bomb' ? `${cards.length} 张${rank}炸弹` : `${rank}${kind === 'pair' ? '对子' : '三张'}`,
  };
}

function classifySameRank(
  cards: CardData[],
  level: PlainRank,
  kind: 'pair' | 'triple' | 'bomb',
): PlayInterpretation[] {
  const wildcards = cards.filter((card) => isWildcard(card, level));
  const fixedCards = cards.filter((card) => !isWildcard(card, level));
  const fixedRanks = [...new Set(fixedCards.map((card) => card.rank))];

  if (fixedRanks.length > 1) {
    return [];
  }

  if (fixedRanks.length === 1) {
    const rank = fixedRanks[0];
    if (!isPlainRank(rank) && wildcards.length > 0) {
      return [];
    }
    return [makeSameRankInterpretation(cards, level, rank, kind, wildcards)];
  }

  if (wildcards.length !== cards.length || kind === 'bomb') {
    return [];
  }

  return PLAIN_RANKS_ASCENDING.map((rank) =>
    makeSameRankInterpretation(cards, level, rank, kind, wildcards),
  );
}

function classifySequence(cards: CardData[], level: PlainRank, requireFlush: boolean): PlayInterpretation[] {
  const wildcards = cards.filter((card) => isWildcard(card, level));
  const fixedCards = cards.filter((card) => !isWildcard(card, level));

  if (fixedCards.some((card) => !isPlainRank(card.rank) || card.suit === 'joker')) {
    return [];
  }

  const fixedRanks = fixedCards.map((card) => card.rank as PlainRank);
  if (new Set(fixedRanks).size !== fixedRanks.length) {
    return [];
  }

  const fixedSuits = [...new Set(fixedCards.map((card) => card.suit as PlainSuit))];
  if (requireFlush && fixedSuits.length > 1) {
    return [];
  }

  return FIVE_CARD_SEQUENCES.flatMap((sequence) => {
    if (!fixedRanks.every((rank) => sequence.ranks.includes(rank))) {
      return [];
    }

    const missingRanks = sequence.ranks.filter((rank) => !fixedRanks.includes(rank));
    if (missingRanks.length !== wildcards.length) {
      return [];
    }

    const flushSuit = requireFlush
      ? (fixedSuits[0] ?? 'spades')
      : undefined;
    const kind = requireFlush ? 'straight-flush' : 'straight';

    return [{
      kind,
      cards,
      primaryRank: sequence.ranks[sequence.ranks.length - 1],
      primaryStrength: sequence.strength,
      cardCount: cards.length,
      bombTier: requireFlush ? getBombTier('straight-flush', cards.length) : 0,
      wildcardAssignments: assignWildcards(wildcards, missingRanks, flushSuit),
      description: `${requireFlush ? '同花顺' : '顺子'} ${sequence.label}`,
    } satisfies PlayInterpretation];
  });
}

function classifyTripleWithPair(cards: CardData[], level: PlainRank): PlayInterpretation[] {
  const wildcards = cards.filter((card) => isWildcard(card, level));
  const fixedCards = cards.filter((card) => !isWildcard(card, level));

  if (fixedCards.some((card) => !isPlainRank(card.rank))) {
    return [];
  }

  const fixedCounts = new Map<PlainRank, number>();
  fixedCards.forEach((card) => {
    const rank = card.rank as PlainRank;
    fixedCounts.set(rank, (fixedCounts.get(rank) ?? 0) + 1);
  });

  return PLAIN_RANKS_ASCENDING.flatMap((tripleRank) =>
    PLAIN_RANKS_ASCENDING.flatMap((pairRank) => {
      if (pairRank === tripleRank) {
        return [];
      }

      const targetCounts = new Map<PlainRank, number>([
        [tripleRank, 3],
        [pairRank, 2],
      ]);
      const fixedCardsFit = [...fixedCounts.entries()].every(
        ([rank, count]) => count <= (targetCounts.get(rank) ?? 0),
      );
      if (!fixedCardsFit) {
        return [];
      }

      const missingRanks = [
        ...Array.from({ length: 3 - (fixedCounts.get(tripleRank) ?? 0) }, () => tripleRank),
        ...Array.from({ length: 2 - (fixedCounts.get(pairRank) ?? 0) }, () => pairRank),
      ];
      if (missingRanks.length !== wildcards.length) {
        return [];
      }

      return [{
        kind: 'triple-with-pair',
        cards,
        primaryRank: tripleRank,
        primaryStrength: getRankStrength(tripleRank, level),
        cardCount: 5,
        bombTier: 0,
        wildcardAssignments: assignWildcards(wildcards, missingRanks),
        description: `三张 ${tripleRank} 带 ${pairRank} 对`,
      } satisfies PlayInterpretation];
    }),
  );
}

function classifyFourJokers(cards: CardData[]): PlayInterpretation[] {
  if (cards.length !== 4) {
    return [];
  }
  const bigJokers = cards.filter((card) => card.rank === '大王').length;
  const smallJokers = cards.filter((card) => card.rank === '小王').length;
  if (bigJokers !== 2 || smallJokers !== 2) {
    return [];
  }

  return [{
    kind: 'four-jokers',
    cards,
    primaryRank: '大王',
    primaryStrength: 0,
    cardCount: 4,
    bombTier: getBombTier('four-jokers', 4),
    wildcardAssignments: [],
    description: '四王炸',
  }];
}

function deduplicateInterpretations(interpretations: PlayInterpretation[]): PlayInterpretation[] {
  const seen = new Set<string>();
  return interpretations.filter((interpretation) => {
    const assignments = interpretation.wildcardAssignments
      .map((assignment) => `${assignment.cardId}:${assignment.represents.rank}:${assignment.represents.suit ?? ''}`)
      .sort()
      .join('|');
    const signature = `${interpretation.kind}:${interpretation.primaryStrength}:${assignments}`;
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

export function classifyPlay(cards: CardData[], level: PlainRank): PlayInterpretation[] {
  if (cards.length === 0 || cards.length > 10 || !hasUniqueCardIds(cards)) {
    return [];
  }

  if (cards.length === 1) {
    const card = cards[0];
    return [{
      kind: 'single',
      cards,
      primaryRank: card.rank,
      primaryStrength: getRankStrength(card.rank, level),
      cardCount: 1,
      bombTier: 0,
      wildcardAssignments: [],
      description: `单张 ${card.rank}`,
    }];
  }

  const interpretations: PlayInterpretation[] = [];

  if (cards.length === 2) {
    interpretations.push(...classifySameRank(cards, level, 'pair'));
  }
  if (cards.length === 3) {
    interpretations.push(...classifySameRank(cards, level, 'triple'));
  }
  if (cards.length === 4) {
    interpretations.push(...classifyFourJokers(cards));
  }
  if (cards.length >= 4) {
    interpretations.push(...classifySameRank(cards, level, 'bomb'));
  }
  if (cards.length === 5) {
    interpretations.push(...classifyTripleWithPair(cards, level));
    interpretations.push(...classifySequence(cards, level, false));
    interpretations.push(...classifySequence(cards, level, true));
  }

  return deduplicateInterpretations(interpretations);
}
