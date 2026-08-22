"use client";

import { ModeSwitch } from "@/components/ModeSwitch";
import { useSession } from "@/lib/session";

/**
 * サイドバーの右側に乗るヘッダー。
 *
 * 中央にモード切替、右端にログアウト。
 * 3列にしているのは、右側に要素があってもモード切替を画面の中央に保つため
 * （mx-auto だと右の要素のぶんだけ左にずれる）。
 */
export function Header() {
  const { currentUser, signOut, mode } = useSession();

  return (
    <header
      className={[
        "sticky top-0 z-20 border-b border-[var(--header-border)] bg-[var(--header-bg)]",
        mode === "work" ? "app-header" : "",
      ].join(" ")}
    >
      <div
        className={
          mode === "romance"
            ? "grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3"
            : "grid min-h-18 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:gap-4 sm:px-7 lg:px-10"
        }
      >
        <div />

        <ModeSwitch />

        <div className="flex items-center justify-end">
          {currentUser ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className={
                mode === "romance"
                  ? "text-sm text-muted transition-colors hover:text-foreground"
                  : "rounded-lg px-3 py-2 text-xs font-medium tracking-wide text-muted transition-colors hover:bg-[var(--accent-soft)] hover:text-foreground"
              }
            >
              ログアウト
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
