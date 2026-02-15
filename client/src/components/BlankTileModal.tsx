/**
 * 五十音表レイアウト（右から左）
 * 縦: あ段→お段 (5行)
 * 横(右→左): あ,か,さ,た,な,は,ま,や,ら,わ/ー/ん
 * 濁音・半濁音は元の仮名の下に配置（gap行を挟む）
 */

type Cell = { r: number; c: number; ch: string };

// 列(左→右): わーん(1), ら(2), や(3), ま(4), は(5), な(6), た(7), さ(8), か(9), あ(10)
const CELLS: Cell[] = [
  // 清音 (row 1-5)
  // あ行 (col 10)
  { r:1, c:10, ch:'あ' }, { r:2, c:10, ch:'い' }, { r:3, c:10, ch:'う' }, { r:4, c:10, ch:'え' }, { r:5, c:10, ch:'お' },
  // か行 (col 9)
  { r:1, c:9, ch:'か' }, { r:2, c:9, ch:'き' }, { r:3, c:9, ch:'く' }, { r:4, c:9, ch:'け' }, { r:5, c:9, ch:'こ' },
  // さ行 (col 8)
  { r:1, c:8, ch:'さ' }, { r:2, c:8, ch:'し' }, { r:3, c:8, ch:'す' }, { r:4, c:8, ch:'せ' }, { r:5, c:8, ch:'そ' },
  // た行 (col 7)
  { r:1, c:7, ch:'た' }, { r:2, c:7, ch:'ち' }, { r:3, c:7, ch:'つ' }, { r:4, c:7, ch:'て' }, { r:5, c:7, ch:'と' },
  // な行 (col 6)
  { r:1, c:6, ch:'な' }, { r:2, c:6, ch:'に' }, { r:3, c:6, ch:'ぬ' }, { r:4, c:6, ch:'ね' }, { r:5, c:6, ch:'の' },
  // は行 (col 5)
  { r:1, c:5, ch:'は' }, { r:2, c:5, ch:'ひ' }, { r:3, c:5, ch:'ふ' }, { r:4, c:5, ch:'へ' }, { r:5, c:5, ch:'ほ' },
  // ま行 (col 4)
  { r:1, c:4, ch:'ま' }, { r:2, c:4, ch:'み' }, { r:3, c:4, ch:'む' }, { r:4, c:4, ch:'め' }, { r:5, c:4, ch:'も' },
  // や行 (col 3)
  { r:1, c:3, ch:'や' }, { r:3, c:3, ch:'ゆ' }, { r:5, c:3, ch:'よ' },
  // ら行 (col 2)
  { r:1, c:2, ch:'ら' }, { r:2, c:2, ch:'り' }, { r:3, c:2, ch:'る' }, { r:4, c:2, ch:'れ' }, { r:5, c:2, ch:'ろ' },
  // わ・ー・ん (col 1)
  { r:1, c:1, ch:'わ' }, { r:3, c:1, ch:'ー' }, { r:5, c:1, ch:'ん' },

  // 濁音・半濁音 (row 7-11、元の仮名の下)
  // が行 (か行の下 = col 9)
  { r:7, c:9, ch:'が' }, { r:8, c:9, ch:'ぎ' }, { r:9, c:9, ch:'ぐ' }, { r:10, c:9, ch:'げ' }, { r:11, c:9, ch:'ご' },
  // ざ行 (さ行の下 = col 8)
  { r:7, c:8, ch:'ざ' }, { r:8, c:8, ch:'じ' }, { r:9, c:8, ch:'ず' }, { r:10, c:8, ch:'ぜ' }, { r:11, c:8, ch:'ぞ' },
  // だ行 (た行の下 = col 7)
  { r:7, c:7, ch:'だ' }, { r:8, c:7, ch:'ぢ' }, { r:9, c:7, ch:'づ' }, { r:10, c:7, ch:'で' }, { r:11, c:7, ch:'ど' },
  // ば行 (は行の下 = col 5)
  { r:7, c:5, ch:'ば' }, { r:8, c:5, ch:'び' }, { r:9, c:5, ch:'ぶ' }, { r:10, c:5, ch:'べ' }, { r:11, c:5, ch:'ぼ' },
  // ぱ行 (ま行の列 = col 4、ま行に濁音なし)
  { r:7, c:4, ch:'ぱ' }, { r:8, c:4, ch:'ぴ' }, { r:9, c:4, ch:'ぷ' }, { r:10, c:4, ch:'ぺ' }, { r:11, c:4, ch:'ぽ' },
];

interface Props {
  onSelect: (char: string) => void;
  onCancel: () => void;
}

export function BlankTileModal({ onSelect, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-gojuon" onClick={e => e.stopPropagation()}>
        <h3>ブランクタイルの文字を選択</h3>
        <div className="gojuon-grid">
          {CELLS.map(({ r, c, ch }) => (
            <button
              key={ch}
              className="char-btn"
              style={{ gridRow: r, gridColumn: c }}
              onClick={() => onSelect(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}
