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
  const { currentUser, signOut } = useSession();

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
