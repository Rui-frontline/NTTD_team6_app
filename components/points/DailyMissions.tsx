"use client";

import { DAILY_MISSIONS, missionProgress } from "@/lib/points";
import type { DailyProgress } from "@/lib/points";

/**
 * 今日のデイリーミッション。
 *
 * 達成すると受け取り箱へ届く（残高はそこで受け取ってから増える）ので、
 * ここには「受け取る」ボタンを置かない。進捗を見せるだけ。
 *
 * 進捗も達成の判定も DB 側（sync_daily_missions）が出した値を使う。
 * 日付の境界を端末の時計で決めると、日付をまたぐ前後でずれるため。
 */
export function DailyMissions({ progress }: { progress: DailyProgress | null }) {
  return (
    <div className="p-5">
      <h3 className="text-base font-bold">今日のデイリーミッション</h3>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        毎日0:00にリセットされます
      </p>

      <ul className="mt-4 space-y-2">
        {DAILY_MISSIONS.map((mission) => {
          const done = progress?.achieved.includes(mission.id) ?? false;
          // 達成後も分子が増え続けるので、目標で頭打ちにする
          const current = Math.min(missionProgress(mission, progress), mission.goal);

          return (
            <li
              key={mission.id}
              className={[
                "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3",
                done
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)]",
              ].join(" ")}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{mission.label}</p>
                {mission.note ? (
                  <p className="text-xs text-[var(--muted)]">{mission.note}</p>
                ) : null}
              </div>

              {done ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">
                  <CheckIcon />
                  達成済み
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-2">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${(current / mission.goal) * 100}%` }}
                    />
                  </span>
                  <span className="text-xs tabular-nums text-[var(--muted)]">
                    {current} / {mission.goal}
                  </span>
                </span>
              )}

              <span className="w-12 shrink-0 text-right text-sm font-bold text-[var(--accent)]">
                +{mission.points}P
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-[var(--muted)]">
        達成したポイントは受け取り箱に届きます。上の「ポイントを受け取る」から受け取ってください。
      </p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
