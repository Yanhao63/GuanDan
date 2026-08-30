import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RoomDealHistory, RoomPlayerView } from '../game/room';
import { PlayHistoryDrawer } from './PlayHistoryDrawer';

const players: RoomPlayerView[] = [0, 1, 2, 3].map((seat) => ({
  cardCount: null,
  connected: true,
  controlledByBot: false,
  isHost: seat === 0,
  kind: 'human',
  nickname: ['甲', '乙', '丙', '丁'][seat],
  seat: seat as 0 | 1 | 2 | 3,
}));

const history: RoomDealHistory[] = [
  {
    dealNumber: 4,
    entries: [{ cards: [], description: '不要', id: 1, kind: 'pass', player: 3 }],
  },
  {
    dealNumber: 5,
    entries: [{
      cards: [{ deck: 1, id: '5-club', rank: '5', suit: 'clubs' }],
      description: '单张 5',
      id: 2,
      kind: 'play',
      player: 1,
    }],
  },
];

describe('play history drawer', () => {
  it('shows a two-deal secondary menu and defaults to the latest deal', () => {
    const markup = renderToStaticMarkup(
      <PlayHistoryDrawer history={history} onClose={() => undefined} players={players} selfSeat={0} />,
    );

    expect(markup).toContain('第 5 副');
    expect(markup).toContain('第 4 副');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('乙');
    expect(markup).toContain('右手边');
    expect(markup).toContain('单张 5');
    expect(markup).not.toContain('选择不要，轮到下一位');
  });
});
