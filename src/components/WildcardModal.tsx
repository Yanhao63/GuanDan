interface WildcardModalProps {
  onCancel: () => void;
  onConfirm: (choice: string) => void;
}

const choices = [
  { title: '同花顺 10-J-Q-K-A', detail: '两张红桃 2 分别作为黑桃 K、黑桃 A' },
  { title: '同花顺 8-9-10-J-Q', detail: '两张红桃 2 分别作为黑桃 8、黑桃 9' },
];

export function WildcardModal({ onCancel, onConfirm }: WildcardModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="wildcard-title" aria-modal="true" className="game-modal" role="dialog">
        <div className="modal-crest" aria-hidden="true">♥</div>
        <p className="eyebrow">红桃级牌 · 百搭</p>
        <h2 id="wildcard-title">请选择这手牌的解释</h2>
        <p className="modal-description">两张红桃 2 与黑桃 10、J、Q 可以组成两种同花顺。请选择本次出牌的确切含义。</p>
        <div className="wildcard-options">
          {choices.map((choice) => (
            <button key={choice.title} onClick={() => onConfirm(choice.title)} type="button">
              <span className="radio-mark" />
              <span><strong>{choice.title}</strong><small>{choice.detail}</small></span>
            </button>
          ))}
        </div>
        <button className="button button-secondary modal-cancel" onClick={onCancel} type="button">返回选牌</button>
      </section>
    </div>
  );
}
