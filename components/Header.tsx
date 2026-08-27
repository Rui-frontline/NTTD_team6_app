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
      {/*
        狭い画面では左右の余白と間隔を詰める。

        モード切替だけで約260px要る。375px の画面はサイドバーを引くと
        319px しか無く、px-6（48px）と gap-4（32px）を足すと収まらない。
      */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6">
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
