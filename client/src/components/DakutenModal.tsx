interface Props {
  baseChar: string;
  variants: string[];  // e.g., ['が'] or ['ば', 'ぱ']
  onSelect: (assignedChar?: string) => void;  // undefined = use base char
  onCancel: () => void;
}

export function DakutenModal({ baseChar, variants, onSelect, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal dakuten-modal" onClick={e => e.stopPropagation()}>
        <h3>文字を選択</h3>
        <div className="dakuten-options">
          <button className="char-btn dakuten-btn" onClick={() => onSelect(undefined)}>
            {baseChar}
          </button>
          {variants.map(v => (
            <button key={v} className="char-btn dakuten-btn" onClick={() => onSelect(v)}>
              {v}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}
