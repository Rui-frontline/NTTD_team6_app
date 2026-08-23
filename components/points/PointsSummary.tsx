"use client";

import { formatPoints } from "@/components/PointBalance";

/**
 * ポイント画面の上部の帯。
 *
 * デザイン案（pictures/ポイント_仕事モード.png）では濃紺の面に白抜き。
 * 面の色は --accent を使うので、恋愛モードでは自動でピンク寄りになる。
 */
export function PointsSummary({
  points,
  pendingCount,
  pendingPoints,
  onOpenInbox,
}: {
  points: number;
  /** 受け取り箱に届いている件数 */
  pendingCount: number;
  /** 受け取り箱に届いている合計ポイント */
  pendingPoints: number;
  onOpenInbox: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-[var(--accent)] px-6 py-6 text-white sm:px-8">
      <CoinMark />

      <div className="min-w-0">
        <p className="text-sm text-white/70">保有ポイント</p>
        <p className="mt-0.5 text-4xl font-extrabold leading-none">
          {formatPoints(points)}
          <span className="ml-1.5 text-base font-bold">pt</span>
        </p>
      </div>

      {/* 区切りは広い画面だけ。折り返すと縦線が宙に浮くため */}
      <div className="ml-auto hidden h-12 w-px bg-white/20 lg:block" />

      <div className="min-w-0">
        <p className="text-sm text-white/70">受け取り可能</p>
        <p className="mt-0.5 text-2xl font-bold leading-none">
          {formatPoints(pendingPoints)}
          <span className="ml-0.5 text-sm">P</span>
        </p>
      </div>

      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpenInbox}
          className="relative inline-flex items-center gap-2 rounded-xl bg-[var(--reward-bg)] px-6 py-3 text-sm font-bold text-[var(--reward-fg)] transition-opacity hover:opacity-90"
        >
          <GiftIcon />
          ポイントを受け取る
          {/* 件数のバッジ。0件のときは出さない */}
          {pendingCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--badge-bg)] px-1.5 text-[11px] font-bold text-[var(--badge-fg)]">
              {pendingCount}
            </span>
          ) : null}
        </button>
        <p className="mt-1.5 text-xs text-white/60">
          {pendingCount > 0
            ? `${pendingCount}件のポイントが届いています`
            : "届いているポイントはありません"}
        </p>
      </div>
    </div>
  );
}

/** 帯の左に置くコイン。文字の P を丸で囲んだだけの簡単なもの */
function CoinMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="h-16 w-16 shrink-0">
      <circle cx="32" cy="32" r="26" fill="var(--reward-bg)" opacity="0.25" />
      <circle
        cx="32"
        cy="32"
        r="20"
        fill="none"
        stroke="var(--reward-bg)"
        strokeWidth="3"
      />
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontSize="22"
        fontWeight="bold"
        fill="var(--reward-bg)"
      >
        P
      </text>
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="9" width="18" height="11" rx="1.5" />
      <path d="M3 13h18M12 9v11" />
      <path d="M12 9S9.5 4 7.5 4a2.5 2.5 0 0 0 0 5M12 9s2.5-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}
