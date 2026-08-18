-- トークに送る写真の置き場所。
--
-- 写真は messages.body に data URL として直接入れていたが、
-- 一覧（5秒）と会話（3秒）のポーリングが本文を毎回取り直すため、
-- 写真が溜まるほど転送量が線形に増え続けていた。
-- 無料枠の Egress は月 5GB しかなく、数人が動作確認するだけで尽きる。
--
-- 画像そのものは Storage に置き、本文には URL だけを入れる。
-- URL ならブラウザがキャッシュするので、2回目以降は転送が発生しない。
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
  'message-images',
  'message-images',
  true,
  1024 * 1024,              -- 1MB。画面側の上限 500KB に対する余裕分
  array['image/jpeg']       -- 送るのは JPEG だけ
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 置けるのは「自分が参加しているマッチのフォルダ」だけ。
--
-- 保存先は message-images/<matchId>/<ランダムなuuid>.jpg なので、
-- 先頭のフォルダ名が matchId になる。そこに自分がいるかを確かめる。
-- これが無いと、ログインさえしていれば他人のマッチのフォルダにも、
-- 何個でもファイルを置けてしまう（容量を食い潰される）。
--
-- m.id::text と比べているのは、フォルダ名が数字でないときに
-- キャストで例外を出さず、単に不許可にするため。
drop policy if exists message_images_insert on storage.objects;
create policy message_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-images'
    and exists (
      select 1
      from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and auth.uid() in (m.user_a_id, m.user_b_id)
    )
  );

-- SELECT と DELETE のポリシーは意図的に作らない。
--
-- SELECT を public に開けると、匿名でも Storage API の list() で
-- 全マッチのフォルダ名と画像パスを列挙できてしまう。
-- 表示は公開URL経由で RLS を通らないので、ポリシーは不要。
--
-- DELETE を authenticated に開けると、ログインした誰もが他人の写真を
-- 消せてしまう。消えても messages.body の URL は残るため、
-- 会話の画像が恒久的に壊れる。アプリはクライアントから削除を呼ばない。
--
-- 片付けは Supabase の画面（service role で動くので RLS を通らない）から行う。
-- 手順は supabase/cleanup_message_images.sql を参照。
drop policy if exists message_images_select on storage.objects;
drop policy if exists message_images_delete on storage.objects;
