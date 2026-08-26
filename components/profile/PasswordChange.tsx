"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";

/** パスワードの最低文字数。Supabase 側の既定と合わせている */
const MIN_PASSWORD_LENGTH = 6;

/**
 * ログイン中にパスワードを変える欄。マイページに置く。
 *
 * 開いたままだと入力欄が3つ居座るので、普段は閉じておく。
 * 変える人はめったにいない。
 *
 * 現在のパスワードを確認するのは、ログインしたまま席を離れた端末で
 * 他人にアカウントを乗っ取られないため（確認は lib/session.tsx が行う）。
 */
export function PasswordChange() {
  const { changePassword } = useSession();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`);
      return;
    }
    if (next !== confirm) {
      setError("確認用のパスワードが一致しません。");
      return;
    }
    if (next === current) {
      setError("いまと同じパスワードです。");
      return;
    }

    setBusy(true);
    try {
      await changePassword(current, next);
      // 入力を残さない。共用の端末で次の人に見られないようにする
      reset();
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "パスワードを変更できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-6 border-t border-[var(--line)] pt-6">
        {done ? (
          <p className="mb-3 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-strong)]">
            パスワードを変更しました。
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-bold transition-colors hover:bg-[var(--background)]"
        >
          パスワードを変更
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-3 border-t border-[var(--line)] pt-6"
    >
      <p className="text-sm font-bold">パスワードを変更</p>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[var(--muted)]">
          現在のパスワード
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[var(--muted)]">
          新しいパスワード
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[var(--muted)]">
          確認のためもう一度
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--accent-strong)]">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={busy}
          className="flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-bold transition-colors hover:bg-[var(--background)] disabled:opacity-50"
        >
          やめる
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-50"
        >
          {busy ? "変更中…" : "変更する"}
        </button>
      </div>
    </form>
  );
}
