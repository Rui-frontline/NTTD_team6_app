"use client";

import { MODES, MODE_LABEL } from "@/lib/types";
import { useSession } from "@/lib/session";

/**
 * 仕事モード / 恋愛モードの切り替えスイッチ。
 *
 * 押すと一覧に出る人と画面の配色が丸ごと変わる。
 * デモで一番見せたい部分なので、変化が分かりやすいことを優先している。
 */
export function ModeSwitch() {
  const { mode, setMode } = useSession();

  return (
    <div
      role="group"
      aria-label="モードの切り替え"
      className="flex overflow-hidden rounded-full border border-line bg-surface"
    >
      {MODES.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={active}
            className={[
              "px-4 py-1.5 text-sm font-bold transition-colors",
              active
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
