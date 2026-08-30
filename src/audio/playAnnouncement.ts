import type { RoomPlayEvent } from '../game/room';
import type { Suit } from '../game/types';

const suitNames: Partial<Record<Suit, string>> = {
  clubs: '梅花',
  diamonds: '方块',
  hearts: '红桃',
  spades: '黑桃',
};

function compactRanks(label: string): string {
  return label.replaceAll('-', '').replaceAll(' ', '');
}

function getStraightFlushSuit(event: RoomPlayEvent): string {
  const counts = new Map<Suit, number>();
  for (const card of event.cards) {
    if (card.suit !== 'joker') {
      counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
    }
  }
  const suit = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  return suit === undefined ? '' : suitNames[suit] ?? '';
}

export function describePlayForSpeech(event: RoomPlayEvent): string {
  const description = event.description.trim();
  if (description === '不要' || description === '四王炸') {
    return description;
  }

  const fullHouse = /^三张\s+(.+?)\s+带\s+(.+?)\s+对$/.exec(description);
  if (fullHouse !== null) {
    return `三张${fullHouse[1]}带对${fullHouse[2]}`;
  }

  const consecutivePairs = /^三连对\s+(.+)$/.exec(description);
  if (consecutivePairs !== null) {
    return `木板${compactRanks(consecutivePairs[1])}`;
  }

  const steelPlate = /^钢板\s+(.+?)-(.+)$/.exec(description);
  if (steelPlate !== null) {
    return `三个${steelPlate[1]}三个${steelPlate[2]}`;
  }

  const straightFlush = /^同花顺\s+(.+)$/.exec(description);
  if (straightFlush !== null) {
    return `${getStraightFlushSuit(event)}${compactRanks(straightFlush[1])}`;
  }

  const straight = /^顺子\s+(.+)$/.exec(description);
  if (straight !== null) {
    return `顺子${compactRanks(straight[1])}`;
  }

  const bomb = /^(\d+)\s*张(.+?)炸弹$/.exec(description);
  if (bomb !== null) {
    return `${bomb[1]}张${bomb[2]}炸炸炸`;
  }

  const single = /^单张\s+(.+)$/.exec(description);
  if (single !== null) {
    return `一张${single[1]}`;
  }

  const pair = /^(.+?)对子$/.exec(description);
  if (pair !== null) {
    return `一对${pair[1]}`;
  }

  const triple = /^(.+?)三张$/.exec(description);
  if (triple !== null) {
    return `三张${triple[1]}`;
  }

  return description;
}
