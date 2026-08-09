"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeSwitch } from "@/components/ModeSwitch";
import { useSession } from "@/lib/session";

const NAV = [
  { href: "/discover", label: "探す" },
  { href: "/matches", label: "マッチ" },
  { href: "/groups", label: "グループ" },
  { href: "/board", label: "掲示板" },
  { href: "/me", label: "マイページ" },
];

export function Header() {
  const { currentUser, logout } = useSession();
  const pathname = usePathname();

  // ログイン画面ではヘッダーを出さない
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/discover" className="text-base font-extrabold tracking-tight">
          社内マッチング
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <ModeSwitch />
          {currentUser ? (
            <button
              type="button"
              onClick={logout}
              className="text-sm text-muted hover:text-foreground"
            >
              ログアウト
            </button>
          ) : (
            <Link href="/login" className="text-sm text-muted hover:text-foreground">
              ログイン
            </Link>
          )}
        </div>
      </div>

      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
