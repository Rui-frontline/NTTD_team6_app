"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { RomanceDecor } from "@/components/RomanceDecor";
import { Sidebar } from "@/components/Sidebar";
import { useSession } from "@/lib/session";

/** ヘッダーとサイドバーを出さず、ログイン済みなら /discover へ送る画面 */
const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * パスワード再設定の画面。
 *
 * 枠を出さないのは PUBLIC_PATHS と同じだが、こちらは
 * ログイン済みでも追い出さない。
 *
 * 再設定のリンクを踏むと、その時点でログイン状態になる。PUBLIC_PATHS に
 * 入れてしまうと /discover へ飛ばされ、新しいパスワードを設定する画面に
 * たどり着けない。
 */
const PASSWORD_PATHS = ["/forgot-password", "/reset-password"];

/**
 * 画面全体の骨組み。
 * ログイン・新規登録・パスワード再設定以外は、未ログインなら /login に飛ばす。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isPasswordPath = PASSWORD_PATHS.includes(pathname);
  /** 枠（サイドバー・ヘッダー）を出さない画面 */
  const isBare = isPublic || isPasswordPath;

  useEffect(() => {
    if (loading) return;
    // 再設定の画面はログインの有無で振り分けない
    if (isPasswordPath) return;
    if (!isAuthenticated && !isPublic) router.replace("/login");
    if (isAuthenticated && isPublic) router.replace("/discover");
  }, [loading, isAuthenticated, isPublic, isPasswordPath, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        読み込み中…
      </div>
    );
  }

  if (isBare) {
    return <main className="mx-auto w-full max-w-md px-4 py-16">{children}</main>;
  }

  if (!isAuthenticated) {
    // リダイレクト待ちの一瞬だけ表示される
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        ログイン画面に移動しています…
      </div>
    );
  }

  // サイドバーが左端を全高で占め、ヘッダーはその右だけに乗る（デザイン案の構成）
  //
  // 飾りは本文より前に置き、本文側に relative z-10 を付けて上に重ねる。
  // こうすると飾りが文字の下に回り、読みにくくならない。
  return (
    <div className="flex min-h-screen">
      <RomanceDecor />
      <Sidebar />
      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        {/*
          狭い画面では左右の余白を詰める。px-6（左右で48px）は
          375px の画面では大きすぎて、中身に使える幅がその分削られる。

          下の余白は、画面下のタブに隠れないぶん。タブは fixed なので
          場所を取らず、ここで空けておかないと最後の項目が隠れる。
        */}
        <main className="flex-1 px-3 pt-6 pb-24 sm:px-6 sm:pt-8 sm:pb-8">
          {children}
        </main>
      </div>

      {/* 狭い画面だけ。サイドバーの代わりに画面下へ置く */}
      <BottomNav />
    </div>
  );
}
