# MeetLink（社内マッチングアプリ）

同じ会社の中で、**仕事の相談相手**と**プライベートの相手**を、1つのアプリで**別々に**探せるサービスです。

2つのモードを分離していて、**恋愛モードは相互オプトイン**（自分がONにしていない限り、誰も表示されず、誰にも表示されない）。「社内で出会いを探している」ことが伝わらない作りにしています。

| | |
|---|---|
| フロント | Next.js 16（App Router / Turbopack）・React 19・TypeScript |
| スタイル | Tailwind CSS v4（CSS-first。`tailwind.config` は無い） |
| データ | Supabase（PostgreSQL / Auth / Storage） |
| AI | Claude API（`@anthropic-ai/sdk`） |
| インフラ | Vercel |

> 以前このファイルは仕様書でしたが、実装が進んだので**現状の説明**に置き換えました。
> 仕様の議論は Slack、実装の意図は各ファイルのコメントとコミットメッセージにあります。

---

## 動かす

```bash
npm install
npm run dev        # http://localhost:3000
```

### 環境変数

`.env.local` に3つ必要です。

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
ANTHROPIC_API_KEY=...
```

- `NEXT_PUBLIC_` が付く2つは**ブラウザに配られます**。Supabase の Publishable key は公開前提なので問題ありません。**Secret key は絶対に置かないでください**
- `ANTHROPIC_API_KEY` は**サーバー側だけ**で使います。**`NEXT_PUBLIC_` を付けないでください。** 付けるとバンドルに焼き込まれ、誰でも取り出して従量課金を回せます

Vercel では **project レベル**に設定します（従量課金のキーを他プロジェクトに配る必要がないため）。

### Supabase の SQL

**`supabase/` の `.sql` を SQL Editor で実行しないと、対応する機能が動きません。** どれも何度実行しても壊れません（`if not exists` / `create or replace`）。

| ファイル | 作るもの | 流さないと |
|---|---|---|
| `profile_fields.sql` | プロフィールの追加項目（`profiles` の列） | マイページの項目が保存できない |
| `avatar_images.sql` | アイコンの Storage バケット | 写真を変更できない |
| `message_images.sql` | トークの写真の Storage バケット | 写真を送れない |
| `blocks.sql` | `blocks` テーブル | ブロックできない |
| `match_reads.sql` | 既読位置（`match_reads` / `mark_match_read`） | 未読バッジが常に全件未読 |
| `boards.sql` | 募集掲示板 | 募集画面が動かない |
| `points.sql` | 残高（`users.points`）と履歴（`point_events`） | ポイントが動かない |
| `point_rewards.sql` | 受け取り箱・デイリーミッション・アイテム交換 | ポイント画面が動かない |
| `profile_milestones.sql` | プロフィール充実度の達成ポイント | 50/80/100% のポイントが届かない |
| `reviews.sql` | 口コミ（`reviews` / `submit_review` / `get_user_rating`） | 星が出ず、評価も求められない |
| `super_like.sql` | スーパーいいね（`reactions.is_super` / `use_super_like`） | スーパーいいねが送れない（普通のいいねは動く） |

`reviews.sql` と `super_like.sql` は `point_rewards.sql` が作るテーブルを使うので、**先にポイント側を流しておいてください。**

`fix_profile_values.sql` と `points_manual.sql` と `cleanup_message_images.sql` は**手順書**です。必要なときだけ実行します。

---

## 画面と、それを動かしているファイル

サイドバーの並び順です。

| 画面 | URL | 実装 |
|---|---|---|
| 探す | `/discover` | [app/discover/page.tsx](app/discover/page.tsx) |
| トーク | `/talk` | [components/TalkScreen.tsx](components/TalkScreen.tsx) → [TalkPanel.tsx](components/TalkPanel.tsx) / [MatchList.tsx](components/MatchList.tsx) |
| 募集 | `/board` | [app/board/page.tsx](app/board/page.tsx) |
| 履歴 | `/history` | [app/history/page.tsx](app/history/page.tsx) |
| AI対話 | `/ai-talk` | [app/ai-talk/page.tsx](app/ai-talk/page.tsx) ＋ [app/api/ai-talk/](app/api/ai-talk/) |
| ポイント | `/points` | [app/points/page.tsx](app/points/page.tsx) ＋ [components/points/](components/points/) |
| マイページ | `/me` | [components/profile/MyPage.tsx](components/profile/MyPage.tsx) |
| ログイン / 登録 | `/login` `/signup` | [LoginForm.tsx](components/LoginForm.tsx) / [SignUpForm.tsx](components/SignUpForm.tsx) |
| パスワード再設定 | `/forgot-password` `/reset-password` | [ForgotPasswordForm.tsx](components/ForgotPasswordForm.tsx) / [ResetPasswordForm.tsx](components/ResetPasswordForm.tsx) |

全画面の外枠は [components/AppShell.tsx](components/AppShell.tsx)（サイドバー＋ヘッダー）です。

---

## 機能ごとの実装場所

### 探す・いいね・マッチ

[app/discover/page.tsx](app/discover/page.tsx) がカードを1枚ずつ出します。

- 表示する人の絞り込みは `getUsers()`（[lib/repository.ts](lib/repository.ts)）。**そのモードに参加している人だけ／自分といいね済みを除く／恋愛モードは相互オプトイン**
- いいねで相互になったら `likeUser()` が `matches` に行を作り、その場でマッチのモーダルが出る
- **押したときの演出**は同じファイル。♥/★が3つ舞う `likeBurst`、画面下のトースト `reactionFeedback`、マッチ成立の `matchCelebration`。CSS は [app/discover/discover.module.css](app/discover/discover.module.css)
- 演出は**書き込みが成功してから**出します。通信が失敗したときに「いいねを押しました」だけ残らないようにするためです
- 通信待ちの間にモードを切り替えたら、`reactionModeVersionRef` で**その結果を捨てます**

### スーパーいいね

**送った時点で相手の探す画面に「この人からスーパーいいねが届いています」と出る**いいねです。普通のいいねが相互になるまで伏せられているのと違い、**送った側が自分で選んで明かします。**

- いいねボタンの上のトグルをONにすると、いいねがスーパーいいねに変わります（[app/discover/page.tsx](app/discover/page.tsx)）
- **100ptで交換したアイテムを1つ消費します。** 在庫0のときはトグルを押せません
- 消費と記録は `use_super_like()`（[supabase/super_like.sql](supabase/super_like.sql)）が**まとめて**行います。画面から2回に分けて呼ぶと「アイテムだけ減った」が起きるためです
- 受け取った側の並び順は**スーパーいいね → 普通のいいね → それ以外**（`getUsers()`）
- マッチの成立条件は普通のいいねと同じです

### トーク

[components/TalkScreen.tsx](components/TalkScreen.tsx) が左の一覧、[TalkPanel.tsx](components/TalkPanel.tsx) が右のパネルです。

- 一覧は5秒ごと、開いている会話は3秒ごとに取り直します（[lib/usePolling.ts](lib/usePolling.ts)）
- **既読は「画面に出せたぶん」だけ**進めます。取得に失敗したメッセージは既読にしません
- 既読位置は `mark_match_read()` が `greatest()` で比べるので、**書き込みが前後しても巻き戻りません**
- **狭い画面ではパネルを一覧に重ねます**（横に並べると一覧が幅を使い切って右側が0pxになるため）
- ブロックは**恋愛モードだけ**。仕事モードでは業務の連絡経路を個人の判断で断てないようにしています

### プロフィール

- 入力は [components/profile/MyPage.tsx](components/profile/MyPage.tsx)。**項目の定義は [lib/profile-fields.ts](lib/profile-fields.ts) の1箇所**で、ここに1行足せば入力欄・詳細表示・充実度の分母がすべて増えます
- 相手のプロフィールは [components/profile/ProfileDetailModal.tsx](components/profile/ProfileDetailModal.tsx)。**トーク・履歴の名前を押すと開きます**
- **探す画面にはもう1つ別実装のモーダルがあります**（`app/discover/page.tsx` 内）。共通部品への差し替えは未着手です
- 充実度の計算は [lib/profile-completion.ts](lib/profile-completion.ts)。**モードごとに数えます**（仕事13項目 / 恋愛22項目）

### 口コミ（星5評価）

- **5往復すると評価を求めるモーダル**が出ます（[components/reviews/ReviewPrompt.tsx](components/reviews/ReviewPrompt.tsx)）
- 「往復」は `least(自分の通数, 相手の通数)`。合計で数えると片方の連投だけで達してしまうためです
- **しきい値は2箇所にあります。** [lib/reviews.ts](lib/reviews.ts) の `REVIEW_RALLY_THRESHOLD` と [supabase/reviews.sql](supabase/reviews.sql) の `c_threshold`。**片方だけ変えると、画面には出るのに送信が弾かれます**
- **投稿すると50ポイント**が受け取り箱に届きます。`submit_review()` が `point_rewards` に入れます。**額も2箇所にあります**（`REVIEW_REWARD_POINTS` と `c_reward`）。片方だけ変えると、画面の案内と届く額が食い違います
- ポイントは**実際に1件記録できたときだけ**配ります。`on conflict do nothing` の後に `row_count` を見ているので、**二重送信や付け直しでは増えません**
- 平均は [components/reviews/UserRating.tsx](components/reviews/UserRating.tsx) が自前で取得して出します。プロフィール詳細のモーダル2つから使われます
- **RLS は「自分が付けたぶんだけ読める」。** 誰が何点付けたかは行として引けず、平均だけを `get_user_rating()` 経由で出します

### ポイント

- ルール（デイリーミッション・交換アイテム・履歴の上限）は [lib/points.ts](lib/points.ts)
- 画面は [app/points/page.tsx](app/points/page.tsx) と [components/points/](components/points/)（残高・受け取り箱・履歴・ミッション・アイテム）
- **プロフィールを 50% / 80% / 100% 埋めると 50 / 80 / 100pt** が受け取り箱に届きます（[supabase/profile_milestones.sql](supabase/profile_milestones.sql)）。一度きりです
- **口コミを投稿すると 50pt**（[supabase/reviews.sql](supabase/reviews.sql)）。会話1つにつき1回です
- 加算は必ず `award_points()` を通します。**残高と履歴を1トランザクションで書く**ためで、画面から直接 `users.points` は触りません

### AI対話

- 画面は [app/ai-talk/page.tsx](app/ai-talk/page.tsx)
- **Claude を呼ぶのはサーバー側だけ**です。[app/api/ai-talk/route.ts](app/api/ai-talk/route.ts)（会話）と [evaluate/route.ts](app/api/ai-talk/evaluate/route.ts)（10ターン後の評価）
- **シチュエーションごとの役作り**は `route.ts` の `SITUATION_PROMPTS`。会話履歴は毎回まるごと送り直します（API 側に記憶は無いため）
- **どちらのルートも認証が必要**です（[lib/api-auth.ts](lib/api-auth.ts)）。公開URLなので、これが無いと第三者に `ANTHROPIC_API_KEY` を使われます

### パスワード再設定

入口は2つあります。どちらも [lib/session.tsx](lib/session.tsx) に処理があります。

- **忘れた人** → ログイン画面の「パスワードをお忘れですか？」→ メールのリンク → `/reset-password`
- **覚えている人** → マイページ左の「パスワードを変更」（メール不要。**現在のパスワードの確認あり**）

**⚠️ 遷移先URLを Supabase に登録しないとリンクが弾かれます。** Authentication → URL Configuration に、`http://localhost:3000/reset-password` と本番の同じパスを入れてください。

**⚠️ 既定のメール送信には回数制限があります。** デモで複数人が試すと止まります。止まったときは、マイページ側の変更で見せてください。

- `/reset-password` と `/forgot-password` は [components/AppShell.tsx](components/AppShell.tsx) の `PASSWORD_PATHS` に入れてあります。**`PUBLIC_PATHS` に入れてはいけません。** 再設定のリンクを踏むとログイン状態になるため、`/discover` へ飛ばされて設定画面にたどり着けなくなります
- メールアドレスが登録済みかどうかで文面を変えていません。変えると、誰でもアドレスの登録有無を試せてしまいます

### 募集掲示板

[app/board/page.tsx](app/board/page.tsx)。モードごとに募集を立て、参加者とグループチャットができます。

---

## 決まりごと

### DBを触るのは `lib/repository.ts` だけ

**画面から `supabase` を直接呼ばないでください。** 取得処理が必要になったら Slack で一声かけてから、ここに足します。

[lib/types.ts](lib/types.ts) も全員が参照するので、変更前に相談してください。

### モードの切り替え

[lib/session.tsx](lib/session.tsx) が `<html data-mode>` を書き換え、[app/globals.css](app/globals.css) の CSS 変数が丸ごと入れ替わります。

**色は必ず CSS 変数で書いてください。**

```
--surface  --background  --foreground  --muted  --line
--accent  --accent-strong  --accent-soft  --bubble-other-bg
```

**存在しない変数名を使うと `border-color` が `currentColor` になり、文字と同じ濃さの線が出ます。** 実際に AI対話ページで起きました。

### React 19 の注意

`react-hooks/set-state-in-effect` が有効です。**effect の中で同期的に `setState` しないでください。** 値の変化に合わせて state を直したいときは、描画中に直前の値と比べて調整します（[app/discover/page.tsx](app/discover/page.tsx) の `renderedMode` が例）。

### 確認

```bash
npx tsc --noEmit
npm run lint       # 14 problems（7 errors, 7 warnings）が現状のベースライン
npm run build
```

**lint はベースラインから増えていないことを確認してください。** 既存の指摘は `lib/session.tsx` と `lib/repository.ts` などに残っています。

---

## ディレクトリ

```
app/            画面（App Router）と API ルート
components/     画面をまたいで使う部品
  points/       ポイント画面の部品
  profile/      プロフィール関連
  reviews/      口コミ（星）
lib/            型・データ取得・ルール
supabase/       DBのスキーマとRPC（SQL Editor で実行する）
```

---

## いま残っていること

- **探す画面のプロフィール詳細モーダル**を共通部品（`ProfileDetailModal`）に寄せる。同じUIが2つある状態
