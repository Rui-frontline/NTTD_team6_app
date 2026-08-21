-- ポイント保有機能。
--
-- 残高（users.points）と履歴（point_events）の2本立てにしている。
-- 何をしたら貯まるかは未定なので、ルールが決まったら reason を足していく。
-- 残高だけだと「なぜこの点数なのか」を後から追えないため、履歴を残す。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 何度実行しても壊れません（if not exists / create or replace）。

-- ───────────────────────── 残高 ─────────────────────────

alter table public.users
  add column if not exists points int not null default 0;

-- ───────────────────────── 履歴 ─────────────────────────

create table if not exists public.point_events (
  id         bigserial   primary key,
  user_id    uuid        not null references public.users (id) on delete cascade,
  -- 増減。将来ポイントを使う機能が入ったときのために負数も許す
  amount     int         not null,
  -- 何で貯まったか。'first_message' のように、ルールが増えるたびに種類が増える
  reason     text        not null,
  created_at timestamptz not null default now()
);

-- 履歴は「自分のぶんを新しい順に」しか引かないので、その形でインデックスを張る
create index if not exists point_events_user_id_idx
  on public.point_events (user_id, created_at desc);

alter table public.point_events enable row level security;

-- 自分の履歴だけ読める
drop policy if exists point_events_select_own on public.point_events;
create policy point_events_select_own on public.point_events
  for select using (auth.uid() = user_id);

-- insert / update / delete のポリシーは意図的に作らない。
-- 書き込みは下の award_points 関数だけを入口にするため
-- （関数は security definer なので RLS を通らずに書ける）。

-- ───────────────────────── 加算 ─────────────────────────

/*
  ポイントを増やす。増やしたあとの残高を返す。

  ・履歴の追加と残高の更新を1つの関数にまとめている。
    画面から2回に分けて呼ぶと、片方だけ成功して食い違う余地が生まれる。
    関数の中は1トランザクションなので、両方成功か両方失敗のどちらかになる。

  ・対象ユーザーを引数で受けず auth.uid() を使う。
    他人のポイントを増やせないようにするため。

  ・greatest(0, ...) で残高が負にならないようにしている。
    ポイントを使う機能が入ったときの保険。
*/
create or replace function public.award_points(p_amount int, p_reason text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_points  int;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'ポイントは0以外を指定してください';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception '理由を指定してください';
  end if;

  insert into public.point_events (user_id, amount, reason)
  values (v_user_id, p_amount, p_reason);

  update public.users
     set points = greatest(0, points + p_amount)
   where id = v_user_id
  returning points into v_points;

  return v_points;
end;
$$;

-- ───────────────────────── 動作確認 ─────────────────────────
--
-- 獲得ルールがまだ無いので、確認したいときは手でポイントを増減する。
-- その手順は supabase/points_manual.sql にまとめてある。
--
-- このファイルは「箱を作る」ためのもの、あちらは「中身をいじる」ためのもの。
-- 分けているのは、こちらを通しで実行してもデータが変わらないようにするため。
