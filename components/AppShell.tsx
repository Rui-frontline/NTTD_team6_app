"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useSession } from "@/lib/session";

/** ヘッダーとサイドバーを出さない画面 */
const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * 画面全体の骨組み。
 * ログイン・新規登録以外の画面は、未ログインなら /login に飛ばす。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated && !isPublic) router.replace("/login");
    if (isAuthenticated && isPublic) router.replace("/discover");
  }, [loading, isAuthenticated, isPublic, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        読み込み中…
      </div>
    );
  }

  if (isPublic) {
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
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
