"use client";

import { MODES, MODE_LABEL } from "@/lib/types";
import { useSession } from "@/lib/session";

/**
 * 仕事モード / 恋愛モードの切り替えタブ。ヘッダー中央に常時表示する。
 *
 * 押すと一覧に出る人と画面の配色が丸ごと変わる。
 * デモで一番見せたい部分なので、変化が分かりやすいことを優先している。
 *
 * 選択中のタブは形もモードで変わる（仕事は角丸の四角、恋愛は丸型）。
 * 角丸は globals.css の --tab-radius で切り替えている。
 */
export function ModeSwitch() {
  const { mode, setMode } = useSession();

  return (
    <div
      role="tablist"
      aria-label="モードの切り替え"
      className="flex items-center gap-1 rounded-full border border-[var(--tab-shell-border)] bg-[var(--tab-shell-bg)] p-1 [box-shadow:var(--soft-shadow)]"
    >
      {MODES.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(m)}
            className={[
              // 狭い画面では左右の余白を詰める。ヘッダーに収めるため
              "flex items-center gap-2 rounded-[var(--tab-radius)] px-3 py-1.5 text-sm font-bold transition-all sm:px-5",
              active
                ? "[background:var(--tab-active-bg)] text-[var(--tab-active-fg)] [box-shadow:var(--soft-shadow)]"
                : "text-[var(--tab-idle-fg)]",
            ].join(" ")}
          >
            {m === "romance" ? <HeartIcon /> : <WorkIcon />}
            {MODE_LABEL[m]}モード
          </button>
        );
      })}
    </div>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
    >
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />
    </svg>
  );
}

function WorkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
