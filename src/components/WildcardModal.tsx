import type { PlayInterpretation, WildcardAssignment } from '../game/rules/types';

interface WildcardModalProps {
  onCancel: () => void;
  onConfirm: (choice: PlayInterpretation) => void;
  options: PlayInterpretation[];
}

const suitNames = {
  spades: '黑桃',
  hearts: '红桃',
  clubs: '梅花',
  diamonds: '方块',
} as const;

function describeAssignment(assignment: WildcardAssignment): string {
  const suit = assignment.represents.suit;
  return `红桃级牌作为${suit === undefined ? '' : suitNames[suit]} ${assignment.represents.rank}`;
}

export function WildcardModal({ onCancel, onConfirm, options }: WildcardModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="wildcard-title" aria-modal="true" className="game-modal" role="dialog">
        <div className="modal-crest" aria-hidden="true">♥</div>
        <p className="eyebrow">红桃级牌 · 百搭</p>
        <h2 id="wildcard-title">请选择这手牌的解释</h2>
        <p className="modal-description">这组牌存在多种合法解释。请选择本次出牌的确切含义。</p>
        <div className="wildcard-options">
          {options.map((choice) => (
            <button key={choice.description} onClick={() => onConfirm(choice)} type="button">
              <span className="radio-mark" />
              <span>
                <strong>{choice.description}</strong>
                <small>{choice.wildcardAssignments.map(describeAssignment).join('；')}</small>
              </span>
            </button>
          ))}
        </div>
        <button className="button button-secondary modal-cancel" onClick={onCancel} type="button">返回选牌</button>
      </section>
    </div>
  );
}
