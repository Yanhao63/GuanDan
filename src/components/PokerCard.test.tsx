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

  it('exposes a clear before or after insertion target while sorting', () => {
    const markup = renderToStaticMarkup(
      <PokerCard
        card={heartFive}
        dragPlacement="after"
        dragTarget
        index={0}
        level="5"
        onToggle={() => undefined}
        selected={false}
      />,
    );

    expect(markup).toContain('poker-card-drag-target-after');
    expect(markup).toContain('data-drop-placement="after"');
  });
});
