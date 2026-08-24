"use client";

import { useState } from "react";
import { formatPoints } from "@/components/PointBalance";
import { POINT_HISTORY_LIMIT, pointEventLabel } from "@/lib/points";
import type { PointEvent } from "@/lib/repository";

/** 折りたたんでいるときに出す件数。デザイン案は横並びで3件 */
const PREVIEW_COUNT = 3;

/**
 * ポイントの履歴。
 *
 * 既定は直近3件だけを横に並べ、「すべて見る」で縦の一覧に切り替える。
 * 表示名は reason から作る（lib/points.ts の pointEventLabel）。
 */
export function PointHistory({ events }: { events: PointEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? events : events.slice(0, PREVIEW_COUNT);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--soft-shadow)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">最近のポイント履歴</h2>
        {events.length > PREVIEW_COUNT ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]"
          >
            {/*
              「すべて見る」とは書かない。読んでいるのは最新
              POINT_HISTORY_LIMIT 件までで、それより古いぶんは出ないため。
            */}
            {expanded ? "閉じる" : `最新${POINT_HISTORY_LIMIT}件を見る`} ›
          </button>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--muted)]">
          まだ履歴がありません。
        </p>
      ) : (
        <ul
          className={
            expanded
              ? "max-h-80 divide-y divide-[var(--line)] overflow-y-auto"
              : // 折りたたみ時だけ横並び。狭い画面では縦に落とす
                "grid gap-3 sm:grid-cols-3"
          }
        >
          {shown.map((event) => (
            <li
              key={event.id}
              className={[
                "flex items-center gap-3",
                expanded ? "py-2.5" : "min-w-0",
              ].join(" ")}
            >
              <span className="text-base" aria-hidden>
                {event.amount >= 0 ? "🅿️" : "🛍️"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{pointEventLabel(event.reason)}</p>
                <p className="text-xs text-[var(--muted)]">
                  {formatDate(event.createdAt)}
                </p>
              </div>
              <span
                className={[
                  "shrink-0 text-sm font-bold",
                  // 減ったぶんは色を変える。並べたときに増減が一目で分かる
                  event.amount >= 0
                    ? "text-[var(--accent)]"
                    : "text-[var(--badge-bg)]",
                ].join(" ")}
              >
                {event.amount >= 0 ? "+" : "−"}
                {formatPoints(Math.abs(event.amount))} pt
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
