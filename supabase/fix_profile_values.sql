-- 部署と職種を、選択肢の値に揃える。
--
-- 部署は「会社 / 区分 / 本部 / 部」を選ぶ形（lib/departments.ts）、
-- 職種も選択式（lib/profile-fields.ts の JOB_TITLE_OPTIONS）になった。
-- それ以前に作ったテストアカウントは「第一システム部」「エンジニア」の
-- ような選択肢に無い値を持っているので、有効なものに置き換える。
--
-- ⚠️ このファイルは「通しで実行」しないでください。
--    書き換える文（手順2）はコメントアウトしてあります。
--    手順1で対象を確認してから、コメントを外して実行してください。
--
-- ⚠️ 区切りの「 / 」（前後に半角スペース）は lib/departments.ts の
--    DEPARTMENT_SEPARATOR と一致していないと、マイページで選択が復元できない。
--    片方だけ変えないこと。
--
-- 先に supabase/profile_fields.sql を実行しておくこと（department_path 列を作る）。


-- ────────────────────────────────────────────────
-- 0. 有効な値の一覧
-- ────────────────────────────────────────────────
-- アプリ側の定義と対になっている。選択肢を増やしたらここにも足すこと。

-- lib/departments.ts の DEPARTMENT_TREE の葉をすべて並べたもの。
-- 末端の名前は経路から切り出すので、二重に書かなくてよい。
create or replace view public.valid_departments as
select path, split_part(path, ' / ', array_length(string_to_array(path, ' / '), 1)) as leaf
from (values
  ('株式会社NTTデータグループ / コーポレートスタッフ / グループ経営企画統括本部 / コーポレート戦略本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / グループ経営企画統括本部 / サステナビリティ経営推進本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / グループ経営企画統括本部 / グローバルイノベーション本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / グループ経営企画統括本部 / コンサルティング＆ビジネスアクセラレーション本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / グループ経営企画統括本部 / プロキュアメント部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / 財務本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / 人事本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / グローバルガバナンス本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / グローバルマーケティング＆コミュニケーション本部'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / ITマネジメント室'),
  ('株式会社NTTデータグループ / コーポレートスタッフ / 監査部'),
  ('株式会社NTTデータグループ / コストセンタ / 技術革新統括本部 / 技術戦略推進部'),
  ('株式会社NTTデータグループ / コストセンタ / 技術革新統括本部 / AI技術部'),
  ('株式会社NTTデータグループ / コストセンタ / 技術革新統括本部 / Innovation技術部'),
  ('株式会社NTTデータグループ / コストセンタ / 技術革新統括本部 / 先進エンジニアリング技術部'),
  ('株式会社NTTデータグループ / コストセンタ / 技術革新統括本部 / 品質保証部'),
  ('株式会社NTTデータ / コーポレートスタッフ / 経営企画本部'),
  ('株式会社NTTデータ / コーポレートスタッフ / 監査部'),
  ('株式会社NTTデータ / コンサルティングセグメント / 戦略コンサルティング本部'),
  ('株式会社NTTデータ / テクノロジーセグメント / テクノロジービジネス事業本部'),
  ('株式会社NTTデータ / テクノロジーセグメント / AI事業本部'),
  ('株式会社NTTデータ / テクノロジーセグメント / インフラストラクチャ事業本部'),
  ('株式会社NTTデータ / 公共・社会基盤分野 / 社会DXコンサルティング事業本部'),
  ('株式会社NTTデータ / 公共・社会基盤分野 / 第一公共事業本部'),
  ('株式会社NTTデータ / 公共・社会基盤分野 / 第二公共事業本部'),
  ('株式会社NTTデータ / 公共・社会基盤分野 / 第三公共事業本部'),
  ('株式会社NTTデータ / 公共・社会基盤分野 / テレコム・ユーティリティ事業本部'),
  ('株式会社NTTデータ / 金融分野 / 第一金融事業本部'),
  ('株式会社NTTデータ / 金融分野 / 第二金融事業本部'),
  ('株式会社NTTデータ / 金融分野 / 第三金融事業本部'),
  ('株式会社NTTデータ / 金融分野 / 金融イノベーション本部'),
  ('株式会社NTTデータ / 金融分野 / 金融高度技術本部'),
  ('株式会社NTTデータ / 法人分野 / インダストリ統括本部'),
  ('株式会社NTTデータ / 法人分野 / コンサルティング事業本部'),
  ('株式会社NTTデータ / 法人分野 / ペイメント事業本部'),
  ('株式会社NTTデータ / 法人分野 / ビジネスエンジニアリング＆イノベーション事業本部'),
  ('株式会社NTTデータ / 法人分野 / EAS事業本部')
) as t(path);

-- lib/profile-fields.ts の JOB_TITLE_OPTIONS と同じ並び。
-- 「R＆D」の「＆」は全角。半角にすると一致しなくなる。
create or replace view public.valid_job_titles as
select title from (values
  ('システムエンジニア'),
  ('プロジェクトマネージャー'),
  ('企画・営業'),
  ('コンサルタント'),
  ('R＆D'),
  ('人事'),
  ('経理・財務'),
  ('法務'),
  ('経営企画'),
  ('その他')
) as t(title);


-- ────────────────────────────────────────────────
-- 1. 直す必要がある人を見る
-- ────────────────────────────────────────────────
-- 部署が選択肢に無い / 経路が空 / 職種が選択肢に無い、のいずれか。
-- email が入っている行は実アカウントなので、書き換えてよいか確かめること。

select
  u.name,
  au.email,
  u.department,
  u.department not in (select leaf from public.valid_departments) as 部署が選択肢外,
  coalesce(u.department_path, '') = ''                            as 経路が空,
  u.job_title,
  u.job_title not in (select title from public.valid_job_titles)  as 職種が選択肢外
from public.users u
left join auth.users au on au.id = u.id
where u.department not in (select leaf from public.valid_departments)
   or coalesce(u.department_path, '') = ''
   or u.job_title not in (select title from public.valid_job_titles)
order by au.email nulls last, u.name;


-- ────────────────────────────────────────────────
-- 2. 部署と職種をまとめて割り当てる
-- ────────────────────────────────────────────────
-- 有効な37部署と10職種を、それぞれ順ぐりに配る。個数が違うので
-- 組み合わせもばらける。
--
-- すでに有効な値が入っている項目は書き換えない。部署だけおかしい人の
-- 職種は残るし、その逆も同じ。部署が有効なのに経路だけ空の場合は、
-- 経路だけを埋める。
--
-- ⚠️ 手順1に出た人すべてが対象です。実アカウントが混ざっていないか
--    確認してから、コメントを外して実行してください。

-- with valid_dep as (
--   select path, leaf, row_number() over (order by path) as n
--   from public.valid_departments
-- ), valid_job as (
--   select title, row_number() over (order by title) as n
--   from public.valid_job_titles
-- ), dep_count as (select count(*)::int as c from valid_dep),
--    job_count as (select count(*)::int as c from valid_job),
-- target as (
--   select
--     u.id,
--     u.department,
--     u.department_path,
--     u.job_title,
--     u.department in (select leaf from valid_dep)  as dep_ok,
--     u.job_title  in (select title from valid_job) as job_ok,
--     (row_number() over (order by u.id) - 1)       as rn
--   from public.users u
--   where u.department not in (select leaf from valid_dep)
--      or coalesce(u.department_path, '') = ''
--      or u.job_title not in (select title from valid_job)
-- )
-- update public.users u
--    set department = case when t.dep_ok then t.department else d.leaf end,
--        department_path = case
--          -- 部署も経路も揃っているならそのまま
--          when t.dep_ok and coalesce(t.department_path, '') <> '' then t.department_path
--          -- 部署は有効だが経路が空 → その部署の経路を埋める
--          when t.dep_ok then (
--            select vp.path from valid_dep vp
--            where vp.leaf = t.department order by vp.path limit 1
--          )
--          -- 部署ごと割り当て直す
--          else d.path
--        end,
--        job_title = case when t.job_ok then t.job_title else j.title end
--   from target t, dep_count, job_count, valid_dep d, valid_job j
--  where u.id = t.id
--    and d.n = (t.rn % dep_count.c) + 1
--    and j.n = (t.rn % job_count.c) + 1;


-- ────────────────────────────────────────────────
-- 3. 確認
-- ────────────────────────────────────────────────

-- 直っていない人が残っていないか（0行になれば完了）
-- select name, department, department_path, job_title
-- from public.users
-- where department not in (select leaf from public.valid_departments)
--    or coalesce(department_path, '') = ''
--    or job_title not in (select title from public.valid_job_titles);

-- 散らばり具合
-- select department, count(*) from public.users group by department order by count(*) desc;
-- select job_title,  count(*) from public.users group by job_title  order by count(*) desc;
