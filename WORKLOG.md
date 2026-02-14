# 日本語スクラブル 作業ログ

## 2026-02-15

### Phase 1: プロジェクト基盤
- npm workspacesでモノレポ構成 (client / server / shared)
- Vite + React + TypeScript でクライアントをスキャフォールド
- Node.js + ws でサーバーをスキャフォールド
- shared/src/protocol.ts に WebSocket メッセージ型定義を作成
- タイル定数 (約120枚のひらがなタイル) とボードレイアウト (15x15) を定義

### Phase 2: 辞書
- JMdict (jmdict-simplified) を GitHub API 経由で自動ダウンロード
- ZIP をパースしてひらがな2〜15文字の単語を抽出
- dictionary.txt に 142,044 語を生成、gzip キャッシュで高速再読み込み

### Phase 3: サーバーゲームロジック
- TileBag.ts: シャッフル、ドロー、交換
- Dictionary.ts: 辞書読み込み、Set によるO(1)ルックアップ
- BoardValidator.ts: 配置検証、単語抽出、辞書チェック
- Game.ts: スコア計算、ターン管理、終了判定

### Phase 4: WebSocket サーバー・部屋管理
- Room.ts: 4文字の部屋コード生成、参加/退出/60秒再接続猶予
- index.ts: HTTP + WebSocket サーバー、メッセージルーティング
- 統合テスト実施: 部屋作成 → 参加 → ゲーム開始 → ラック配布を確認

### Phase 5: クライアント UI
- useWebSocket フック (自動再接続付き)
- Lobby: 部屋作成・参加画面
- WaitingRoom: 部屋コード表示、プレイヤーリスト、開始/戻るボタン
- GameView: 15x15 盤面、ラック、コントロール、ゲーム終了モーダル
- BlankTileModal: ブランクタイルのひらがな選択
- App.css: ダークテーマ

### Phase 6: バグ修正・機能改善

#### バグ修正
- ホスト側でゲスト入室時にプレイヤー数が更新されない問題を修正 (playerNameRef 導入)
- 待機画面に「戻る」ボタンを追加

#### 機能改善
- エラーメッセージをゲーム画面の一番下に表示するよう変更
- 制限時間1分、超過で強制パス (サーバー側タイマー + クライアント側カウントダウン)
- ウィンドウ目いっぱいに表示するフルウィンドウレイアウト (dvh 使用)
- タイルのドラッグ&ドロップ対応 (ラック→盤面、盤面上の再配置)
- 辞書にない単語でも置いたタイルをそのまま残す (ターン変更時にクリア)
- 確定済みタイルと未確定タイルの視覚的区別 (色分け)
- タスクバーと重ならないようレイアウト調整 + スクロール対応

## 技術スタック
- **フロントエンド**: React 19 + TypeScript + Vite 7
- **バックエンド**: Node.js + ws + tsx (dev)
- **辞書**: JMdict (CC BY-SA 4.0) から自動生成
- **通信**: WebSocket (JSON プロトコル)
- **開発**: npm workspaces, concurrently
