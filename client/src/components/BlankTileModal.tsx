const HIRAGANA_CHARS = [
  'あ','い','う','え','お',
  'か','き','く','け','こ',
  'さ','し','す','せ','そ',
  'た','ち','つ','て','と',
  'な','に','ぬ','ね','の',
  'は','ひ','ふ','へ','ほ',
  'ま','み','む','め','も',
  'や','ゆ','よ',
  'ら','り','る','れ','ろ',
  'わ','を','ん',
  'が','ぎ','ぐ','げ','ご',
  'ざ','じ','ず','ぜ','ぞ',
  'だ','ぢ','づ','で','ど',
  'ば','び','ぶ','べ','ぼ',
  'ぱ','ぴ','ぷ','ぺ','ぽ',
  'っ','ゃ','ゅ','ょ','ー',
];

interface Props {
  onSelect: (char: string) => void;
  onCancel: () => void;
}

export function BlankTileModal({ onSelect, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>ブランクタイルの文字を選択</h3>
        <div className="char-grid">
          {HIRAGANA_CHARS.map(ch => (
            <button key={ch} className="char-btn" onClick={() => onSelect(ch)}>
              {ch}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}
