-- プロフィール充実度の達成ポイント。
--
-- マイページのプロフィールを埋めるほどポイントが貯まる。
-- 充実度が 50% / 80% / 100% に届いた時点で、それぞれ 50 / 80 / 100 ポイント。
-- 一度受け取った段は二度と受け取れない（下げてから上げ直しても増えない）。
--
-- 届いたポイントは残高に直接入らず、いったん受け取り箱（point_rewards）に入る。
-- 残高が増えるのは、ポイント画面で受け取ったとき。
--
-- 段は「ユーザー × モード × 段」の1行として持つ。仕事モードと恋愛モードは
-- 別々に数えるので、仕事で 50% を受け取っていても恋愛では改めて受け取れる。
--
-- 先に supabase/points.sql と supabase/point_rewards.sql を実行しておくこと
-- （前者が users.points と point_events、後者が受け取り箱を作る）。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 実行しないと、マイページの保存でポイントが付きません（保存自体は通ります）。
-- 即時付与だった頃に実行済みの環境でも、もう一度流せば箱入れに切り替わります。
--
-- 何度実行しても壊れません（if not exists / create or replace / drop policy if exists）。

-- ───────────────────────── 受け取った段 ─────────────────────────

create table if not exists public.profile_milestones (
  user_id    uuid        not null references public.users (id) on delete cascade,
  mode       text        not null check (mode in ('work', 'romance')),
  milestone  int         not null check (milestone in (50, 80, 100)),
  created_at timestamptz not null default now(),

  -- 「二度目は受け取れない」を DB の制約として持つ。
  -- 画面側で覚えるのではなく主キーで弾くので、同時に2回保存しても増えない。
  primary key (user_id, mode, milestone)
);

alter table public.profile_milestones enable row level security;

-- 自分が受け取った段だけ読める。バーの目盛りに印を付けるために使う。
drop policy if exists profile_milestones_select_own on public.profile_milestones;
create policy profile_milestones_select_own on public.profile_milestones
  for select using (auth.uid() = user_id);

-- insert / update / delete のポリシーは意図的に作らない。
-- 書き込みは下の claim_profile_milestones 関数だけを入口にするため
-- （関数は security definer なので RLS を通らずに書ける）。
-- point_events と同じ考え方。

-- ───────────────────────── 受け取り ─────────────────────────

/*
  届いている段のうち、まだ箱に入れていないものをまとめて受け取り箱へ入れる。

  戻り値の例（50% と 80% が同時に届いた場合）
    { "claimed": [50, 80], "awarded": 130 }

  awarded は「箱に入れた額」で、残高はまだ増えない。増えるのは
  ポイント画面で claim_point_rewards() を呼んだとき。

  ・段の記録と箱入れを1つの関数にまとめている。
    画面から分けて呼ぶと、途中で失敗したときに食い違う余地が生まれる。
    関数の中は1トランザクションなので、まとめて成功かまとめて失敗になる。

  ・insert ... on conflict do nothing が「実際に入ったか」で判定する。
    先に select して確認してから insert すると、素早く2回保存したときに
    どちらも「まだ無い」と判断して二重に付く隙が残る。

  ・対象ユーザーを引数で受けず auth.uid() を使う（他人に付けられないように）。

  ・p_percent は画面から受け取る。DB 側で数え直せば改竄を防げるが、
    数え方が TypeScript と SQL に二重化して食い違いの元になる。
    数え方の出どころを lib/profile-completion.ts の1箇所に保つことを優先した。
    社内向けの範囲での割り切りなので、外部公開するなら作り直すこと。
*/
create or replace function public.claim_profile_milestones(
  p_mode    text,
  p_percent int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_milestone int;
  v_inserted  int;
  v_claimed   int[] := '{}';
  v_awarded   int   := 0;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です';
  end if;
  if p_mode is null or p_mode not in ('work', 'romance') then
    raise exception 'モードは work か romance を指定してください';
  end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception '充実度は0〜100で指定してください';
  end if;

  -- 低い段から順に見る。50% を飛ばして 80% に届いた場合も、
  -- 両方まとめて受け取れる（初回保存でいきなり埋めたとき）。
  foreach v_milestone in array array[50, 80, 100] loop
    continue when p_percent < v_milestone;

    insert into public.profile_milestones (user_id, mode, milestone)
    values (v_user_id, p_mode, v_milestone)
    on conflict do nothing;

    get diagnostics v_inserted = row_count;
    continue when v_inserted = 0;  -- 受け取り済み

    -- ポイント数は段の数字と同じ（50% → 50pt）
    v_claimed := v_claimed || v_milestone;
    v_awarded := v_awarded + v_milestone;

    -- 残高には足さず、受け取り箱へ入れる
    insert into public.point_rewards (user_id, amount, reason, label)
    values (
      v_user_id,
      v_milestone,
      'profile_' || v_milestone || '_' || p_mode,
      'プロフィール達成（'
        || case p_mode when 'work' then '仕事' else '恋愛' end
        || 'モード ' || v_milestone || '%）'
    );
  end loop;

  return jsonb_build_object(
    'claimed', to_jsonb(v_claimed),
    'awarded', v_awarded
  );
end;
$$;

-- ───────────────────────── 動作確認 ─────────────────────────

-- 受け取った段
-- select * from public.profile_milestones order by created_at desc;

-- 受け取り箱に届いたぶん（claimed_at が null なら未受け取り）
-- select * from public.point_rewards where reason like 'profile_%' order by created_at desc;

-- もう一度テストしたいとき。段の記録を消すと再び受け取れるようになる。
-- 残高そのものを戻す手順は supabase/points_manual.sql にある。
-- delete from public.profile_milestones where user_id = '<自分のuuid>';
