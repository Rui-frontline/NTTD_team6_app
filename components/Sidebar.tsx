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
 * ふだんはアイコンだけの幅で、カーソルを乗せると名前まで開く。
 * 畳むボタンは置かない。押して開くほどの手間ではなく、常に1つ
 * ボタンが居座るほうが邪魔になる。
 *
 * 開閉を CSS の :hover ではなく state で持っているのは、行き先を選んだあとに
 * 閉じたいから。押した時点でカーソルはまだサイドバーの上にあるので、
 * :hover のままだと開きっぱなしになる。
 *
 * 狭い画面では出さない。横幅を食うので、代わりに画面下のタブ
 * （components/BottomNav.tsx）を使う。
 *
 * 配色はモードで大きく変わるので、色は globals.css の --sidebar-* を参照する。
 * 仕事モードは濃紺の面に白文字、恋愛モードはほぼ白の面に濃紺文字。
 */
export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/*
        場所取り。下の aside は fixed で浮いているため、本文の横に
        その分の隙間を作る役がいる。

        開閉で幅が変わるのは aside だけで、こちらは動かさない。両方
        動かすと、カーソルを近づけるたびに本文が左右に揺れる。
      */}
      <div aria-hidden className="hidden w-16 shrink-0 sm:block" />

      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        /*
          キーボードで移動している人も開けるようにする。
          カーソルだけだと、Tab で辿ったときに名前が出ない。
          React の onFocus / onBlur は中の要素の出入りでも呼ばれる。
        */
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          /*
            サイドバーの外へ出たときだけ閉じる。

            中の別の項目へ移っただけで閉じると、名前の span が消える。
            フォーカスが移るのは mousedown の時点なので、そのあとの
            mouseup で押していた相手がいなくなり、click が発生しない。
            結果、名前を押しても遷移せず、二度押しが必要になる。

            アイコンは常に描かれているので、この問題は名前だけに出る。
          */
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        className={[
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r sm:flex",
          "transition-[width] duration-200",
          open ? "w-40" : "w-16",
          "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-fg)]",
        ].join(" ")}
      >
        <nav className="flex flex-col gap-1 p-3 pt-4">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                /*
                  選んだら閉じる。押した時点でカーソルはまだサイドバーの上に
                  あるので、放っておくと開いたまま残る。
                  次に開くのは、いちど離れて乗せ直したとき。
                */
                onClick={() => setOpen(false)}
                className={[
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                  active
                    ? "border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)]"
                    : "border-transparent text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover-bg)]",
                ].join(" ")}
              >
                <Icon />
                {/*
                  畳んでいる間は名前を出さない。w-16 に収まらず、
                  はみ出したぶんが横に飛び出す
                */}
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

/**
 * いまログインしているアカウント。
 * デモでアカウントを切り替えながら見せるので、誰で入っているかが
 * 常に分かるようにしている。
 *
 * 畳んでいるときと開いたときで作りが違う。開いた側だけを縮めても、
 * 枠と余白が w-16 に収まらないため、まるごと差し替える。
 */
function AccountCard({ open }: { open: boolean }) {
  const { currentUser } = useSession();

  if (!currentUser) return null;

  // 畳んでいるとポイントが見えなくなるので、ここに入れておく
  const label = `${currentUser.name}（${currentUser.department}） ${formatPoints(
    currentUser.points,
  )} pt`;

  // 畳んでいるときは枠を出さず、アイコンだけ中央に置く
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
