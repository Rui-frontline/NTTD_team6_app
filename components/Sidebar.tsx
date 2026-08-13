"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/discover", label: "探す", icon: "🔍" },
  { href: "/talk", label: "トーク", icon: "💬" },
  { href: "/me", label: "マイページ", icon: "👤" },
];

/** 左サイドバー。初期状態は開いた状態で、畳むとアイコンだけが残る */
export function Sidebar() {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  return (
    <aside
      className={[
        "shrink-0 border-r border-line bg-surface transition-[width] duration-200",
        open ? "w-48" : "w-16",
      ].join(" ")}
    >
      <div className="sticky top-0 flex flex-col gap-1 p-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "サイドバーを畳む" : "サイドバーを開く"}
          className="mb-1 rounded-lg px-3 py-2 text-left text-muted transition-colors hover:bg-accent-soft hover:text-accent"
        >
          ☰
        </button>

        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              <span aria-hidden>{item.icon}</span>
              {open ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
