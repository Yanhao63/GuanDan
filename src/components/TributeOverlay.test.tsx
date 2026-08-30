import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TributeView } from '../game/room';
import { TributeOverlay } from './TributeOverlay';

const returnTribute: TributeView = {
  action: 'return-tribute',
  choices: [
    { deck: 1, id: 'club-three', rank: '3', suit: 'clubs' },
    { deck: 1, id: 'diamond-four', rank: '4', suit: 'diamonds' },
  ],
  message: '请选择一张十点及以下的牌还给进贡方。',
  mode: 'single',
};

describe('TributeOverlay', () => {
  it('uses the compact tribute header and a labelled horizontal choice area', () => {
    const markup = renderToStaticMarkup(
      <TributeOverlay level="2" onAction={() => undefined} tribute={returnTribute} />,
    );

    expect(markup).toContain('tribute-header');
    expect(markup).toContain('tribute-seal');
    expect(markup).toContain('可选择的贡还牌，共 2 张');
    expect(markup).not.toContain('modal-crest');
  });
});
