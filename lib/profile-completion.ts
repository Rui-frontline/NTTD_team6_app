// プロフィールの充実度。
//
// マイページのバーと、達成ポイント（50% / 80% / 100%）の判定に使う。
// 数え方をここ1箇所に置き、画面と保存処理の両方から同じ関数を呼ぶ。
//
// 分母は lib/profile-fields.ts の定義から作る。項目を1行足せば分母も
// 自動で増えるので、増やすたびにこのファイルを直す必要はない。

import type { Mode, Profile, User } from "@/lib/types";
import { PROFILE_FIELDS, USER_FIELDS } from "@/lib/profile-fields";

/** ポイントがもらえる段。数字がそのまま獲得ポイント（50% → 50pt） */
export const PROFILE_MILESTONES = [50, 80, 100] as const;

export type Completion = {
  /** 埋まっている項目の数 */
  filled: number;
  /** 数えている項目の総数 */
  total: number;
  /** 0〜100 に丸めた割合 */
  percent: number;
};

/** 文字列は空白だけなら未記入とみなす */
function hasText(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * プロフィールがどれだけ埋まっているか。
 *
 * 記入式か選択式かに関わらず1項目=1票で数える。数え方は3つだけ。
 * ・文字列   … 空白を除いて1文字以上あれば埋まっている
 * ・数値     … null でなければ埋まっている（0 と未設定を区別するため）
 * ・タグ     … 1個以上選んでいれば埋まっている
 *
 * 数えないもの:
 * ・写真         … 記入欄ではないため
 * ・スイッチ2つ   … 「会社・部署を表示する」「このモードに参加する」は
 *                   常に ON/OFF のどちらかで、未記入の状態が無い
 */
export function profileCompletion(user: User, mode: Mode): Completion {
  const profile: Profile = user[mode];
  let filled = 0;
  let total = 0;

  const count = (isFilled: boolean) => {
    total += 1;
    if (isFilled) filled += 1;
  };

  // ── 共通（users）──
  //
  // 名前・年齢・職種・会社/部署は新規登録から必須で、lib/profile-fields.ts に
  // 定義が無い（MyPage が直接書いている）ため、ここに並べる。
  // 分母から外すと「登録しただけで31%」という起点がずれてしまう。
  count(hasText(user.name));
  // 年齢は選択式で 18〜99 しか選べない。範囲外は未設定とみなす
  count(Number.isInteger(user.age) && user.age >= 18 && user.age <= 99);
  count(hasText(user.jobTitle));
  count(hasText(user.department));
  for (const field of USER_FIELDS) {
    count(hasText(user[field.key]));
  }

  // ── モード別（profiles）──
  count(hasText(profile.bio));
  count(profile.tags.length > 0);
  for (const field of PROFILE_FIELDS[mode]) {
    if (field.kind === "number") {
      count(profile[field.key] !== null);
    } else {
      count(hasText(profile[field.key]));
    }
  }

  return {
    filled,
    total,
    percent: total === 0 ? 0 : Math.round((filled / total) * 100),
  };
}

/**
 * その割合で届いている段。
 *
 * 受け取り済みかどうかは見ない。実際に受け取れるかの判定は DB 側
 * （supabase/profile_milestones.sql の claim_profile_milestones）が持つ。
 */
export function reachedMilestones(percent: number): number[] {
  return PROFILE_MILESTONES.filter((m) => percent >= m);
}
