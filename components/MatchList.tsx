"use client";

import { isImageBody } from "@/lib/image";
import { useSession } from "@/lib/session";
import type { MatchSummary } from "@/lib/types";

/**
 * トーク画面の左側に出すマッチ一覧。
 *
 * データの取得や選択の管理は親（TalkScreen）が持ち、
 * ここは「渡されたものを並べて、押されたら親に伝える」だけにしている。
 */
export function MatchList({
  matches,
  selectedMatchId,
  onSelect,
}: {
  matches: MatchSummary[];
  /** 選択中のマッチ id。未選択なら null */
  selectedMatchId: string | null;
  onSelect: (summary: MatchSummary) => void;
}) {
  return (
    <ul>
      {matches.map((summary) => (
        <li key={summary.match.id}>
          <MatchListItem
            summary={summary}
            selected={summary.match.id === selectedMatchId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

/** 一覧の1行。アイコン / 名前 / 最新メッセージ / 時刻 / 未読バッジ */
function MatchListItem({
  summary,
  selected,
  onSelect,
}: {
  summary: MatchSummary;
  selected: boolean;
  onSelect: (summary: MatchSummary) => void;
}) {
  const { partner, latestMessage, unreadCount } = summary;
  const { mode } = useSession();

  return (
    <button
      type="button"
      onClick={() => onSelect(summary)}
      aria-pressed={selected}
      className={[
        mode === "romance"
          ? "flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors"
          : "flex w-full items-center gap-3 border-b border-l-[3px] border-b-line px-4 py-3.5 text-left transition-colors",
        mode === "romance"
          ? selected
            ? "bg-accent-soft"
            : "hover:bg-background"
          : selected
            ? "border-l-accent bg-[#EEF2F7]"
            : "border-l-transparent hover:bg-[#F8F5EF]",
      ].join(" ")}
    >
      {/* ダミー画像なので next/image ではなく img を使う */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={partner.avatarUrl}
        alt=""
        width={40}
        height={40}
        className={
          mode === "romance"
            ? "h-10 w-10 shrink-0 rounded-full bg-accent-soft"
            : "h-11 w-11 shrink-0 rounded-full border border-[var(--gold-soft)] bg-accent-soft object-cover p-0.5"
        }
      />

      {/* min-w-0 が無いと、この子要素が中身の幅まで広がって truncate が効かない */}
      <span className="min-w-0 flex-1">
        <span
          className={
            mode === "romance"
              ? "block truncate text-sm font-bold"
              : "block truncate text-sm font-semibold text-[var(--accent)]"
          }
        >
          {partner.name}
        </span>
        <span
          className={
            mode === "romance"
              ? "block truncate text-sm text-muted"
              : "mt-0.5 block truncate text-xs leading-relaxed text-muted"
          }
        >
          {latestMessage
            ? previewText(latestMessage.body)
            : "まだメッセージがありません"}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
        <span>{latestMessage ? formatListTime(latestMessage.createdAt) : ""}</span>
        {unreadCount > 0 ? (
          <span
            aria-label={`未読 ${unreadCount} 件`}
            // アクセント色と別色にしている。同じ色だと選択中の行に埋もれて気づけない
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--badge-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--badge-fg)]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * 一覧に出す1行。
 * 写真は本文が data URL なので、そのまま出すと延々と文字列が並ぶ。
 */
function previewText(body: string): string {
  return isImageBody(body) ? "写真" : body;
}

/**
 * 一覧に出す時刻。今日は 10:23、昨日は「昨日」、それ以前は 8/9。
 * 時刻の差ではなく「日付が何日ずれているか」で判定する。
 */
function formatListTime(iso: string): string {
  const date = new Date(iso);
  const days = dayDiff(new Date(), date);

  if (days === 0) {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  if (days === 1) return "昨日";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** 2つの日付が何日ずれているか。時刻部分は切り捨てて比べる */
function dayDiff(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((fromDay.getTime() - toDay.getTime()) / oneDay);
}
