"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PointBalance, formatPoints } from "@/components/PointBalance";
import { useSession } from "@/lib/session";

/**
 * 左サイドバー。画面の左端を全高で占める。
 *
 * 配色はモードで大きく変わるので、色は globals.css の --sidebar-* を参照する。
 * 仕事モードは濃紺の面に白文字、恋愛モードはほぼ白の面に濃紺文字。
 */
export function Sidebar() {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const { mode } = useSession();

  if (mode === "romance") {
    return (
      <aside
        className={[
          "sticky top-0 flex h-screen shrink-0 flex-col border-r transition-[width] duration-200",
          "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-fg)]",
          open ? "w-40" : "w-16",
        ].join(" ")}
      >
        <nav className="flex flex-col gap-1 p-3">
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

        <div className="mt-auto mb-5 flex flex-col gap-2 px-3">
          <AccountCard open={open} />

          <Link
            href="/discover"
            className="flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            title="MeetLink 社内コネクト"
          >
            <LogoMark legacy />
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
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={[
        "sidebar-shell sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r transition-[width] duration-200",
        "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-fg)]",
        open ? "w-20 sm:w-56" : "w-16",
      ].join(" ")}
    >
      <div className="flex min-h-22 items-center gap-2 border-b border-[var(--sidebar-active-border)] px-4">
        <Link
          href="/discover"
          className="flex min-w-0 flex-1 items-center gap-3"
          title="MeetLink 社内コネクト"
        >
          <LogoMark />
          {open ? (
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate font-serif text-lg font-semibold tracking-[0.03em] text-[var(--sidebar-fg)]">
                MeetLink
              </span>
              <span className="block truncate text-[9px] tracking-[0.18em] text-[var(--sidebar-muted)]">
                MEET. CONNECT. GROW.
              </span>
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "サイドバーを畳む" : "サイドバーを開く"}
          aria-expanded={open}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)] sm:flex"
        >
          <MenuIcon />
        </button>
      </div>

      <nav className="flex flex-col gap-1.5 p-3 sm:p-4">
        {open ? (
          <span className="mb-1 hidden px-3 text-[9px] font-semibold tracking-[0.22em] text-[var(--sidebar-muted)] sm:block">
            MENU
          </span>
        ) : null}

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
                "relative flex min-h-11 items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors",
                active
                  ? "border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)]"
                  : "border-transparent text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)]",
              ].join(" ")}
            >
              <Icon />
              {open ? <span className="hidden truncate sm:block">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* 画面の下部に現在のアカウントと保有ポイントをまとめる。 */}
      <div className="mt-auto mb-5 flex flex-col gap-2 px-3 sm:px-4">
        <AccountCard open={open} />
      </div>
    </aside>
  );
}

/**
 * いまログインしているアカウント。
 * デモでアカウントを切り替えながら見せるので、誰で入っているかが
 * 常に分かるようにしている。
 */
function AccountCard({ open }: { open: boolean }) {
  const { currentUser, mode } = useSession();

  if (!currentUser) return null;

  // 畳んでいるとポイントが見えなくなるので、ここに入れておく
  const label = `${currentUser.name}（${currentUser.department}） ${formatPoints(
    currentUser.points,
  )} pt`;

  // 畳んでいるときは枠を出さず、アイコンだけ中央に置く。
  // 幅 4rem に枠と余白まで入れると、アイコンがはみ出すため。
  if (!open) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentUser.avatarUrl}
        alt=""
        title={label}
        width={32}
        height={32}
        className={
          mode === "romance"
            ? "mx-auto h-8 w-8 rounded-full bg-[var(--sidebar-hover-bg)] object-cover"
            : "mx-auto h-9 w-9 rounded-full border border-[var(--sidebar-active-border)] bg-[var(--sidebar-hover-bg)] object-cover p-0.5"
        }
      />
    );
  }

  return (
    <div
      title={label}
      className={
        mode === "romance"
          ? "rounded-xl border border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] p-2"
          : "rounded-[14px] border border-[var(--sidebar-active-border)] bg-[rgba(255,255,255,0.04)] p-2.5"
      }
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentUser.avatarUrl}
          alt=""
          width={32}
          height={32}
          className={
            mode === "romance"
              ? "h-8 w-8 shrink-0 rounded-full bg-[var(--sidebar-hover-bg)] object-cover"
              : "h-9 w-9 shrink-0 rounded-full border border-[var(--logo-ring-a)] bg-[var(--sidebar-hover-bg)] object-cover p-0.5"
          }
        />
        <span className={mode === "romance" ? "min-w-0" : "hidden min-w-0 sm:block"}>
          <span className="block truncate text-xs font-bold text-[var(--sidebar-active-fg)]">
            {currentUser.name}
          </span>
          <span className="block truncate text-[10px] text-[var(--sidebar-muted)]">
            {currentUser.department}
          </span>
        </span>
      </div>

      {/* 罫線で区切ると、名前や部署と別の情報だと分かりやすい */}
      <PointBalance
        className={
          mode === "romance"
            ? "mt-2 border-t border-[var(--sidebar-active-border)] pt-2 text-[var(--sidebar-active-fg)]"
            : "mt-2 hidden border-t border-[var(--sidebar-active-border)] pt-2 text-[var(--sidebar-active-fg)] sm:flex"
        }
      />
    </div>
  );
}

/**
 * 二重リングのロゴマーク。
 * 仕事モードは2つとも金色、恋愛モードは青とピンクになる（globals.css で切り替え）。
 */
function LogoMark({ legacy = false }: { legacy?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 24"
      aria-hidden
      className={legacy ? "h-5 w-8 shrink-0" : "h-6 w-9 shrink-0"}
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

function HistoryIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 7h8M8 12h8M8 17h5" />
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
  { href: "/board", label: "募集", icon: BoardIcon },
  { href: "/history", label: "履歴", icon: HistoryIcon },
  { href: "/me", label: "マイページ", icon: PersonIcon },
];
