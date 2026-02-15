# 日本語スクラブル（ひらがな版）

ひらがなタイルを使った日本語スクラブルのオンライン対戦ゲームです。

## セットアップ

```bash
npm install
```

## ローカルで遊ぶ

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開きます。同じPCの別タブ/ブラウザで2人目として参加できます。

## リモート対戦（ngrok を使う）

離れた場所にいる人と遊ぶには、[ngrok](https://ngrok.com/) を使ってローカルサーバーを外部公開します。

### 1. ngrok をインストール

https://ngrok.com/download からダウンロードしてインストールします。
アカウント作成後、認証トークンを設定してください：

```bash
ngrok config add-authtoken <YOUR_TOKEN>
```

### 2. クライアントをビルド

```bash
npm run build -w client
```

### 3. サーバーを起動

```bash
npm run dev -w server
```

サーバーが http://localhost:3001 で起動します。
このサーバーはビルド済みクライアントの配信と WebSocket 通信の両方を担います。

### 4. ngrok でトンネルを作成

別のターミナルで：

```bash
ngrok http 3001
```

以下のような URL が表示されます：

```
Forwarding  https://xxxx-xxx-xxx.ngrok-free.app -> http://localhost:3001
```

### 5. 遊ぶ

1. 表示された `https://xxxx-xxx-xxx.ngrok-free.app` の URL を対戦相手に共有します
2. ホスト側もこの ngrok URL でアクセスしてください（localhost ではなく）
3. 「部屋を作る」で部屋を作成し、表示された部屋コードを相手に伝えます
4. 相手は同じ URL にアクセスして部屋コードで参加します

> **注意**: ngrok の無料プランでは、初回アクセス時に警告ページが表示されることがあります。「Visit Site」をクリックして進んでください。

## 技術スタック

- **クライアント**: React 19 + TypeScript + Vite
- **サーバー**: Node.js + ws (WebSocket)
- **辞書**: JMdict ベース（約14万語）
