-- スーパーいいね。
--
-- 相手に「この人からいいねが来た」と伝わるいいね。普通のいいねは相互に
-- なるまで相手に見えないが、これは送った時点で相手の探す画面に出る。
-- 送る側が自分で選んで明かす形なので、片思いが勝手に露出することはない。
--
-- 100pt で交換したアイテム（user_items の super_like）を1つ消費する。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 実行しないとスーパーいいねが使えません（普通のいいねは今までどおり動きます）。
--
-- 先に supabase/point_rewards.sql を流しておいてください（user_items を使います）。
-- 何度実行しても壊れません（if not exists / create or replace）。

-- ───────────────────────── 列を足す ─────────────────────────

-- 既存のいいねはすべて普通のいいねなので、既定値は false でよい
alter table public.reactions
  add column if not exists is_super boolean not null default false;

-- 引くのは「自分に届いているスーパーいいね」だけ。
-- 部分インデックスにして、普通のいいねの行で太らせない。
create index if not exists reactions_super_incoming_idx
  on public.reactions (to_user_id, mode)
  where is_super;

-- ───────────────────────── 送る ─────────────────────────

/*
  スーパーいいねを送る。

  アイテムの消費と反応の記録を1つの関数にまとめている。画面から2回に分けて
  呼ぶと、片方だけ成功して「アイテムだけ減った」「消費せずに送れた」が
  起きる。関数の中は1トランザクションなので、途中で raise すれば
  すべて巻き戻る。

  送り主を引数で受けず auth.uid() を使う。他人の名前で送れないようにする
  ため。アイテムも auth.uid() のぶんしか減らせない。

  在庫の判定を先に置いているのは、両方に引っかかる場合に「持っていません」
  の方が次の行動に繋がるから（交換すればよい）。
*/
create or replace function public.use_super_like(
  p_to_user_id uuid,
  p_mode       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       uuid := auth.uid();
  v_inserted int;
begin
  if v_me is null then
    raise exception 'ログインが必要です';
  end if;

  if v_me = p_to_user_id then
    raise exception '自分にはスーパーいいねできません';
  end if;

  if p_mode not in ('work', 'romance') then
    raise exception 'モードの指定が不正です';
  end if;

  -- 在庫を1つ減らす。quantity >= 1 を条件に入れているので、
  -- 0 のときはどの行にも当たらず not found になる
  update public.user_items
     set quantity = quantity - 1
   where user_id = v_me
     and item = 'super_like'
     and quantity >= 1;

  if not found then
    raise exception 'スーパーいいねを持っていません';
  end if;

  -- すでにいいね済み・見送り済みの相手には送れない（reactions の一意制約）。
  -- 行が増えなかった場合はここで打ち切る。上の update も巻き戻る
  insert into public.reactions (from_user_id, to_user_id, mode, type, is_super)
  values (v_me, p_to_user_id, p_mode, 'like', true)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted <> 1 then
    raise exception 'この相手にはすでに反応しています';
  end if;
end;
$$;
