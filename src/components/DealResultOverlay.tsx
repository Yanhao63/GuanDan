import type { DealSettlement, Seat } from '../game/rules/match';
import { getTeamForSeat } from '../game/rules/match';
import type { RoomPlayerView } from '../game/room';

interface DealResultOverlayProps {
  finishOrder: Seat[];
  isHost: boolean;
  onNextDeal: () => void;
  players: RoomPlayerView[];
  selfSeat: Seat;
  settlement: DealSettlement;
}

const placementNames = ['头游', '二游', '三游', '末游'] as const;

export function DealResultOverlay({
  finishOrder,
  isHost,
  onNextDeal,
  players,
  selfSeat,
  settlement,
}: DealResultOverlayProps) {
  const selfTeam = getTeamForSeat(selfSeat);
  const selfWonMatch = settlement.matchWinner === selfTeam;
  const matchComplete = settlement.matchWinner !== null;

  return (
    <div className="modal-backdrop result-backdrop">
      <section aria-labelledby="result-title" className="game-modal result-modal">
        <div className="modal-crest" aria-hidden="true">榜</div>
        <p className="eyebrow">本副结算</p>
        <h2 id="result-title">{matchComplete ? (selfWonMatch ? '恭喜获胜' : '对方获胜') : `升级 ${settlement.upgradedBy} 级`}</h2>

        <div className="finish-order">
          {finishOrder.map((seat, index) => {
            const player = players.find((candidate) => candidate.seat === seat);
            return (
              <div key={seat}>
                <span>{placementNames[index]}</span>
                <strong>{player?.nickname ?? `座位 ${seat + 1}`}</strong>
              </div>
            );
          })}
        </div>

        <p className="result-summary">
          {matchComplete
            ? '本场比赛已经结束。'
            : `头游一方下一副打 ${settlement.nextLevel}，随后进入贡还牌流程。`}
        </p>

        {!matchComplete && isHost ? (
          <button className="button button-primary result-next" onClick={onNextDeal} type="button">开始下一副</button>
        ) : !matchComplete ? (
          <p className="result-waiting">等待房主开始下一副</p>
        ) : null}
      </section>
    </div>
  );
}
