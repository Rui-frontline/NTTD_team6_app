-- プロフィールアイコンの置き場所。
--
-- マイページで選ばれた写真を Storage に置き、users.avatar_url には
-- その公開URLだけを入れる。探す画面やトーク画面はそのURLを見るだけなので、
-- どの画面でも同じ写真が出る。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 何度実行しても壊れません。

-- 公開バケット。/object/public/... は RLS を通らずに配信されるので、
-- 画像を <img> で出すだけならポリシーは要らない。
--
-- サイズと種類はバケット側でも縛る。
-- 画面側（lib/image.ts）でも 500KB / JPEG に収めているが、そちらは
-- Storage API を直接叩かれれば迂回できるので、ここが最後の砦になる。
--
-- すでにバケットがある場合も設定を上書きしたいので do update にしている。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1024 * 1024,              -- 1MB。画面側の上限 500KB に対する余裕分
  array['image/jpeg']       -- 上げるのは JPEG だけ
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 置けるのは「自分のIDのフォルダ」だけ。
--
-- 保存先は avatars/<userId>/<ランダムなuuid>.jpg なので、
-- 先頭のフォルダ名が自分の uuid かを確かめる。
-- これが無いと、ログインさえしていれば他人のフォルダに置けてしまう。
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- SELECT と DELETE のポリシーは意図的に作らない。
--
-- SELECT を開けると Storage API の list() で全員のフォルダを列挙できる。
-- 表示は公開URL経由で RLS を通らないので、ポリシーは不要。
--
-- DELETE を開けると、ログインした誰もが他人のアイコンを消せてしまう。
-- 消えても users.avatar_url は残るので、画像が恒久的に壊れる。
-- アイコンを変えるたびに新しいファイルを置くだけにして、古いぶんの
-- 片付けは Supabase の画面（service role なので RLS を通らない）から行う。
drop policy if exists avatars_select on storage.objects;
drop policy if exists avatars_delete on storage.objects;