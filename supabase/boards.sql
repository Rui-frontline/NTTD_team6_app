-- 募集掲示板機能。
--
-- プロジェクトメンバーや趣味仲間を募集できる掲示板。
-- モード（仕事/恋愛）ごとに分かれており、参加者同士でグループチャットができる。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 何度実行しても壊れません（if not exists / create or replace）。

-- ───────────────────────── 募集投稿 ─────────────────────────

create table if not exists public.boards (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.users (id) on delete cascade,
  mode            text        not null check (mode in ('work', 'romance')),
  title           text        not null,
  description     text        not null,
  -- null = 無制限
  max_participants int        check (max_participants is null or max_participants > 0),
  -- null = 無期限
  deadline        timestamptz,
  -- 募集中 / 募集終了
  status          text        not null default '募集中' check (status in ('募集中', '募集終了')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- モードごとに新しい順に取得する
create index if not exists boards_mode_created_idx
  on public.boards (mode, created_at desc);

alter table public.boards enable row level security;

-- モード参加者のみ閲覧可能
drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and boards.mode = any(enabled_modes)
    )
  );

-- ログイン済みなら誰でも投稿可能
drop policy if exists boards_insert on public.boards;
create policy boards_insert on public.boards
  for insert with check (auth.uid() = user_id);

-- 投稿者のみ編集可能
drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards
  for update using (auth.uid() = user_id);

-- 投稿者のみ削除可能
drop policy if exists boards_delete on public.boards;
create policy boards_delete on public.boards
  for delete using (auth.uid() = user_id);

-- ───────────────────────── 参加者 ─────────────────────────

create table if not exists public.board_participants (
  board_id    uuid        not null references public.boards (id) on delete cascade,
  user_id     uuid        not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- 募集ごとに参加者一覧を取得する
create index if not exists board_participants_board_idx
  on public.board_participants (board_id, created_at);

alter table public.board_participants enable row level security;

-- モード参加者のみ閲覧可能
drop policy if exists board_participants_select on public.board_participants;
create policy board_participants_select on public.board_participants
  for select using (
    exists (
      select 1 from public.boards
      where id = board_id
      and exists (
        select 1 from public.users
        where users.id = auth.uid()
        and boards.mode = any(users.enabled_modes)
      )
    )
  );

-- ログイン済みなら誰でも参加可能
drop policy if exists board_participants_insert on public.board_participants;
create policy board_participants_insert on public.board_participants
  for insert with check (auth.uid() = user_id);

-- 自分の参加のみ削除可能（退出）
drop policy if exists board_participants_delete on public.board_participants;
create policy board_participants_delete on public.board_participants
  for delete using (auth.uid() = user_id);

-- ───────────────────────── グループチャット ─────────────────────────

create table if not exists public.board_messages (
  id         uuid        primary key default gen_random_uuid(),
  board_id   uuid        not null references public.boards (id) on delete cascade,
  user_id    uuid        not null references public.users (id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);

-- 募集ごとに新しい順に取得する
create index if not exists board_messages_board_idx
  on public.board_messages (board_id, created_at desc);

alter table public.board_messages enable row level security;

-- 参加者のみ閲覧可能
drop policy if exists board_messages_select on public.board_messages;
create policy board_messages_select on public.board_messages
  for select using (
    exists (
      select 1 from public.board_participants
      where board_id = board_messages.board_id
      and user_id = auth.uid()
    )
  );

-- 参加者のみ投稿可能
drop policy if exists board_messages_insert on public.board_messages;
create policy board_messages_insert on public.board_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.board_participants
      where board_id = board_messages.board_id
      and user_id = auth.uid()
    )
  );

-- ───────────────────────── 投稿作成時の自動参加 ─────────────────────────

-- 募集を投稿したら、自動的に参加者に追加する
create or replace function public.auto_join_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.board_participants (board_id, user_id)
  values (new.id, new.user_id);
  return new;
end;
$$;

drop trigger if exists auto_join_board_trigger on public.boards;
create trigger auto_join_board_trigger
  after insert on public.boards
  for each row
  execute function public.auto_join_board();
