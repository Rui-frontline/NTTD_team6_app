"use client";

import type { Completion } from "@/lib/profile-completion";
import { PROFILE_MILESTONES, reachedMilestones } from "@/lib/profile-completion";

/**
 * プロフィール充実度のバー。マイページの左の札に出す。
 *
 * 塗りが2層ある。
 * ・濃い塗り … 保存済みの割合。ポイントの判定もこちらと同じ値で行う
 * ・薄い塗り … 編集中の下書きの割合。保存前だけ、濃い塗りの先に伸びる
 *
 * 分けているのは「入力の手応え」と「ポイントはまだもらえていない」を
 * 同時に伝えるため。1本の塗りだけだと、保存前に100%に見えた時点で
 * ポイントをもらったと勘違いされる。
 *
 * 表示専用。計算は lib/profile-completion.ts、受け取りは MyPage が持つ。
 */
export function ProfileCompletion({
  saved,
  draft,
  claimed,
}: {
  /** 保存済みの値から出した充実度 */
  saved: Completion;
  /** 編集中の下書きから出した充実度 */
  draft: Completion;
  /** 受け取り済みの段。次に狙う段を決めるのに使う */
  claimed: number[];
}) {
  const hasUnsaved = draft.percent !== saved.percent;

  // 保存すると新しくもらえる段と、その合計ポイント。
  // 段の数字がそのまま獲得ポイント（50% → 50pt）。
  const pending = reachedMilestones(draft.percent).filter(
    (m) => !claimed.includes(m) && !reachedMilestones(saved.percent).includes(m),
  );
  const pendingPoints = pending.reduce((sum, m) => sum + m, 0);

  // 次に狙う段。すべて受け取り済みなら出さない
  const next = PROFILE_MILESTONES.find(
    (m) => !claimed.includes(m) && saved.percent < m,
  );

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">プロフィール</span>
        <span className="text-sm font-bold text-[var(--accent)]">
          {saved.percent}%
        </span>
      </div>

      <div className="relative mt-2">
        {/* 溝。薄い塗りは溝の中に重ねるので、はみ出しを切る */}
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
          {/* 下書きぶん（薄い）。保存済みより手前で切れることもある */}
          <div
            className="h-full rounded-full bg-[var(--accent)] opacity-30 transition-[width]"
            style={{ width: `${draft.percent}%` }}
          />
          {/* 保存済みぶん（濃い）。上の層に重ねる */}
          <div
            className="-mt-2 h-full rounded-full bg-[var(--accent)] transition-[width]"
            style={{ width: `${saved.percent}%` }}
          />
        </div>
      </div>

      {/*
        一文の出し分け。優先順は「保存すればもらえる」→「未保存あり」→「次の目標」。
        いちばん行動につながるものだけを1つ出し、札を長くしない。
      */}
      {pendingPoints > 0 ? (
        <p className="mt-2 rounded-md bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--accent-strong)]">
          保存すると{draft.percent}%になり、{pendingPoints}
          ポイントもらえます
        </p>
      ) : hasUnsaved ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          保存すると{draft.percent}%になります
        </p>
      ) : next ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          あと{next - saved.percent}%で{next}ポイントもらえます
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">
          このモードのポイントはすべて受け取り済みです
        </p>
      )}
    </div>
  );
}
