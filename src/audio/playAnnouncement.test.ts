import { describe, expect, it } from 'vitest';
import type { RoomPlayEvent } from '../game/room';
import type { CardData } from '../game/types';
import { describePlayForSpeech } from './playAnnouncement';

const spadeTen: CardData = { deck: 1, id: 'spade-ten', rank: '10', suit: 'spades' };

function play(description: string, cards: CardData[] = [spadeTen]): RoomPlayEvent {
  return { cards, description, player: 0 };
}

describe('play voice announcements', () => {
  it.each([
    ['单张 A', '一张尖'],
    ['K对子', '一对K'],
    ['Q三张', '三张圈'],
    ['三张 J 带 9 对', '三张勾带对9'],
    ['三连对 6-7-8', '木板6、7、8'],
    ['三连对 J-Q-K', '木板勾、圈、K'],
    ['钢板 8-9', '三个8三个9'],
    ['顺子 10-J-Q-K-A', '顺子10、勾、圈、K、尖'],
    ['6 张Q炸弹', '6张圈炸炸炸'],
    ['不要', '不要'],
    ['四王炸', '四王炸'],
  ])('turns %s into %s', (description, announcement) => {
    expect(describePlayForSpeech(play(description))).toBe(announcement);
  });

  it('announces a straight flush with its actual fixed-card suit', () => {
    expect(describePlayForSpeech(play('同花顺 10-J-Q-K-A', [
      spadeTen,
      { deck: 1, id: 'spade-jack', rank: 'J', suit: 'spades' },
      { deck: 1, id: 'spade-queen', rank: 'Q', suit: 'spades' },
      { deck: 1, id: 'wild-five', rank: '5', suit: 'hearts' },
      { deck: 2, id: 'wild-five-two', rank: '5', suit: 'hearts' },
    ]))).toBe('黑桃10、勾、圈、K、尖同花顺');
  });
});
