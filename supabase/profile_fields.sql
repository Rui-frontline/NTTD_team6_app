-- プロフィールで設定できる項目を増やす。
--
-- 共通で持つもの（users）と、モードごとに持つもの（profiles）の2種類がある。
-- profiles は work / romance で行を共有しているので、仕事用の列は
-- romance の行では空のまま、恋愛用の列は work の行では空のままになる。
-- どの列をどちらで使うかは lib/profile-fields.ts が決めている。
--
-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 何度実行しても壊れません（add column if not exists）。
--
-- テキストは既存の bio に合わせて default '' にしている。
-- 数値は既定値を置かず nullable にする。0 を「未設定」と区別できないため。

-- ───────────────────────── 共通（users） ─────────────────────────

alter table public.users
  add column if not exists gender     text default '',  -- 性別
  add column if not exists university text default '';  -- 出身大学

-- 部署は「会社 / 区分 / 本部 / 部」を選んで決める。
-- department にはいちばん下の名前だけを入れる（表示と絞り込みで使うのがそこだけで、
-- 既存のデータやカードの見た目を変えずに済むため）。
-- 選び直すときに途中の階層まで復元できるよう、経路そのものは別に持つ。
alter table public.users
  add column if not exists department_path text default '';

-- ───────────────────────── 仕事モードのみ（profiles） ─────────────────────────

alter table public.profiles
  add column if not exists work_achievements text default '',  -- 詳しい仕事の実績
  add column if not exists can_talk_about    text default '',  -- お話しできること
  add column if not exists want_to_consult   text default '',  -- 相談したい内容
  add column if not exists certifications    text default '',  -- 資格情報
  add column if not exists interested_areas  text default '';  -- 今後興味のある領域

-- ───────────────────────── 恋愛モードのみ（profiles） ─────────────────────────
--
-- 「タバコ・お酒」と「希望最高・最低年齢」は、それぞれ別々に答える内容なので
-- 2列に分けている。

alter table public.profiles
  add column if not exists height_cm          int,              -- 身長
  add column if not exists body_type          text default '',  -- 体型
  add column if not exists personality_type   text default '',  -- 性格タイプ
  add column if not exists living_with        text default '',  -- 同居人
  add column if not exists holiday            text default '',  -- 休日
  add column if not exists smoking            text default '',  -- タバコ
  add column if not exists drinking           text default '',  -- お酒
  add column if not exists hometown           text default '',  -- 出身
  add column if not exists residence          text default '',  -- 住んでる場所
  add column if not exists preferred_age_min  int,              -- 希望最低年齢
  add column if not exists preferred_age_max  int,              -- 希望最高年齢
  add column if not exists wants_children     text default '',  -- 子供がほしいか
  add column if not exists marriage_intent    text default '',  -- 結婚への意思
  add column if not exists meeting_preference text default '';  -- 出会うまでの希望

-- ───────────────────────── 確認 ─────────────────────────

-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles'
-- order by ordinal_position;
