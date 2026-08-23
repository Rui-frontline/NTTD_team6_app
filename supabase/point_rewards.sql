-- ポイントの受け取り箱・デイリーミッション・アイテム交換。
--
-- ポイントの流れは3段。
--   1. 何かを達成する → 受け取り箱（point_rewards）に届く。残高はまだ増えない
--   2. 受け取り箱で受け取る → point_events に記録され、users.points が増える
--   3. アイテムと交換する → users.points が減り、user_items が増える
--
-- 「達成したら即座に残高が増える」のではなく一度箱に入れるのは、
-- ソシャゲの受信箱のように「受け取る」操作そのものを見せたいため。
--
-- 先に supabase/points.sql を実行しておくこと（users.points と point_events を作る）。
-- このファイルのあと、supabase/profile_milestones.sql を「再実行」すること
-- （プロフィール達成を即時付与から箱入れに切り替えるため）。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 何度実行しても壊れません（if not exists / create or replace / drop policy if exists）。

-- ───────────────────────── 受け取り箱 ─────────────────────────

create table if not exists public.point_rewards (
  id         bigserial   primary key,
  user_id    uuid        not null references public.users (id) on delete cascade,
  amount     int         not null check (amount > 0),
  -- 何で貯まったか。'profile_50_work' / 'daily_login' など
  reason     text        not null,
  -- 受信箱に出す文言。ここに文章を持たせておけば、ルールが増えても
  -- 画面側に「reason ごとの表示名」の分岐を作らずに済む
  label      text        not null,
  created_at timestamptz not null default now(),
  -- 受け取った時刻。null なら未受け取り
  claimed_at timestamptz
);

-- 画面がいちばん多く引くのは「自分の未受け取り」なので、その形で張る。
-- 受け取り済みは行数が増え続けるが、部分インデックスなら太らない。
create index if not exists point_rewards_pending_idx
  on public.point_rewards (user_id)
  where claimed_at is null;

alter table public.point_rewards enable row level security;

drop policy if exists point_rewards_select_own on public.point_rewards;
create policy point_rewards_select_own on public.point_rewards
  for select using (auth.uid() = user_id);

-- insert / update / delete のポリシーは意図的に作らない。
-- 書き込みは下の関数だけを入口にするため（point_events と同じ考え方）。

-- ───────────────────────── デイリーミッション ─────────────────────────

/*
  「その日のそのミッションを、受け取り箱にもう入れたか」の記録。

  進捗そのものは持たない。返信数もいいね数も messages / reactions を
  数えれば分かるので、二重に持つと食い違う。ここが持つのは
  「箱に入れたかどうか」だけ。

  同じ日の同じミッションが二重に箱へ入らないことを主キーで保証する。
  profile_milestones と同じやり方。
*/
create table if not exists public.daily_missions (
  user_id      uuid        not null references public.users (id) on delete cascade,
  -- JST の日付。境界は日本時間の 0:00
  mission_date date        not null,
  -- 'login' / 'reply_1' / 'reply_3' / 'like_5'
  mission      text        not null,
  created_at   timestamptz not null default now(),

  primary key (user_id, mission_date, mission)
);

alter table public.daily_missions enable row level security;

drop policy if exists daily_missions_select_own on public.daily_missions;
create policy daily_missions_select_own on public.daily_missions
  for select using (auth.uid() = user_id);

-- ───────────────────────── 持ち物 ─────────────────────────

create table if not exists public.user_items (
  user_id  uuid not null references public.users (id) on delete cascade,
  -- 種類を増やすときは、ここと exchange_item の値段表と
  -- lib/points.ts の ITEMS の3箇所を揃えること
  item     text not null check (item in ('super_like', 'coffee_ticket')),
  quantity int  not null default 0 check (quantity >= 0),

  primary key (user_id, item)
);

alter table public.user_items enable row level security;

drop policy if exists user_items_select_own on public.user_items;
create policy user_items_select_own on public.user_items
  for select using (auth.uid() = user_id);

-- ───────────────────────── 今日の進捗と箱入れ ─────────────────────────

/*
  今日の進捗を数え、達成済みでまだ箱に入れていないミッションを箱へ入れる。

  戻り値の例
    {
      "date": "2026-08-23",
      "replies": 3,
      "likes": 1,
      "achieved":  ["login", "reply_1", "reply_3"],
      "delivered": ["reply_3"]          ← 今回あらたに箱へ入れたぶん
    }

  ・ポイント画面を開いたときに呼ぶ。覗いたときに届いている、という形。
  ・日付は SQL 側で JST に直して決める。端末の時計に依存させない。
  ・「ログイン」はこの関数を呼べている時点で達成とみなす。ログインして
    いなければ auth.uid() が null になるので、専用の記録は要らない。
  ・箱入れの重複は daily_missions の主キーで弾く。素早く2回開いても増えない。
*/
create or replace function public.sync_daily_missions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_today     date;
  v_replies   int;
  v_likes     int;
  v_mission   text;
  v_points    int;
  v_label     text;
  v_inserted  int;
  v_achieved  text[] := '{}';
  v_delivered text[] := '{}';
begin
  if v_user_id is null then
    raise exception 'ログインが必要です';
  end if;

  v_today := (now() at time zone 'Asia/Tokyo')::date;

  -- 今日 自分が送ったメッセージの本数。
  -- 相手の発言の後かどうかは問わない（数え方は lib/points.ts のコメント参照）。
  select count(*) into v_replies
    from public.messages
   where sender_id = v_user_id
     and (created_at at time zone 'Asia/Tokyo')::date = v_today;

  -- 今日 送ったいいねの数。仕事・恋愛の合計。
  select count(*) into v_likes
    from public.reactions
   where from_user_id = v_user_id
     and type = 'like'
     and (created_at at time zone 'Asia/Tokyo')::date = v_today;

  -- 達成しているものを並べる。しきい値は lib/points.ts の goal と対。
  --
  -- 継ぎ足しに || ではなく array_append を使う。text[] || '文字列' と書くと
  -- リテラルの型が決まらず、Postgres が「配列どうしの連結」と解釈して
  -- malformed array literal になる（22P02）。
  v_achieved := array['login']::text[];
  if v_replies >= 1 then v_achieved := array_append(v_achieved, 'reply_1'); end if;
  if v_replies >= 3 then v_achieved := array_append(v_achieved, 'reply_3'); end if;
  if v_likes   >= 5 then v_achieved := array_append(v_achieved, 'like_5');  end if;

  foreach v_mission in array v_achieved loop
    insert into public.daily_missions (user_id, mission_date, mission)
    values (v_user_id, v_today, v_mission)
    on conflict do nothing;

    get diagnostics v_inserted = row_count;
    continue when v_inserted = 0;  -- もう箱に入れてある

    -- ポイントと文言。lib/points.ts の DAILY_MISSIONS と揃えること。
    -- 画面から金額を受け取らないのは、押すだけで好きな額を入れられるため。
    select p, l into v_points, v_label from (values
      ('login',   5,  'ログイン'),
      ('reply_1', 5,  'マッチ相手に1回返信'),
      ('reply_3', 10, 'マッチ相手に3回返信'),
      ('like_5',  10, 'いいねを5回送る')
    ) as t(m, p, l) where t.m = v_mission;

    insert into public.point_rewards (user_id, amount, reason, label)
    values (v_user_id, v_points, 'daily_' || v_mission, v_label);

    v_delivered := array_append(v_delivered, v_mission);
  end loop;

  return jsonb_build_object(
    'date',      v_today,
    'replies',   v_replies,
    'likes',     v_likes,
    'achieved',  to_jsonb(v_achieved),
    'delivered', to_jsonb(v_delivered)
  );
end;
$$;

-- ───────────────────────── 受け取り ─────────────────────────

/*
  受け取り箱の中身を受け取る。残高に加算し、point_events に記録する。

  p_ids を省略（null）すると、未受け取りをすべて受け取る＝まとめて受け取る。
  配列で渡せば選んだぶんだけ。

  戻り値の例
    { "claimed": 3, "awarded": 95, "points": 325 }

  ・claimed_at is null の行だけを対象にするので、二重に受け取れない。
    update ... where claimed_at is null が原子的に効く。
  ・他人の箱は user_id = auth.uid() で弾く。
*/
create or replace function public.claim_point_rewards(p_ids bigint[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count   int  := 0;
  v_awarded int  := 0;
  v_points  int;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です';
  end if;

  -- 受け取った行をその場で確定させ、金額を集計する。
  -- 先に select してから update すると、二重に押されたときに
  -- 両方が「未受け取り」と判断する隙が残る。
  with taken as (
    update public.point_rewards
       set claimed_at = now()
     where user_id = v_user_id
       and claimed_at is null
       and (p_ids is null or id = any (p_ids))
    returning amount, reason, label
  ), logged as (
    insert into public.point_events (user_id, amount, reason)
    select v_user_id, amount, reason from taken
    returning amount
  )
  select count(*), coalesce(sum(amount), 0) into v_count, v_awarded from logged;

  if v_count = 0 then
    select points into v_points from public.users where id = v_user_id;
    return jsonb_build_object('claimed', 0, 'awarded', 0, 'points', coalesce(v_points, 0));
  end if;

  update public.users
     set points = greatest(0, points + v_awarded)
   where id = v_user_id
  returning points into v_points;

  return jsonb_build_object(
    'claimed', v_count,
    'awarded', v_awarded,
    'points',  coalesce(v_points, 0)
  );
end;
$$;

-- ───────────────────────── 交換 ─────────────────────────

/*
  ポイントを使ってアイテムを1つ手に入れる。

  戻り値の例
    { "item": "coffee_ticket", "cost": 500, "quantity": 1, "points": 130 }

  ・値段はこの関数の中に持つ。画面から受け取ると 0 ポイントで交換できてしまう。
    lib/points.ts の ITEMS は表示用の写しなので、変えるときは両方を直すこと。
  ・残高が足りなければ例外にする。users.points は他の場所で
    greatest(0, ...) をかけているので、引き算だけでは負にならず
    「足りないのに交換できた」ことになってしまう。
*/
create or replace function public.exchange_item(p_item text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_cost     int;
  v_label    text;
  v_points   int;
  v_quantity int;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です';
  end if;

  select c, l into v_cost, v_label from (values
    ('super_like',    100, 'スーパーいいね'),
    ('coffee_ticket', 500, 'コーヒーチケット')
  ) as t(i, c, l) where t.i = p_item;

  if v_cost is null then
    raise exception '交換できないアイテムです: %', p_item;
  end if;

  -- 残高を減らせた場合だけ先へ進む。
  -- 条件を where に入れることで、確認と更新のあいだに割り込まれない。
  update public.users
     set points = points - v_cost
   where id = v_user_id
     and points >= v_cost
  returning points into v_points;

  if v_points is null then
    raise exception 'ポイントが足りません';
  end if;

  insert into public.user_items (user_id, item, quantity)
  values (v_user_id, p_item, 1)
  on conflict (user_id, item)
    do update set quantity = public.user_items.quantity + 1
  returning quantity into v_quantity;

  -- 履歴には負数で残す。受け取りと同じ並びに出せる
  insert into public.point_events (user_id, amount, reason)
  values (v_user_id, -v_cost, 'exchange_' || p_item);

  return jsonb_build_object(
    'item',     p_item,
    'label',    v_label,
    'cost',     v_cost,
    'quantity', v_quantity,
    'points',   v_points
  );
end;
$$;

-- ───────────────────────── 動作確認 ─────────────────────────

-- 受け取り箱の中身（claimed_at が null なら未受け取り）
-- select * from public.point_rewards order by created_at desc;

-- 今日どのミッションを箱に入れたか
-- select * from public.daily_missions order by mission_date desc, mission;

-- 持ち物
-- select * from public.user_items;

-- ポイントの履歴
-- select * from public.point_events order by created_at desc limit 20;

-- デイリーミッションをもう一度テストしたいとき。
-- 今日ぶんの記録を消すと、次にポイント画面を開いたときに再び箱へ届く。
-- 受け取り済みのポイントは戻らないので、残高は points_manual.sql で調整する。
-- delete from public.daily_missions
--  where user_id = '<自分のuuid>'
--    and mission_date = (now() at time zone 'Asia/Tokyo')::date;
