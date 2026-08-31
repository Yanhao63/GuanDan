import type { RoomPlayEvent } from '../game/room';
import type { Suit } from '../game/types';

const suitNames: Partial<Record<Suit, string>> = {
  clubs: '梅花',
  diamonds: '方块',
  hearts: '红桃',
  spades: '黑桃',
};

const spokenRanks: Record<string, string> = {
  '2': '二',
  '3': '三',
  '4': '四',
  '5': '五',
  '6': '六',
  '7': '七',
  '8': '八',
  '9': '九',
  '10': '十',
  A: '尖',
  J: '勾',
  Q: '圈',
};

function speakRank(rank: string): string {
  const trimmed = rank.trim();
  return spokenRanks[trimmed] ?? trimmed;
}

function speakSequence(label: string): string {
  return label.split('-').map(speakRank).join(' ');
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
    return `三张${speakRank(fullHouse[1])}带对${speakRank(fullHouse[2])}`;
  }

  const consecutivePairs = /^三连对\s+(.+)$/.exec(description);
  if (consecutivePairs !== null) {
    return `木板${speakSequence(consecutivePairs[1])}`;
  }

  const steelPlate = /^钢板\s+(.+?)-(.+)$/.exec(description);
  if (steelPlate !== null) {
    return `三个${speakRank(steelPlate[1])}三个${speakRank(steelPlate[2])}`;
  }

  const straightFlush = /^同花顺\s+(.+)$/.exec(description);
  if (straightFlush !== null) {
    return `${getStraightFlushSuit(event)}${speakSequence(straightFlush[1])}同花顺`;
  }

  const straight = /^顺子\s+(.+)$/.exec(description);
  if (straight !== null) {
    return `顺子${speakSequence(straight[1])}`;
  }

  const bomb = /^(\d+)\s*张(.+?)炸弹$/.exec(description);
  if (bomb !== null) {
    return `${speakRank(bomb[1])}张${speakRank(bomb[2])}炸炸炸`;
  }

  const single = /^单张\s+(.+)$/.exec(description);
  if (single !== null) {
    return `一张${speakRank(single[1])}`;
  }

  const pair = /^(.+?)对子$/.exec(description);
  if (pair !== null) {
    return `一对${speakRank(pair[1])}`;
  }

  const triple = /^(.+?)三张$/.exec(description);
  if (triple !== null) {
    return `三张${speakRank(triple[1])}`;
  }

  return description.replaceAll('J', '勾').replaceAll('Q', '圈').replaceAll('A', '尖');
}
