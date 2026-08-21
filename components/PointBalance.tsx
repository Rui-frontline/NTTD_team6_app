"use client";

import { useSession } from "@/lib/session";

/**
 * 保有ポイントの表示。サイドバーとマイページの2箇所で使う。
 *
 * 値は useSession() の currentUser から取るので、新しい取得処理は要らない。
 * ただし currentUser はログイン時に読み込まれるため、DB を直接書き換えた
 * ぶんは再読み込みするまで反映されない。ポイントを増やす処理を作るときは、
 * awardPoints のあとに refreshUser() を呼ぶこと。
 *
 * 置く場所ごとに余白や文字色が違うので、見た目は className で外から渡す。
 */
export function PointBalance({
  className,
  compact = false,
}: {
  className?: string;
  /** true ならハートだけ。サイドバーを畳んだときに使う */
  compact?: boolean;
}) {
  const { currentUser } = useSession();

  if (!currentUser) return null;

  const formatted = formatPoints(currentUser.points);

  return (
    <span
      className={["flex items-center gap-1.5", className].join(" ")}
      title={`保有ポイント ${formatted} pt`}
    >
      <HeartIcon />
      {compact ? null : (
        <span className="truncate text-sm font-bold">
          {formatted}
          <span className="ml-0.5 text-[11px] font-normal">pt</span>
        </span>
      )}
    </span>
  );
}

/** 1234 → 1,234。表示する場所が増えても桁区切りの書き方を揃えるため */
export function formatPoints(points: number): string {
  return points.toLocaleString("ja-JP");
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />
    </svg>
  );
}
