"use client";

import Link from "next/link";
import { ModeSwitch } from "@/components/ModeSwitch";
import { useSession } from "@/lib/session";

export function Header() {
  const { currentUser, signOut } = useSession();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-3">
        <Link href="/discover" className="text-base font-extrabold tracking-tight">
          社内マッチング
        </Link>

        <div className="mx-auto">
          <ModeSwitch />
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              {/* ダミー画像なので next/image ではなく img を使う */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentUser.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full bg-accent-soft"
              />
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-sm text-muted hover:text-foreground"
              >
                ログアウト
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
