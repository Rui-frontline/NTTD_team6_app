-- ブロック。
--
-- 「この相手をもう自分の画面に出さない」を1行で持つ。
-- 恋愛モードだけで使う想定だが、仕事モードで必要になったときに
-- 作り直さずに済むよう mode を持たせてある（画面側で恋愛モードに限っている）。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 実行しないと、トーク画面のブロックボタンがエラーになります。
--
-- 何度実行しても壊れません（if not exists / drop policy if exists）。

create table if not exists public.blocks (
  blocker_id uuid        not null references public.users (id) on delete cascade,
  blocked_id uuid        not null references public.users (id) on delete cascade,
  mode       text        not null check (mode in ('work', 'romance')),
  created_at timestamptz not null default now(),

  -- 同じ相手を二重にブロックしても1行のまま
  primary key (blocker_id, blocked_id, mode),
  -- 自分自身はブロックできない
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- 「自分がブロックした相手」を、トーク一覧と探す画面の両方で毎回引く。
-- その形に合わせて blocker_id + mode で張る。
create index if not exists blocks_blocker_idx
  on public.blocks (blocker_id, mode);

alter table public.blocks enable row level security;

-- ブロックしたことは、ブロックした本人にしか見せない。
--
-- blocked_id 側から読めてしまうと「自分はブロックされた」と分かってしまう。
-- 相手に伝わらないのがブロックの前提なので、select は blocker_id だけに限る。
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select using (auth.uid() = blocker_id);

-- 他人の名前でブロックを作れないよう、blocker_id は必ず自分に限る
drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert with check (auth.uid() = blocker_id);

-- 解除の画面はまだ無いが、SQL Editor から戻せるように delete も開けておく。
-- デモの練習でブロックしてしまったときは、次の1行で戻せる。
--
--   delete from public.blocks where blocker_id = '<自分のuuid>';
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete using (auth.uid() = blocker_id);
