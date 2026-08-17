import type { Mode } from "@/lib/types";
 
export const MAX_TAGS_PER_MODE = 5;
 
export const WORK_TAG_CANDIDATES = [
  "フロントエンド",
  "バックエンド",
  "インフラ",
  "データ分析",
  "AI・機械学習",
  "セキュリティ",
  "PM",
  "デザイン",
  "営業",
  "マーケティング",
  "経理・財務",
  "人事",
  "法務",
  "新規事業",
  "業務改善",
] as const;
 
export const ROMANCE_TAG_CANDIDATES = [
  "映画",
  "音楽",
  "読書",
  "カフェ巡り",
  "料理",
  "お酒",
  "サウナ",
  "筋トレ",
  "ランニング",
  "登山",
  "キャンプ",
  "旅行",
  "写真",
  "ゲーム",
  "アニメ・漫画",
  "スポーツ観戦",
  "猫",
  "犬",
  "ボードゲーム",
  "美術館",
] as const;
 
export const getTagCandidates = (mode: Mode): readonly string[] =>
  mode === "work" ? WORK_TAG_CANDIDATES : ROMANCE_TAG_CANDIDATES;
 

