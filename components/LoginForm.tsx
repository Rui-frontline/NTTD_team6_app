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
      <div className="mb-8 text-center">
        <p className="text-[10px] font-bold tracking-[0.28em] text-[var(--gold)]">
          MEET. CONNECT. GROW.
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-wide text-[var(--accent)]">
          MeetLink
        </h1>
        <p className="mt-1 text-xs tracking-[0.14em] text-muted">社内マッチング</p>
      </div>
      <p className="text-center text-sm leading-relaxed text-muted">
        会社のメールアドレスを持つ人だけが利用できます。
      </p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">メールアドレス</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[14px] border border-[#DED9D0] bg-[#FBFAF7] px-4 py-3 text-sm outline-none focus:border-accent"
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
            className="rounded-[14px] border border-[#DED9D0] bg-[#FBFAF7] px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </label>

        {error ? (
          <p className="rounded-[14px] border border-line bg-accent-soft px-4 py-3 text-sm text-accent">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="premium-primary mt-1 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-muted">
        はじめての方は{" "}
        <Link href="/signup" className="font-semibold text-accent underline decoration-[var(--gold)] underline-offset-4">
          新規登録
        </Link>
      </p>
    </div>
  );
}
