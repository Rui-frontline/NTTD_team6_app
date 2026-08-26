"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/session";

/**
 * パスワードを忘れた人が、再設定のリンクをメールで受け取る画面。
 *
 * 送ったあとは、そのメールアドレスが登録されているかどうかに関わらず
 * 同じ文面を出す。出し分けると、誰でも「このアドレスはこのアプリに
 * 登録されているか」を試せてしまう。
 */
export function ForgotPasswordForm() {
  const { requestPasswordReset } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "メールを送信できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">メールを送りました</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {email} 宛に、パスワードを再設定するリンクを送りました。
          メールを開いてリンクを踏んでください。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          届かないときは、迷惑メールに入っていないか確認してください。
          登録されていないアドレスにはメールは届きません。
        </p>

        <p className="mt-8 text-sm text-muted">
          <Link href="/login" className="font-bold text-accent underline">
            ログイン画面に戻る
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">パスワードの再設定</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        登録しているメールアドレスに、再設定用のリンクを送ります。
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
          {busy ? "送信中…" : "再設定のリンクを送る"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="font-bold text-accent underline">
          ログイン画面に戻る
        </Link>
      </p>
    </div>
  );
}
