-- トークの写真を片付けるための手順書。
--
-- ⚠️ このファイルは「通しで実行」しないでください。
--    消す文はコメントアウトしてあります。確認の SELECT を先に流し、
--    結果を見てから、必要な行だけコメントを外して実行してください。
--
-- 前提として、DB と Storage は別の仕組みです。
--   ・messages を消しても、Storage の画像ファイルは残る
--   ・Storage の画像を消しても、messages の行は残る（吹き出しが壊れた画像になる）
-- どちらか片方だけ消すと中途半端な状態になるので、両方消すのが基本です。


-- ────────────────────────────────────────────────
-- 1. 古い形式（data URL）の写真を消す
-- ────────────────────────────────────────────────
-- Storage を使う前は、画像そのものを messages.body に入れていました。
-- これらは Storage にファイルがないので、DB から消すだけで完結します。
-- 1行が数百KBあるので、残っていると DB 容量（無料枠 500MB）を圧迫します。

-- 確認
select id, match_id, sender_id, length(body) as 本文の長さ, created_at
from public.messages
where body like 'data:image/%'
order by id;

-- 実行するときはコメントを外す
-- delete from public.messages where body like 'data:image/%';


-- ────────────────────────────────────────────────
-- 2. どのメッセージからも参照されていない Storage の画像を探す
-- ────────────────────────────────────────────────
-- メッセージを消しても Storage のファイルは残るため、孤児が溜まります。
-- まず何が余っているかを確認します。

select
  o.name                        as パス,
  round(
    (o.metadata ->> 'size')::numeric / 1024
  )                             as サイズKB,
  o.created_at
from storage.objects o
where o.bucket_id = 'message-images'
  and not exists (
    select 1
    from public.messages m
    where m.body like '%/message-images/' || o.name
  )
order by o.created_at;

-- ⚠️ ここで出たファイルの消し方
--
-- SQL で storage.objects から delete するのは避けてください。
-- 行を消すと URL からは見えなくなりますが、実体のファイルが残って
-- 容量を消費し続ける場合があります。
--
-- Supabase の画面から消してください:
--   Storage → message-images → 該当のフォルダ/ファイルを選択 → Delete
--
-- パスは <matchId>/<uuid>.jpg なので、フォルダ単位でまとめて消せます。


-- ────────────────────────────────────────────────
-- 3. 特定のマッチの写真をまとめて消す
-- ────────────────────────────────────────────────
-- 「このマッチの会話ごと消したい」ときの手順です。
-- match_id は 手順1・2 の結果や、トーク一覧を見て決めてください。

-- 確認（12 は実際の match_id に置き換える）
select id, sender_id, left(body, 60) as 本文の先頭, created_at
from public.messages
where match_id = 12
order by id;

-- ① DB から消す（実行するときはコメントを外す）
-- delete from public.messages where match_id = 12;

-- ② Storage から消す
--    Supabase の画面で Storage → message-images → 「12」フォルダを削除。
--    ①だけだと画像ファイルが残り、②だけだと壊れた画像の吹き出しが残ります。


-- ────────────────────────────────────────────────
-- 4. いま Storage をどれくらい使っているか
-- ────────────────────────────────────────────────
-- 無料枠は 1GB です。写真1枚あたり最大 500KB なので、通常は問題になりません。

select
  count(*)                                                  as 枚数,
  round(sum((metadata ->> 'size')::numeric) / 1024 / 1024, 2) as 合計MB
from storage.objects
where bucket_id = 'message-images';
