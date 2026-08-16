"use client";

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

/** 一覧の1行。アイコン / 名前 / 最新メッセージ / 時刻 */
function MatchListItem({
  summary,
  selected,
  onSelect,
}: {
  summary: MatchSummary;
  selected: boolean;
  onSelect: (summary: MatchSummary) => void;
}) {
  const { partner, latestMessage } = summary;

  return (
    <button
      type="button"
      onClick={() => onSelect(summary)}
      aria-pressed={selected}
      className={[
        "flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-background",
      ].join(" ")}
    >
      {/* ダミー画像なので next/image ではなく img を使う */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={partner.avatarUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full bg-accent-soft"
      />

      {/* min-w-0 が無いと、この子要素が中身の幅まで広がって truncate が効かない */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{partner.name}</span>
        <span className="block truncate text-sm text-muted">
          {latestMessage ? latestMessage.body : "まだメッセージがありません"}
        </span>
      </span>

      <span className="shrink-0 text-xs text-muted">
        {latestMessage ? formatListTime(latestMessage.createdAt) : ""}
      </span>
    </button>
  );
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
