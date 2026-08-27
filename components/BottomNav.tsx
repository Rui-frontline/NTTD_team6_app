"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/nav-items";

/**
 * 狭い画面で下に出すタブ。LINE や Instagram と同じ置き方。
 *
 * サイドバーは横幅を食う。375px の画面では、畳んでも 56px を本文から
 * 奪っていた。下に置けば横は全部使える。親指の届く位置でもある。
 *
 * 出し分けは CSS（sm:hidden / hidden sm:flex）で行う。画面幅を JS で
 * 測って出し分けると、最初の描画では分からないので一瞬ちらつくうえ、
 * サーバー側の描画とも食い違う。
 *
 * 項目は components/nav-items.tsx を回す。サイドバーと同じ並び。
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="画面の切り替え"
      className={[
        "fixed inset-x-0 bottom-0 z-30 flex sm:hidden",
        "border-t border-[var(--sidebar-active-border)] bg-[var(--sidebar-bg)]",
        // 端末の下端（ホームバーなど）に隠れないよう、その分だけ下に足す
        "pb-[env(safe-area-inset-bottom)]",
      ].join(" ")}
    >
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={[
              // 7つで横幅を等分する。basis-0 にしないと文字数の差で幅がばらつく
              "flex min-w-0 flex-1 basis-0 flex-col items-center gap-0.5 py-2 transition-colors",
              active
                ? "text-[var(--sidebar-active-fg)]"
                : "text-[var(--sidebar-muted)]",
            ].join(" ")}
          >
            <Icon />
            {/*
              7つ並ぶので、ここだけ短い名前を使う。
              「マイページ」のままだと 1項目 53px に収まらない
            */}
            <span className="truncate text-[10px] font-bold leading-none">
              {item.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
