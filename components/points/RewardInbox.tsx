"use client";

import { useEffect, useRef } from "react";
import { formatPoints } from "@/components/PointBalance";
import type { PointReward } from "@/lib/repository";

/**
 * 受け取り箱。ソシャゲの受信箱と同じ形で、届いたポイントを受け取る。
 *
 * 左上に「まとめて受け取る」、下に1件ずつ。
 * 文言（label）は DB が持っているので、ここでは reason を見て分岐しない。
 */
export function RewardInbox({
  rewards,
  claiming,
  onClaim,
  onClaimAll,
  onClose,
}: {
  rewards: PointReward[];
  /** 受け取り中は二重に押せないようにする */
  claiming: boolean;
  onClaim: (id: string) => void;
  onClaimAll: () => void;
  onClose: () => void;
}) {
  const total = rewards.reduce((sum, r) => sum + r.amount, 0);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc で閉じられるようにする。モーダルを開いたまま操作が詰まらないため
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 開いた直後にフォーカスを中へ移す。背後のボタンに残っていると
  // キーボードでモーダルの外を操作できてしまう
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="受け取り箱"
        // 中をクリックしても閉じないよう、背景への伝播を止める
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--surface)] text-[var(--foreground)] shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClaimAll}
              disabled={claiming || rewards.length === 0}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {claiming ? "受け取り中..." : "まとめて受け取る"}
            </button>
            {rewards.length > 0 ? (
              <span className="text-xs text-[var(--muted)]">
                {rewards.length}件・{formatPoints(total)}P
              </span>
            ) : null}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-lg px-2 py-1 text-lg leading-none text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)]"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rewards.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">
              届いているポイントはありません。
              <br />
              デイリーミッションやプロフィールの入力で貯まります。
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {rewards.map((reward) => (
                <li
                  key={reward.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="text-lg" aria-hidden>
                    {rewardEmoji(reward.reason)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {reward.label}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatDate(reward.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[var(--accent)]">
                    +{formatPoints(reward.amount)}P
                  </span>
                  <button
                    type="button"
                    onClick={() => onClaim(reward.id)}
                    disabled={claiming}
                    className="shrink-0 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    受け取る
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** 見出しの前に置く絵文字。何で貯まったかが一目で分かるように */
function rewardEmoji(reason: string): string {
  if (reason.startsWith("daily_")) return "🎯";
  if (reason.startsWith("profile_")) return "📝";
  return "🎁";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
