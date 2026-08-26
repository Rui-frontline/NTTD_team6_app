"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/session";

export function LoginForm() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // 成功したら AppShell が /discover へ飛ばす
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました。");
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">社内マッチング</h1>
      <p className="mt-2 text-sm text-muted">
        会社のメールアドレスを持つ人だけが利用できます。
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">メールアドレス</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">パスワード</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50"
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        <Link
          href="/forgot-password"
          className="font-bold text-accent underline"
        >
          パスワードをお忘れですか？
        </Link>
      </p>

      <p className="mt-3 text-sm text-muted">
        はじめての方は{" "}
        <Link href="/signup" className="font-bold text-accent underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
