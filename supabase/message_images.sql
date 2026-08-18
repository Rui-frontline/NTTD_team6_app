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

-- 公開バケットにしている。
-- 保存先は message-images/<matchId>/<ランダムなuuid>.jpg なので、
-- URL を知らない人がたどり着くことは実質できない。
-- ただし URL が漏れれば誰でも見られる点は、署名付きURLに変えるまでの割り切り。
insert into storage.buckets (id, name, public)
values ('message-images', 'message-images', true)
on conflict (id) do nothing;

-- 投稿できるのはログイン済みの人だけ。バケットは限定する。
drop policy if exists message_images_insert on storage.objects;
create policy message_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-images');

-- 公開バケットなので URL から直接見るぶんにはポリシー不要だが、
-- API 経由で読む場合のために許可しておく。
drop policy if exists message_images_select on storage.objects;
create policy message_images_select on storage.objects
  for select to public
  using (bucket_id = 'message-images');

-- 後片付け用。マッチを消しても Storage のファイルは自動では消えないので、
-- 不要になったものは手で消せるようにしておく。
drop policy if exists message_images_delete on storage.objects;
create policy message_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'message-images');
