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

  if (mode === "romance") {
    return (
      <header className="sticky top-0 z-20 border-b border-[var(--header-border)] bg-[var(--header-bg)]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3">
          <div />

          <ModeSwitch />

          <div className="flex items-center justify-end">
            {currentUser ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                ログアウト
              </button>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="work-header sticky top-0 z-20 border-b border-[var(--header-border)] bg-[var(--header-bg)]">
      <div className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4 sm:px-4 lg:px-12">
        <div className="hidden sm:block" />

        <div className="min-w-0 justify-self-start sm:justify-self-center">
          <ModeSwitch />
        </div>

        <div className="flex items-center justify-end">
          {currentUser ? (
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="ログアウト"
              title="ログアウト"
              className="flex h-9 w-9 items-center justify-center gap-2 rounded-xl border border-transparent text-xs font-medium tracking-wide text-muted transition-colors hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-foreground lg:h-auto lg:w-auto lg:px-3 lg:py-2"
            >
              <LogoutIcon />
              <span className="hidden lg:inline">ログアウト</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
      <path d="m14 8 4 4-4 4M18 12H9" />
    </svg>
  );
}
