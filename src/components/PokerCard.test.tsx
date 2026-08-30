import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CardData } from '../game/types';
import { PokerCard } from './PokerCard';

const heartTwo: CardData = { deck: 1, id: 'heart-two', rank: '2', suit: 'hearts' };
const heartFive: CardData = { deck: 1, id: 'heart-five', rank: '5', suit: 'hearts' };

describe('PokerCard dynamic level marker', () => {
  it('marks only the heart card matching the current level as 赖子', () => {
    const twoMarkup = renderToStaticMarkup(
      <PokerCard card={heartTwo} index={0} level="5" onToggle={() => undefined} selected={false} />,
    );
    const fiveMarkup = renderToStaticMarkup(
      <PokerCard card={heartFive} index={0} level="5" onToggle={() => undefined} selected={false} />,
    );

    expect(twoMarkup).not.toContain('赖子');
    expect(twoMarkup).not.toContain('poker-card-wild');
    expect(fiveMarkup).toContain('赖子5♥');
    expect(fiveMarkup).toContain('poker-card-wild');
    expect(fiveMarkup).not.toContain('百搭');
  });
});
