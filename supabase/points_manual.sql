-- ポイントを手で増減するための手順書。
--
-- 先に supabase/points.sql を実行しておくこと（テーブルと列を作るファイル）。
--
-- 使い方: 必要な節だけを選んで SQL Editor に貼り、メールアドレスと点数を
--         書き換えてから実行する。
--
-- ⚠️ 最後の「全員を 0 に戻す」だけはコメントアウトしてあります。
--    2 と 3 は、メールアドレスを書き換えないまま実行しても何も起きません
--    （宛先が見つからないので、履歴も残高も更新されない）。
--    一方 4 は条件なしで全部消すため、コメントを外さないと動かないように
--    してあります。
--
--
-- なぜ award_points 関数を使わないのか
--
--   アプリ側の加算は public.award_points を通す。あの関数は「いま操作して
--   いる本人」を auth.uid() から決めるが、SQL Editor には「ログイン中の
--   ユーザー」という概念が無く auth.uid() が null になるため、
--   「ログインが必要です」で必ず失敗する。
--
--   そこでここでは履歴（point_events）と残高（users.points）を直接書く。
--   ただし片方だけ流すと食い違うので、必ず1文で両方更新すること。
--   下の SQL はそのように書いてある。分割して使わないこと。


-- ────────────────────────────────────────────────
-- 1. いまの状態を見る
-- ────────────────────────────────────────────────

-- 残高の多い順
select u.id, u.name, u.points, au.email
from public.users u
left join auth.users au on au.id = u.id
order by u.points desc, u.name
limit 20;

-- 直近の履歴
select e.id, u.name, e.amount, e.reason, e.created_at
from public.point_events e
join public.users u on u.id = e.user_id
order by e.id desc
limit 20;


-- ────────────────────────────────────────────────
-- 2. 増やす / 減らす
-- ────────────────────────────────────────────────
-- amount にマイナスを入れれば減る。残高は 0 未満にならないよう丸める。
-- メールアドレスと点数を書き換えてから実行すること。

with me as (
  select id from auth.users where email = 'ここにメールアドレス'
), ins as (
  insert into public.point_events (user_id, amount, reason)
  select id, 100, 'manual' from me        -- ← 点数と理由を変える
  returning user_id, amount
)
update public.users u
   set points = greatest(0, u.points + ins.amount)
  from ins
 where u.id = ins.user_id;


-- ────────────────────────────────────────────────
-- 3. 特定の値にする（例: 0 に戻す）
-- ────────────────────────────────────────────────
-- 目標値との差を履歴に残すので、残高と履歴の辻褄が合ったままになる。
-- 「0」と書いてある2箇所を目標値に変える。

with target as (
  select u.id, u.points, 0 as goal        -- ← 目標値
  from public.users u
  where u.id = (select id from auth.users where email = 'ここにメールアドレス')
), ins as (
  insert into public.point_events (user_id, amount, reason)
  select id, goal - points, 'manual_adjust' from target
  where goal <> points
  returning user_id
)
update public.users u
   set points = target.goal
  from target
 where u.id = target.id;


-- ────────────────────────────────────────────────
-- 4. デモ前に全員を 0 に戻す
-- ────────────────────────────────────────────────
-- ⚠️ 共有DBなので、他のメンバーの残高も履歴もすべて消えます。
--    流す前に Slack で一声かけてください。
--    ここだけは条件が無いので、コメントを外さないと実行できません。
--    基本的に実行しない

-- delete from public.point_events;
-- update public.users set points = 0 where points <> 0;
