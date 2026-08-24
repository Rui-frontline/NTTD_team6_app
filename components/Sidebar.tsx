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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { mode } = useSession();

  if (mode === "romance") {
    const romanceWidth = open ? "w-40" : "w-16";
    return (
      <>
        {/*
          仕事モードと同じ「場所取り＋ fixed」の作り。
          見た目（幅・ロゴの位置・畳み方）は変えていない。

          もとは sticky と h-screen だったが、面の高さが画面ぶんしか無く、
          本文がそれより長い画面では下端に塗り残しができる。仕事モードで
          クリーム色の帯として見つかったのと同じ構造で、恋愛モードは
          面がほぼ白、地も淡いピンクなので見えにくかっただけ。
        */}
        <div
          aria-hidden
          className={[
            "shrink-0 transition-[width] duration-200",
            romanceWidth,
          ].join(" ")}
        />

        <aside
          className={[
            "fixed inset-y-0 left-0 flex flex-col border-r transition-[width] duration-200",
            "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-fg)]",
            romanceWidth,
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

        {/* 画面の下部。上から アカウント → 保有ポイント → アプリ名 */}
        <div className="mt-auto mb-5 flex flex-col gap-2 px-3">
          <AccountCard open={open} />

          <Link
            href="/discover"
            className="flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--sidebar-hover-bg)]"
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
        </div>
        </aside>
      </>
    );
  }

  // 幅の指定は「場所取り」と「実体」の両方で使うので、ここで作って共有する
  const widthClass = [
    mobileOpen ? "w-60" : "w-16",
    open ? "sm:w-60" : "sm:w-16",
  ].join(" ");

  return (
    <>
      {/*
        場所取り。実体は下の fixed な aside なので、本文が下に潜り込まないよう
        同じ幅の空き箱を flex の並びに置いておく。
      */}
      <div
        aria-hidden
        className={["shrink-0 transition-[width] duration-200", widthClass].join(
          " ",
        )}
      />

      {/*
        紺色の面は fixed で画面の上下いっぱいに貼る。

        はじめは sticky と h-dvh でやっていたが、面の高さが画面ぶんしか無く、
        本文がそれより長い画面（探す）では左下にクリーム色が 48px 残っていた。
        次に高さ指定を外して flex の伸長に任せたが、それでも伸びなかった
        （親は 1041px あるのに aside は 993px のまま。原因は特定できていない）。

        fixed なら親の高さにもスクロール量にも左右されず、常に画面を覆う。
        z-index は付けない。本文側が z-10 なので、モーダルは今までどおり
        サイドバーの上に出る。

        メニュー内にスクロール領域は作らない（overflow-y-clip）。
      */}
      <aside
        className={[
          "work-sidebar fixed inset-y-0 left-0 flex flex-col overflow-y-clip border-r transition-[width] duration-200",
          "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-fg)]",
          widthClass,
        ].join(" ")}
      >
      <div className="flex min-h-24 items-center border-b border-[var(--sidebar-active-border)] px-3 sm:hidden">
        {mobileOpen ? (
          <>
            <WorkBrand />
            <SidebarToggle
              open={mobileOpen}
              onClick={() => setMobileOpen(false)}
            />
          </>
        ) : (
          <SidebarToggle
            open={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="mx-auto"
          />
        )}
      </div>

      <div
        className={[
          "hidden min-h-24 items-center border-b border-[var(--sidebar-active-border)] sm:flex",
          open ? "sm:px-4" : "sm:px-2",
        ].join(" ")}
      >
        {open ? (
          <>
            <WorkBrand />
            <SidebarToggle open={open} onClick={() => setOpen(false)} />
          </>
        ) : (
          <SidebarToggle
            open={open}
            onClick={() => setOpen(true)}
            className="mx-auto"
          />
        )}
      </div>

      <nav
        className={[
          "flex flex-col gap-1.5",
          mobileOpen ? "p-3" : "p-2",
          open ? "sm:p-4" : "sm:p-2",
        ].join(" ")}
      >
        {mobileOpen ? (
          <span className="mb-1 px-3 text-[9px] font-semibold tracking-[0.22em] text-[var(--sidebar-muted)] sm:hidden">
            MENU
          </span>
        ) : null}
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
                "flex min-h-11 items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors",
                mobileOpen ? "" : "justify-center",
                open ? "sm:justify-start" : "sm:justify-center",
                active
                  ? "border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)]"
                  : "border-transparent text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)]",
              ].join(" ")}
            >
              <Icon />
              {mobileOpen ? (
                <span className="truncate sm:hidden">{item.label}</span>
              ) : null}
              {open ? (
                <span className="hidden truncate sm:block">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div
        className={[
          "mt-auto mb-5",
          mobileOpen ? "px-3" : "px-2",
          open ? "sm:px-4" : "sm:px-2",
        ].join(" ")}
      >
        <div className="sm:hidden">
          <AccountCard open={mobileOpen} />
        </div>
        <div className="hidden sm:block">
          <AccountCard open={open} />
        </div>
      </div>
      </aside>
    </>
  );
}

function WorkBrand() {
  return (
    <Link
      href="/discover"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2"
      title="MeetLink 社内コネクト"
    >
      <LogoMark prominent />
      <span className="min-w-0">
        <span className="work-brand-name block truncate text-lg font-semibold tracking-[0.035em] text-[var(--sidebar-fg)]">
          MeetLink
        </span>
        <span className="block truncate text-[10px] font-medium tracking-[0.12em] text-[var(--sidebar-muted)]">
          社内コネクト
        </span>
      </span>
    </Link>
  );
}

function SidebarToggle({
  open,
  onClick,
  className = "",
}: {
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "サイドバーを畳む" : "サイドバーを開く"}
      aria-expanded={open}
      className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)]",
        className,
      ].join(" ")}
    >
      <MenuIcon />
    </button>
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
            : "mx-auto h-9 w-9 rounded-full border border-[var(--logo-ring-a)] bg-[var(--sidebar-hover-bg)] object-cover p-0.5"
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
          : "rounded-[14px] border border-[var(--sidebar-active-border)] bg-[rgba(255,255,255,0.045)] p-2.5"
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
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-[var(--sidebar-active-fg)]">
            {currentUser.name}
          </span>
          <span className="block truncate text-[10px] text-[var(--sidebar-muted)]">
            {currentUser.department}
          </span>
        </span>
      </div>

      {/* 罫線で区切ると、名前や部署と別の情報だと分かりやすい */}
      <PointBalance className="mt-2 border-t border-[var(--sidebar-active-border)] pt-2 text-[var(--sidebar-active-fg)]" />
    </div>
  );
}

/**
 * 二重リングのロゴマーク。
 * 仕事モードは2つとも金色、恋愛モードは青とピンクになる（globals.css で切り替え）。
 */
function LogoMark({ prominent = false }: { prominent?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 24"
      aria-hidden
      className={prominent ? "h-7 w-10 shrink-0" : "h-5 w-8 shrink-0"}
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

/** 重ねたコイン。ポイントの残高を思わせる形にしている */
function PointIcon() {
  return (
    <svg {...iconProps()}>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
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

function AiIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M9 15h6" />
    </svg>
  );
}

const NAV = [
  { href: "/discover", label: "探す", icon: SearchIcon },
  { href: "/talk", label: "トーク", icon: TalkIcon },
  { href: "/board", label: "募集", icon: BoardIcon },
  { href: "/history", label: "履歴", icon: HistoryIcon },
  { href: "/ai-talk", label: "AI対話", icon: AiIcon },
  { href: "/points", label: "ポイント", icon: PointIcon },
  { href: "/me", label: "マイページ", icon: PersonIcon },
];
