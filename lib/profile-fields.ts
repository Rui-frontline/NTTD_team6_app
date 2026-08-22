// マイページの入力欄の定義。
//
// 項目が19個あるので、フォームを手書きすると MyPage.tsx が読めなくなる。
// ここに「何を・どんな入力で・どのモードで出すか」をまとめ、画面は
// この配列を回して描くだけにしている。項目を増やすときもここに1行足す。
//
// 選択肢もここに置く。lib/types.ts は「変更前に Slack で相談」と明記された
// 共有ファイルなので、型の変更以外を持ち込まず差分を小さく保つため。

import type { Mode, Profile, User } from "@/lib/types";

/** 選択式で「まだ答えていない」を表す値。DB には空文字で入る */
export const UNSET = "";

/** 選択肢の先頭に出すラベル */
export const UNSET_LABEL = "未設定";

// ───────────────────────── 選択肢 ─────────────────────────

export const JOB_TITLE_OPTIONS = [
  "システムエンジニア",
  "プロジェクトマネージャー",
  "企画・営業",
  "コンサルタント",
  "R＆D",
  "人事",
  "経理・財務",
  "法務",
  "経営企画",
  "その他",
] as const;

export const GENDER_OPTIONS = [
  "男性",
  "女性",
  "その他",
  "回答しない",
] as const;

const BODY_TYPE_OPTIONS = [
  "スリム",
  "やや細め",
  "普通",
  "がっちり",
  "ぽっちゃり",
] as const;

const PERSONALITY_OPTIONS = [
  "穏やか",
  "明るい",
  "社交的",
  "落ち着いている",
  "真面目",
  "好奇心旺盛",
  "マイペース",
] as const;

const LIVING_WITH_OPTIONS = [
  "一人暮らし",
  "実家",
  "ルームシェア",
  "その他",
] as const;

const HOLIDAY_OPTIONS = ["土日", "平日", "シフト制", "不定期"] as const;

const SMOKING_OPTIONS = [
  "吸わない",
  "ときどき吸う",
  "吸う",
  "電子タバコのみ",
] as const;

const DRINKING_OPTIONS = ["飲まない", "ときどき飲む", "よく飲む"] as const;

const WANTS_CHILDREN_OPTIONS = [
  "ほしい",
  "ほしくない",
  "どちらでもよい",
  "相手と相談して決めたい",
] as const;

const MARRIAGE_INTENT_OPTIONS = [
  "すぐにでもしたい",
  "数年以内にしたい",
  "いずれはしたい",
  "今は考えていない",
] as const;

const MEETING_PREFERENCE_OPTIONS = [
  "まずはメッセージを重ねたい",
  "何度か話してから会いたい",
  "早めに会ってみたい",
  "相手に合わせる",
] as const;

// ───────────────────────── 項目の定義 ─────────────────────────

/** 文字列を入れるキー */
type ProfileTextKey = {
  [K in keyof Profile]: Profile[K] extends string ? K : never;
}[keyof Profile];

/** 数値を入れるキー（未設定は null） */
type ProfileNumberKey = {
  [K in keyof Profile]: Profile[K] extends number | null ? K : never;
}[keyof Profile];

/**
 * 入力欄1つぶんの定義。
 *
 * kind で分けているのは、値の型ごとにキーの型も決まるようにするため。
 * kind === "number" の枝では draft[mode][field.key] が number | null に
 * 絞られるので、画面側でキャストせずに書ける。
 */
export type ProfileField =
  | { kind: "text"; key: ProfileTextKey; label: string; multiline?: boolean }
  | {
      kind: "select";
      key: ProfileTextKey;
      label: string;
      options: readonly string[];
    }
  | {
      kind: "number";
      key: ProfileNumberKey;
      label: string;
      min: number;
      max: number;
      unit: string;
    };

/** モードごとに出す項目。ここに並べた順で画面に出る */
export const PROFILE_FIELDS: Record<Mode, ProfileField[]> = {
  work: [
    { kind: "text", key: "workAchievements", label: "詳しい仕事の実績", multiline: true },
    { kind: "text", key: "canTalkAbout", label: "お話しできること", multiline: true },
    { kind: "text", key: "wantToConsult", label: "相談したい内容", multiline: true },
    { kind: "text", key: "certifications", label: "資格情報" },
    { kind: "text", key: "interestedAreas", label: "今後興味のある領域" },
  ],
  romance: [
    { kind: "number", key: "heightCm", label: "身長", min: 130, max: 220, unit: "cm" },
    { kind: "select", key: "bodyType", label: "体型", options: BODY_TYPE_OPTIONS },
    { kind: "select", key: "personalityType", label: "性格タイプ", options: PERSONALITY_OPTIONS },
    { kind: "select", key: "livingWith", label: "同居人", options: LIVING_WITH_OPTIONS },
    { kind: "select", key: "holiday", label: "休日", options: HOLIDAY_OPTIONS },
    { kind: "select", key: "smoking", label: "タバコ", options: SMOKING_OPTIONS },
    { kind: "select", key: "drinking", label: "お酒", options: DRINKING_OPTIONS },
    { kind: "text", key: "hometown", label: "出身" },
    { kind: "text", key: "residence", label: "住んでる場所" },
    { kind: "number", key: "preferredAgeMin", label: "希望する相手の最低年齢", min: 18, max: 99, unit: "歳" },
    { kind: "number", key: "preferredAgeMax", label: "希望する相手の最高年齢", min: 18, max: 99, unit: "歳" },
    { kind: "select", key: "wantsChildren", label: "子供がほしいか", options: WANTS_CHILDREN_OPTIONS },
    { kind: "select", key: "marriageIntent", label: "結婚への意思", options: MARRIAGE_INTENT_OPTIONS },
    { kind: "select", key: "meetingPreference", label: "出会うまでの希望", options: MEETING_PREFERENCE_OPTIONS },
  ],
};

// ───────────────────────── 共通項目（users） ─────────────────────────

type UserTextKey = "gender" | "university";

export type UserField =
  | { kind: "text"; key: UserTextKey; label: string }
  | { kind: "select"; key: UserTextKey; label: string; options: readonly string[] };

/** モードによらず共通で持つ項目。名前や年齢と同じ場所に出す */
export const USER_FIELDS: UserField[] = [
  { kind: "select", key: "gender", label: "性別", options: GENDER_OPTIONS },
  { kind: "text", key: "university", label: "出身大学" },
];

/** 型が User のキーからずれていないことを、コンパイル時に確かめる */
const _userKeyCheck: Record<UserTextKey, keyof User> = {
  gender: "gender",
  university: "university",
};
void _userKeyCheck;

/** 数値の選択肢を作る。min から max までの連番 */
export function numberOptions(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}
