"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * 左サイドバー。画面の左端を全高で占める。
 *
 * 配色はモードで大きく変わるので、色は globals.css の --sidebar-* を参照する。
 * 仕事モードは濃紺の面に白文字、恋愛モードはほぼ白の面に濃紺文字。
 */
export function Sidebar() {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  return (
    <aside
      className={[
        "sticky top-0 flex h-screen shrink-0 flex-col border-r transition-[width] duration-200",
        "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-fg)]",
        open ? "w-40" : "w-16",
      ].join(" ")}
    >
      <nav className="flex flex-col gap-1 p-3">
        {/* ナビの一番上。押すと畳んでアイコンだけになる */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "サイドバーを畳む" : "サイドバーを開く"}
          aria-expanded={open}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
        >
          <MenuIcon />
        </button>

        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                active
                  ? "border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)]"
                  : "border-transparent text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover-bg)]",
              ].join(" ")}
            >
              <Icon />
              {open ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* アプリ名は最下部。畳んでいるときはマークだけ残す */}
      <Link
        href="/discover"
        className="mt-auto mb-5 flex items-center gap-2 rounded-xl p-3 transition-colors hover:bg-[var(--sidebar-hover-bg)]"
        title="MeetLink 社内コネクト"
      >
        <LogoMark />
        {open ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold tracking-tight">
              MeetLink
            </span>
            <span className="block truncate text-[11px] text-[var(--sidebar-muted)]">
              社内コネクト
            </span>
          </span>
        ) : null}
      </Link>
    </aside>
  );
}

/**
 * 二重リングのロゴマーク。
 * 仕事モードは2つとも金色、恋愛モードは青とピンクになる（globals.css で切り替え）。
 */
function LogoMark() {
  return (
    <svg
      viewBox="0 0 40 24"
      aria-hidden
      className="h-5 w-8 shrink-0"
      fill="none"
      strokeWidth={2.5}
    >
      <circle cx="14" cy="12" r="9" stroke="var(--logo-ring-a)" />
      <circle cx="26" cy="12" r="9" stroke="var(--logo-ring-b)" />
    </svg>
  );
}

/** ナビのアイコン。線画で揃えるため stroke は currentColor にしている */
function iconProps() {
  return {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    className: "h-5 w-5 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function MenuIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function TalkIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20.5l1.6-3.6A6.7 6.7 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7Z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

const NAV = [
  { href: "/discover", label: "探す", icon: SearchIcon },
  { href: "/talk", label: "トーク", icon: TalkIcon },
  { href: "/me", label: "マイページ", icon: PersonIcon },
];
