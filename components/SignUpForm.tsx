"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/session";

export function SignUpForm() {
  const { signUp } = useSession();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    department: "",
    jobTitle: "",
    age: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUp({
        email: form.email,
        password: form.password,
        name: form.name,
        department: form.department,
        jobTitle: form.jobTitle,
        age: Number(form.age),
      });
      // 成功したら AppShell が /discover へ飛ばす
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">新規登録</h1>
      <p className="mt-2 text-sm text-muted">
        会社のメールアドレスを持つ人だけが利用できます。
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Field label="メールアドレス">
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </Field>

        <Field label="パスワード（6文字以上）">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </Field>

        <Field label="名前">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </Field>

        <Field label="部署">
          <input
            type="text"
            required
            value={form.department}
            onChange={(e) => update("department", e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </Field>

        <Field label="職種">
          <input
            type="text"
            required
            value={form.jobTitle}
            onChange={(e) => update("jobTitle", e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </Field>

        <Field label="年齢">
          <input
            type="number"
            required
            min={18}
            max={99}
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </Field>

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
          {busy ? "登録中…" : "登録する"}
        </button>

        <p className="text-xs text-muted">
          登録すると、まず仕事モードで公開されます。恋愛モードはマイページから自分でONにできます。
        </p>
      </form>

      <p className="mt-6 text-sm text-muted">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-bold text-accent underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
