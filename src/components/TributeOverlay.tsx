import { useState } from 'react';
import type { RoomPlayerView, TributeAction, TributeView } from '../game/room';
import type { PlainRank } from '../game/rules/types';
import { PokerCard } from './PokerCard';
import { TributeRevealProgressBar } from './TributeRevealProgressBar';

type ActiveTributeAction = Exclude<TributeAction, 'reveal' | 'waiting'>;

interface TributeOverlayProps {
  level: PlainRank;
  onAction: (action: ActiveTributeAction, cardId: string) => void;
  players: RoomPlayerView[];
  tribute: TributeView;
}

const actionLabels: Record<ActiveTributeAction, string> = {
  'choose-double-tribute': '确认分配',
  'pay-tribute': '确认进贡',
  'return-tribute': '确认还贡',
};

export function TributeOverlay({ level, onAction, players, tribute }: TributeOverlayProps) {
  const [selectedId, setSelectedId] = useState('');
  const isReveal = tribute.action === 'reveal';
  const isWaiting = tribute.action === 'waiting';
  const activeAction: ActiveTributeAction | null = tribute.action === 'pay-tribute'
    || tribute.action === 'choose-double-tribute'
    || tribute.action === 'return-tribute'
    ? tribute.action
    : null;

  const confirm = () => {
    if (activeAction === null || selectedId.length === 0) {
      return;
    }
    onAction(activeAction, selectedId);
  };

  return (
    <div className="modal-backdrop tribute-backdrop">
      <section aria-labelledby="tribute-title" className="game-modal tribute-modal">
        <header className="tribute-header">
          <span className="tribute-seal" aria-hidden="true">贡</span>
          <div>
            <p className="eyebrow">{tribute.mode === 'double' ? '双贡流程' : '单贡流程'}</p>
            <h2 id="tribute-title">{isReveal ? '贡牌公开' : '贡还牌'}</h2>
          </div>
        </header>
        <p className="modal-description">{tribute.message}</p>

        {isReveal && tribute.revealDeadline !== null && tribute.revealDurationMs !== null ? (
          <>
            <div className="tribute-cards tribute-reveal-cards" aria-label={`公开的贡牌，共 ${tribute.revealedCards.length} 张`}>
              {tribute.revealedCards.map((offer, index) => (
                <figure key={offer.card.id}>
                  <PokerCard
                    card={offer.card}
                    index={index}
                    level={level}
                    onToggle={() => undefined}
                    selected={false}
                  />
                  <figcaption>{players.find((player) => player.seat === offer.source)?.nickname ?? `座位 ${offer.source + 1}`} 进贡</figcaption>
                </figure>
              ))}
            </div>
            <TributeRevealProgressBar deadline={tribute.revealDeadline} durationMs={tribute.revealDurationMs} />
          </>
        ) : isWaiting ? (
          <div className="tribute-waiting"><span aria-hidden="true">◇</span> 正在等待其他玩家</div>
        ) : tribute.choices.length > 0 ? (
          <>
            <div className="tribute-cards" aria-label={`可选择的贡还牌，共 ${tribute.choices.length} 张`}>
              {tribute.choices.map((card, index) => (
                <PokerCard
                  card={card}
                  index={index}
                  key={card.id}
                  level={level}
                  onToggle={setSelectedId}
                  selected={selectedId === card.id}
                />
              ))}
            </div>
            <button className="button button-primary tribute-confirm" disabled={selectedId.length === 0} onClick={confirm} type="button">
              {activeAction === null ? '等待' : actionLabels[activeAction]}
            </button>
          </>
        ) : (
          <p className="tribute-warning">当前没有符合规则的可选牌，请保留现场并联系我们检查。</p>
        )}
      </section>
    </div>
  );
}
