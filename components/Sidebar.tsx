"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PointBalance, formatPoints } from "@/components/PointBalance";
import { NAV } from "@/components/nav-items";
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

  return (
    /*
      狭い画面では出さない。横幅を食うので、代わりに画面下のタブ
      （components/BottomNav.tsx）を使う。

      出し分けは CSS で行う。画面幅を JS で測ると、最初の描画では分からず
      一瞬ちらつくうえ、サーバー側の描画とも食い違う。
    */
    <aside
      className={[
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 sm:flex",
        "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-fg)]",
        open ? "sm:w-40" : "sm:w-16",
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
              {open ? (
                <span className="truncate">{item.label}</span>
              ) : null}
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
  );
}

/**
 * いまログインしているアカウント。
 * デモでアカウントを切り替えながら見せるので、誰で入っているかが
 * 常に分かるようにしている。
 */
function AccountCard({ open }: { open: boolean }) {
  const { currentUser } = useSession();

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
        className="mx-auto h-8 w-8 rounded-full bg-[var(--sidebar-hover-bg)] object-cover"
      />
    );
  }

  return (
    <div
      title={label}
      className="rounded-xl border border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] p-2"
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentUser.avatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full bg-[var(--sidebar-hover-bg)] object-cover"
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

/** サイドバーを畳むボタンのアイコン。ここでしか使わない */
function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
