import { useState } from 'react';
import type { TributeAction, TributeView } from '../game/room';
import { PokerCard } from './PokerCard';

type ActiveTributeAction = Exclude<TributeAction, 'waiting'>;

interface TributeOverlayProps {
  onAction: (action: ActiveTributeAction, cardId: string) => void;
  tribute: TributeView;
}

const actionLabels: Record<ActiveTributeAction, string> = {
  'choose-double-tribute': '确认分配',
  'pay-tribute': '确认进贡',
  'return-tribute': '确认还贡',
};

export function TributeOverlay({ onAction, tribute }: TributeOverlayProps) {
  const [selectedId, setSelectedId] = useState('');
  const activeAction: ActiveTributeAction | null = tribute.action === 'waiting'
    ? null
    : tribute.action;
  const isWaiting = activeAction === null;

  const confirm = () => {
    if (activeAction === null || selectedId.length === 0) {
      return;
    }
    onAction(activeAction, selectedId);
  };

  return (
    <div className="modal-backdrop tribute-backdrop">
      <section aria-labelledby="tribute-title" className="game-modal tribute-modal">
        <div className="modal-crest" aria-hidden="true">贡</div>
        <p className="eyebrow">{tribute.mode === 'double' ? '双贡流程' : '单贡流程'}</p>
        <h2 id="tribute-title">贡还牌</h2>
        <p className="modal-description">{tribute.message}</p>

        {isWaiting ? (
          <div className="tribute-waiting"><span aria-hidden="true">◇</span> 正在等待其他玩家</div>
        ) : tribute.choices.length > 0 ? (
          <>
            <div className="tribute-cards" aria-label="可选择的贡还牌">
              {tribute.choices.map((card, index) => (
                <PokerCard
                  card={card}
                  index={index}
                  key={card.id}
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
