interface Props {
  onClose: () => void;
}

export function RulesModal({ onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal rules-modal" onClick={e => e.stopPropagation()}>
        <div className="rules-header">
          <h3>遊び方</h3>
          <button className="rules-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="rules-section">
          <h4>基本ルール</h4>
          <ul>
            <li>15×15のボードに2〜4人で遊びます</li>
            <li>各プレイヤーは7枚のタイルを持ちます</li>
            <li>最初の手は中央の★マスを通すように2枚以上置きます</li>
            <li>制限時間は1ターン60秒です</li>
          </ul>
        </div>

        <div className="rules-section">
          <h4>タイルの置き方</h4>
          <ul>
            <li>タイルは一直線（横または縦）に並べます</li>
            <li>既に置かれたタイルに隣接するように置きます</li>
            <li>新しくできた単語はすべて辞書に載っている必要があります</li>
          </ul>
        </div>

        <div className="rules-section">
          <h4>濁音・半濁音</h4>
          <ul>
            <li>タイルを選択して <strong>゛</strong>（濁音）/ <strong>゜</strong>（半濁音）ボタンで変換できます</li>
            <li>変換すると得点も変わります（例: か→が）</li>
          </ul>
        </div>

        <div className="rules-section">
          <h4>ブランクタイル</h4>
          <ul>
            <li>任意のひらがなとして使えます</li>
            <li>得点は常に0点です</li>
          </ul>
        </div>

        <div className="rules-section">
          <h4>特殊マス</h4>
          <div className="bonus-examples">
            <span className="bonus-tag bonus-tag-dl">2L</span> 文字の点数が2倍
          </div>
          <div className="bonus-examples">
            <span className="bonus-tag bonus-tag-tl">3L</span> 文字の点数が3倍
          </div>
          <div className="bonus-examples">
            <span className="bonus-tag bonus-tag-dw">2W</span> 単語の合計点が2倍
          </div>
          <div className="bonus-examples">
            <span className="bonus-tag bonus-tag-tw">3W</span> 単語の合計点が3倍
          </div>
        </div>

        <div className="rules-section">
          <h4>得点計算</h4>
          <ul>
            <li>各文字の点数にボーナスマスの倍率をかけます</li>
            <li>単語倍率マス（2W/3W）は単語全体の合計に適用されます</li>
            <li>1ターンで手持ち7枚すべてを使い切ると <strong>+50点ボーナス</strong></li>
          </ul>
        </div>

        <div className="rules-section">
          <h4>交換・パス</h4>
          <ul>
            <li><strong>交換:</strong> 手持ちのタイルを選んで袋のタイルと交換できます（袋にタイルがある場合のみ）</li>
            <li><strong>パス:</strong> 何もせずターンを終了します</li>
          </ul>
        </div>

        <div className="rules-section">
          <h4>終了条件</h4>
          <ul>
            <li>全員が連続でパス（プレイヤー数×2回）するとゲーム終了</li>
            <li>袋が空で、誰かの手持ちが0枚になってもゲーム終了</li>
            <li>終了時、手持ちに残ったタイルの点数分が減点されます</li>
          </ul>
        </div>

        <button className="btn btn-primary rules-close-bottom" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
