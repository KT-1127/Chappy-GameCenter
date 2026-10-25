# チャッピーGameセンター

チャッピーのゲームを1か所にまとめたサイトです。ニックネームでプレイし、ゲームごとに **デイリーランキング** と **総合ランキング** が出ます。管理者は「管理者ページ」から、ゲームの ON/OFF・ランキングの編集/削除・おしらせの変更ができます。記録は **Firebase（Firestore）** に保存します。

## フォルダ

```
index.html        トップ（ゲーム選択・ニックネーム・ランキング）
admin.html        管理者ページ
terms.html        サイトのきやく
favicon.svg/.png  ファビコン
firebase.json     Firebase Hosting / Firestore の設定
firestore.rules   Firestore のセキュリティルール
assets/
  config.js       ★設定（Firebase の firebaseConfig を貼る）
  cgc.js          ゲーム一覧・ニックネーム・ランキング・Firebase とのやりとり
  bridge.js       各ゲームに読みこませる部品（ON/OFF・ニックネーム確認・記録の送信）
  chappy.js       チャッピーのアニメーション
  style.css       共通スタイル
games/<id>/       各ゲーム（index.html、top2.png = 1882×836 のバナー、thumb.jpg = カード用の軽い版）
assets/top.png    センターの画像。軽い assets/top.jpg をリンク共有時のサムネイル（OGP）に使う
  link      チャッピーリンク   … compass の ChappyGame.tsx を単体の HTML に移植
  cannon    チャッピーキャノン … Chappy Cannon/ から
  ringo     チャッピーりんご便 … chappy ringobin/ から
  paku      パクパクチャッピー … パクパクチャッピー/ から
  rhythm    チャッピーリズム   … chappy リズム/ から
  sagashi   チャッピー探し     … AR/ から
  home      チャッピーhome     … chappy home/チャッピーのおうち/ から
tools/banner.html バナー画像を作るページ
tools/shrink.py   表示用の軽い画像（thumb.jpg / assets/top.jpg）を作る
```

## 2つのモード

| | おためしモード | Firebase モード |
|---|---|---|
| config.js の `firebase` | `null` | firebaseConfig を貼る |
| 記録の保存先 | その端末のブラウザの中だけ | Firestore（全員で共有） |
| 管理者ログイン | パスワードだけ（はじめは `chappy`） | メールアドレス＋パスワード |

## Firebase の準備

まなびコンパスのプロジェクトとは **別のプロジェクト** にするのがおすすめです（生徒の本名データとゲームの記録を分けるため）。

サイトは GitHub Pages に置き、Firebase は「記録の保存」と「ログイン」だけに使います。コマンドは使わず、すべてブラウザの画面でできます。

1. [Firebase コンソール](https://console.firebase.google.com/) で「プロジェクトを作成」（例：`chappy-game-center`）。Google アナリティクスはオフで OK
2. **ウェブアプリを登録**：プロジェクトの概要の「</>（ウェブ）」→ ニックネーム（例：`game-center`）→「アプリを登録」（Firebase Hosting のチェックは不要）
   → 出てきた `firebaseConfig = { … }` の **{ } の中身** を `assets/config.js` の `firebase:` に貼る
3. **Authentication**（構築 → Authentication →「始める」）→ ログイン方法 で
   - 「匿名」を有効にする（生徒用。ブラウザごとに自動で ID がつきます）
   - 「メール / パスワード」を有効にする（管理者用）
4. **Authentication → 設定 → 承認済みドメイン** に `＜GitHubのユーザー名＞.github.io` を追加 ← **これを忘れるとログインできません**
5. **Authentication → ユーザー →「ユーザーを追加」**で管理者のメールアドレスとパスワードを作る。表示された **ユーザー UID** をコピー
6. **Firestore Database** →「データベースを作成」→ ロケーション `asia-northeast1（東京）` →「本番環境モード」
7. Firestore の **「ルール」タブ** に `firestore.rules` の中身をまるごと貼りつけて「公開」
8. Firestore の「データ」タブ →「コレクションを開始」→ コレクション ID `cgc_admins`、**ドキュメント ID に手順5の UID**、フィールドは `name`（文字列）= `管理者` などで保存
   - 管理者を増やすときは、手順5と8をくりかえします
9. GitHub に push して、リポジトリの Settings → Pages で公開（Branch: `main` / フォルダ: `/ (root)`）。数分で `https://＜ユーザー名＞.github.io/＜リポジトリ名＞/` で開けます
10. `…/admin.html` を開き、手順5のメールアドレスとパスワードでログインできれば完了
11. 公開した URL がわかったら、`index.html` の `og:image` を `https://＜ユーザー名＞.github.io/＜リポジトリ名＞/assets/top.jpg` に書きかえる（LINE などでリンクを送ったときにTOP画像が出るようになります）

- `assets/config.js` の apiKey は GitHub に公開して大丈夫です（Firebase の仕組み上、見える前提の値です）。データを守っているのは手順7のルールです。
- `firestore.rules` を書きかえたときは、手順7をもう一度やってください。
- Firebase Hosting で公開したい場合は `firebase.json` を用意してあるので、`firebase deploy` でも公開できます（公開先は `https://＜プロジェクトID＞.web.app/`）。

### Firestore のデータ

| コレクション | 中身 |
|---|---|
| `cgc_settings/main` | `games`（`{ cannon: false }` のように OFF のゲーム）、`notice`（おしらせ） |
| `cgc_scores/{uid}_{日付}_{ゲーム}_{ボード}` | 1人・1日・1ボードのベスト。`nick, score, boardName, order, date, ts` |
| `cgc_admins/{uid}` | 管理者の印（コンソールで手で作る） |

ルール（`firestore.rules`）で次のことを守っています。
- 生徒は自分の記録しか作れない。更新はベストが良くなったときだけ。OFF のゲームには書きこめない
- 設定の変更・記録の編集/削除は `cgc_admins` に登録された管理者だけ

## ランキングのしくみ

- デイリー = 今日（日本時間）の記録の順位 / 総合 = 全期間の中で1人のベスト
- 「1人」はブラウザごとの匿名 ID で数えます（同じニックネームでも別の端末なら別の人）
- ボード（何でくらべるか）
  - リンク：20秒のハイスコア
  - キャノン：タイムアタック（20秒）の点数
  - りんご便：クリアしたいちばん大きいレベル
  - パクパク：ステージごとのクリアタイム（速いほど上）
  - リズム：曲 × むずかしさ ごとのスコア
  - 探し：とくてん
  - home：レベルごとのクリアタイム（速いほど上）

## ローカルで試す

`file://` で直接開くとキャノンなどが動かないので、簡易サーバーを立てます。

```
cd chappy-game-center
python -m http.server 8000
```
→ http://localhost:8000/ （チャッピー探しのカメラは https か localhost でだけ動きます）

## ゲームを新しく入れる・入れかえる

1. `games/<id>/` に `index.html` などを置く（カード画像は `top2.png`・1882×836）
2. `index.html` の `<head>` に追加

   ```html
   <script src="../../assets/config.js"></script>
   <script src="../../assets/cgc.js"></script>
   <script src="../../assets/bridge.js" data-game="<id>"></script>
   ```
3. 記録が決まるところに1行追加

   ```js
   window.CGCBridge && CGCBridge.report({ board: "main", boardName: "ハイスコア", score: score });
   ```
   小さいほど良い（タイムなど）なら `assets/cgc.js` の GAMES で `order: "asc"` に。
4. 新しいゲームなら `assets/cgc.js` の GAMES と `firestore.rules` のゲーム一覧に id を足す

元のゲームを更新したときは、コピーし直したあとに 2 と 3 を入れ直してください。

## バナー画像を作り直す

`tools/banner.html?g=link`（link / ringo / paku / rhythm / home）を開くと 1882×836 のバナーが表示されます。サーバーを立てた状態で、Chrome で書き出せます。

```
chrome --headless=new --hide-scrollbars --window-size=1882,836 --virtual-time-budget=4000 --screenshot=games/link/top2.png "http://localhost:8000/tools/banner.html?g=link"
```

## 画像を入れかえたとき

`games/<id>/top2.png` や `assets/top.png` を入れかえたら、サーバーを立てた状態で次を実行すると、表示用の軽い画像が作り直されます（元の PNG は 2MB 以上あり、そのままだとトップページが重くなるため）。

```
python tools/shrink.py http://localhost:8000
```

## 注意

- 同じ端末でも、ブラウザの履歴やサイトデータを消すと別の人として数えられます。
- キャノン（`games/cannon/index.html`）と探し（`games/sagashi/index.html`）には、元のファイルにあった Google アナリティクスのタグがそのまま入っています。不要なら削除してください。
- キャノンの独自スケジュール機能（schedule.json）は、センターの ON/OFF を使うので `mode: "open"` にしてあります。
