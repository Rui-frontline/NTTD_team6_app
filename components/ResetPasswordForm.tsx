"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";

/** パスワードの最低文字数。Supabase 側の既定と合わせている */
const MIN_PASSWORD_LENGTH = 6;

/**
 * メールのリンクから来た人が、新しいパスワードを設定する画面。
 *
 * ここは現在のパスワードを聞かない唯一の変更経路なので、
 * 「再設定のリンクから来た」ことを確かめてからでないとフォームを出さない。
 *
 * 判定に使うのは isPasswordRecovery（lib/session.tsx）。
 * セッションの有無では判定できない。通常のログインでもセッションはあるため、
 * それを根拠にすると、ログインしたまま席を離れた端末で /reset-password を
 * 開くだけでパスワードを変えられてしまう。
 */
export function ResetPasswordForm() {
  const { isPasswordRecovery, completePasswordReset, loading } = useSession();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`);
      return;
    }
    if (password !== confirm) {
      setError("確認用のパスワードが一致しません。");
      return;
    }

    setBusy(true);
    try {
      await completePasswordReset(password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "パスワードを変更できませんでした。",
      );
      setBusy(false);
    }
  }

  /*
    起動直後の判定を待つ。

    PASSWORD_RECOVERY はリンクの読み取り中に飛ぶ。読み取りは
    SessionProvider の getSession() より先に終わるので、loading が false に
    なった時点では isPasswordRecovery が確定している。

    ここを待たずに出すと、正しく来た人にも一瞬「リンクが使えません」が
    見えてしまう。
  */
  if (loading) {
    return <p className="text-sm text-muted">確認中…</p>;
  }

  /*
    リンクが古い、直接この URL を開いた、ページを読み込み直した、のいずれか。

    どれも「再設定のリンクから来た」と確認できていないので、
    現在のパスワード無しの変更は通さない。送り直してもらう。
  */
  if (!isPasswordRecovery) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">リンクが使えません</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          リンクの期限が切れているか、すでに使われています。
          もう一度、再設定のメールを送ってください。
        </p>
        <p className="mt-8 text-sm text-muted">
          <Link
            href="/forgot-password"
            className="font-bold text-accent underline"
          >
            再設定のメールを送る
          </Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">変更しました</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          新しいパスワードを設定しました。そのまま利用できます。
        </p>
        <button
          type="button"
          onClick={() => router.push("/discover")}
          className="mt-8 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white"
        >
          はじめる
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">新しいパスワード</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {MIN_PASSWORD_LENGTH}文字以上で設定してください。
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">新しいパスワード</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">確認のためもう一度</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {busy ? "変更中…" : "パスワードを変更する"}
        </button>
      </form>
    </div>
  );
}
