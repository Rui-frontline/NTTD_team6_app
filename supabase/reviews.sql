-- 口コミ（星5評価）。
--
-- 十分に会話した相手にだけ星をつけられる。集計した平均をプロフィール詳細に出す。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 実行しないと星は一切出ません（エラーにはならず、無言で表示が消えます）。
--
-- 何度実行しても壊れません（if not exists / create or replace）。

-- ───────────────────────── 評価 ─────────────────────────

create table if not exists public.reviews (
  id          bigserial   primary key,
  match_id    bigint      not null references public.matches (id) on delete cascade,
  -- 付けた人
  reviewer_id uuid        not null references public.users (id) on delete cascade,
  -- 付けられた人
  reviewee_id uuid        not null references public.users (id) on delete cascade,
  -- 仕事の星と恋愛の星は混ぜない。評価している中身が違うため
  mode        text        not null check (mode in ('work', 'romance')),
  rating      int         not null check (rating between 1 and 5),
  created_at  timestamptz not null default now(),
  -- 1つの会話につき1人1回。付け直しは想定しない
  unique (match_id, reviewer_id)
);

-- 平均は「ある人の、あるモードのぶん」をまとめて数えるので、その形で張る
create index if not exists reviews_reviewee_idx
  on public.reviews (reviewee_id, mode);

alter table public.reviews enable row level security;

-- 自分が付けたぶんだけ読める。
--
-- 「自分が誰に何点付けたか」は必要（同じ会話で二度求めないため）。
-- 「誰が自分に何点付けたか」は読めてはいけない。個別の行が引けると、
-- 低い点を付けた相手が特定できてしまう。平均だけを get_user_rating で出す。
drop policy if exists reviews_select_own on public.reviews;
create policy reviews_select_own on public.reviews
  for select using (auth.uid() = reviewer_id);

-- insert / update / delete のポリシーは意図的に作らない。
-- 書き込みは下の submit_review だけを入口にするため
-- （関数は security definer なので RLS を通らずに書ける）。

-- ───────────────────────── 送信 ─────────────────────────

/*
  星をつける。

  画面から素の insert を許すと、会話していない相手にも星を付けられる。
  誰に・どのモードで付けるかを引数で受けず、マッチの行から決めているのも
  同じ理由で、他人になりすました書き込みを防ぐため。

  規定の往復数に達しているかもここで確かめる。画面側にも同じ判定があるが、
  そちらは表示のためのもので、通信を直接叩けば回避できる。

  往復数は least(自分の通数, 相手の通数) で数える。合計で数えると片方の
  連投だけで達してしまい、会話が成立していなくても評価を求めることになる。

  ・しきい値は下の c_threshold にまとめてある。lib/reviews.ts の
    REVIEW_RALLY_THRESHOLD と同じ値にすること。片方だけ変えると、画面には
    出るのに送信が弾かれる。SQL を直したら Supabase で流し直すところまで
    やらないと反映されない。
*/
create or replace function public.submit_review(
  p_match_id bigint,
  p_rating   int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 評価を求めるまでの往復回数。lib/reviews.ts の REVIEW_RALLY_THRESHOLD と揃える
  c_threshold constant int := 5;

  v_me      uuid := auth.uid();
  v_match   public.matches%rowtype;
  v_partner uuid;
  v_mine    int;
  v_theirs  int;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception '星は1〜5で指定してください';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'その会話は存在しません';
  end if;

  if v_me is distinct from v_match.user_a_id
     and v_me is distinct from v_match.user_b_id then
    raise exception 'その会話の参加者ではありません';
  end if;

  v_partner := case
    when v_match.user_a_id = v_me then v_match.user_b_id
    else v_match.user_a_id
  end;

  select count(*) filter (where sender_id = v_me),
         count(*) filter (where sender_id = v_partner)
    into v_mine, v_theirs
    from public.messages
   where match_id = p_match_id;

  if least(v_mine, v_theirs) < c_threshold then
    raise exception 'まだ%往復に達していません', c_threshold;
  end if;

  -- 二重送信で落ちないようにする。付け直しもここで黙って無視される
  insert into public.reviews (match_id, reviewer_id, reviewee_id, mode, rating)
  values (p_match_id, v_me, v_partner, v_match.mode, p_rating)
  on conflict (match_id, reviewer_id) do nothing;
end;
$$;

-- ───────────────────────── 集計 ─────────────────────────

/*
  ある人の、あるモードの平均と件数を返す。

  security definer にしているのは、reviews の select ポリシーが
  「自分が付けたぶんだけ」だから。他人の評価は行としては引けないが、
  平均という形でだけ外に出す。個々の点数や誰が付けたかは漏れない。

  1件も無いときは (null, 0) が1行返る。呼ぶ側で「評価なし」に落とす。
*/
create or replace function public.get_user_rating(
  p_user_id uuid,
  p_mode    text
)
returns table (average numeric, total int)
language sql
security definer
set search_path = public
as $$
  select round(avg(rating)::numeric, 1), count(*)::int
    from public.reviews
   where reviewee_id = p_user_id
     and mode = p_mode;
$$;
