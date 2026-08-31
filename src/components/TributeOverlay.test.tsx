import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TributeView } from '../game/room';
import { TributeOverlay } from './TributeOverlay';

const players = [0, 1, 2, 3].map((seat) => ({
  cardCount: null,
  connected: true,
  controlledByBot: false,
  isHost: seat === 0,
  kind: 'human' as const,
  nickname: ['甲', '乙', '丙', '丁'][seat],
  seat: seat as 0 | 1 | 2 | 3,
}));

const returnTribute: TributeView = {
  action: 'return-tribute',
  choices: [
    { deck: 1, id: 'club-three', rank: '3', suit: 'clubs' },
    { deck: 1, id: 'diamond-four', rank: '4', suit: 'diamonds' },
  ],
  message: '请选择一张十点及以下的牌还给进贡方。',
  mode: 'single',
  revealDeadline: null,
  revealDurationMs: null,
  revealedCards: [],
};

describe('TributeOverlay', () => {
  it('uses the compact tribute header and a labelled horizontal choice area', () => {
    const markup = renderToStaticMarkup(
      <TributeOverlay level="2" onAction={() => undefined} players={players} tribute={returnTribute} />,
    );

    expect(markup).toContain('tribute-header');
    expect(markup).toContain('tribute-seal');
    expect(markup).toContain('可选择的贡还牌，共 2 张');
    expect(markup).not.toContain('modal-crest');
  });

  it('shows every tribute card and a progress bar to all players during reveal', () => {
    const markup = renderToStaticMarkup(
      <TributeOverlay
        level="2"
        onAction={() => undefined}
        players={players}
        tribute={{
          action: 'reveal',
          choices: [],
          message: '两张贡牌公开展示，随后由头游选择',
          mode: 'double',
          revealDeadline: Date.now() + 6_000,
          revealDurationMs: 6_000,
          revealedCards: [
            { card: { deck: 1, id: 'ace-spade', rank: 'A', suit: 'spades' }, source: 1 },
            { card: { deck: 1, id: 'king-heart', rank: 'K', suit: 'hearts' }, source: 3 },
          ],
        }}
      />,
    );

    expect(markup).toContain('贡牌公开');
    expect(markup).toContain('公开的贡牌，共 2 张');
    expect(markup).toContain('乙 进贡');
    expect(markup).toContain('丁 进贡');
    expect(markup).toContain('贡牌公开剩余进度');
  });

  it('shows a timed anti-tribute result instead of silently entering the next deal', () => {
    const markup = renderToStaticMarkup(
      <TributeOverlay
        level="2"
        onAction={() => undefined}
        players={players}
        tribute={{
          action: 'resisted',
          choices: [],
          message: '抗贡成功：进贡方合计持有两张大王，本副无需交换牌',
          mode: 'double',
          revealDeadline: Date.now() + 6_000,
          revealDurationMs: 6_000,
          revealedCards: [],
        }}
      />,
    );

    expect(markup).toContain('抗贡成功');
    expect(markup).toContain('王 · 王');
    expect(markup).toContain('本副免除贡还牌');
    expect(markup).toContain('贡牌公开剩余进度');
  });
});
