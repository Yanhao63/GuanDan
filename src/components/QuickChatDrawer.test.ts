import { describe, expect, it } from 'vitest';
import { quickEmojis, quickPhrases } from './QuickChatDrawer';

describe('quick chat choices', () => {
  it('includes the requested table phrases', () => {
    expect(quickPhrases).toEqual(expect.arrayContaining([
      'NB',
      '快点出',
      '杀!!!!!',
      '你的炸太大了',
    ]));
  });

  it('sends emoji-only values and includes the poop emoji', () => {
    const poop = quickEmojis.find((emoji) => emoji.label === '大便');
    expect(poop).toEqual({ icon: '💩', label: '大便' });
    expect(quickEmojis.every((emoji) => emoji.icon.includes(emoji.label))).toBe(false);
  });
});
