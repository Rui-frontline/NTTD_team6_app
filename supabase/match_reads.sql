-- トークの既読位置。
-- 「どの会話を、どこまで読んだか」をユーザーごとに1行で持つ。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 実行しないと未読バッジは常に「全件未読」の状態になります。
--
-- 何度実行しても壊れません（if not exists / create or replace）。
-- 以前に実行済みの人も、末尾の mark_match_read 関数のために一度流し直してください。

create table if not exists public.match_reads (
  match_id     bigint      not null references public.matches (id) on delete cascade,
  user_id      uuid        not null references public.users (id) on delete cascade,
  -- 読んだ最後のメッセージの created_at。
  -- これより新しい「相手からの」メッセージを未読として数える。
  last_read_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- 一覧を開くたびに「自分の既読位置」をまとめて引くので、user_id から引ける形にしておく
create index if not exists match_reads_user_id_idx on public.match_reads (user_id);

alter table public.match_reads enable row level security;

-- 既読位置は本人以外に見せない・触らせない。
-- 「相手がいつ読んだか」が他人から分かると、仕様書 7章（片思いは不可視）の前提が崩れる。
drop policy if exists match_reads_select_own on public.match_reads;
create policy match_reads_select_own on public.match_reads
  for select using (auth.uid() = user_id);

drop policy if exists match_reads_insert_own on public.match_reads;
create policy match_reads_insert_own on public.match_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists match_reads_update_own on public.match_reads;
create policy match_reads_update_own on public.match_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 既読位置を「前に進めるだけ」で更新する。
--
-- 画面から素の upsert を投げると、書き込みが2つ重なったときに古いほうが後から
-- 届いて last_read_at が巻き戻り、いちど消したバッジが復活してしまう。
-- greatest() で比べることで、どの順番で届いても後退しない。
--
-- user_id は引数で受け取らず auth.uid() を使う。他人の既読位置を書けなくするため。
-- security invoker（既定）なので、上の RLS ポリシーもそのまま効く。
create or replace function public.mark_match_read(
  p_match_id bigint,
  p_read_at  timestamptz
)
returns void
language sql
as $$
  insert into public.match_reads (match_id, user_id, last_read_at)
  values (p_match_id, auth.uid(), p_read_at)
  on conflict (match_id, user_id) do update
    set last_read_at = greatest(match_reads.last_read_at, excluded.last_read_at);
$$;
