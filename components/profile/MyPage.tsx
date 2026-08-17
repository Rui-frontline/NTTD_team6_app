"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import type { Mode, User } from "@/lib/types";
import { MODE_LABEL, MODES } from "@/lib/types";
import { getTagCandidates } from "@/constants/profileTags";
import { TagPicker } from "./TagPicker";

/**
 * マイページ本体。
 * - 表示中のモード(仕事/恋愛)はアプリ全体で共有されている useSession().mode を使う。
 *   タブを切り替えると data-mode も切り替わり、配色も連動する。
 * - 編集内容は下書き(draft)として持ち、「保存する」を押すまで確定しない。
 * - 保存は session.login() でローカルの currentUser を更新している(暫定対応)。
 *   実際のAPIができたら、この保存処理をAPI呼び出しに差し替える。
 */
export function MyPage() {
  const { currentUser, mode, setMode, loading, login } = useSession();
  const [draft, setDraft] = useState<User | null>(currentUser);

  // currentUserが変わった(ログイン/初期ロード完了)ら下書きを同期する
  useEffect(() => {
    setDraft(currentUser);
  }, [currentUser]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center text-[var(--muted)]">
        読み込み中...
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center text-[var(--muted)]">
        ログインしてください
      </div>
    );
  }

  const candidates = getTagCandidates(mode);
  const modeProfile = draft[mode];
  const isParticipating = draft.enabledModes.includes(mode);

  const updateCommon = <K extends keyof User>(key: K, value: User[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateModeProfile = (patch: Partial<User["work"] & User["romance"]>) => {
    setDraft((prev) =>
      prev ? { ...prev, [mode]: { ...prev[mode], ...patch } } : prev
    );
  };

  const toggleParticipate = (next: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const enabledModes = next
        ? [...new Set([...prev.enabledModes, mode])]
        : prev.enabledModes.filter((m) => m !== mode);
      return { ...prev, enabledModes };
    });
  };

  const handleSave = () => {
    if (!draft) return;
    // TODO: バックエンドができたらここをAPI呼び出しに差し替える
    login(draft);
  };

  return (
    <div className="mx-auto max-w-xl bg-[var(--background)] px-4 py-6 text-[var(--foreground)]">
      <h1 className="mb-6 text-xl font-bold">マイページ</h1>

      {/* 共通項目 */}
      <section className="mb-8 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface)]">
            {draft.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.avatarUrl}
                alt="プロフィールアイコン"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
                未設定
              </div>
            )}
          </div>
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface)]"
          >
            アイコンを変更
          </button>
        </div>

        <Field label="名前">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => updateCommon("name", e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </Field>

        <Field label="年齢">
          <input
            type="number"
            value={draft.age}
            onChange={(e) => updateCommon("age", Number(e.target.value))}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </Field>

        <Field label="部署">
          <input
            type="text"
            value={draft.department}
            onChange={(e) => updateCommon("department", e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            値は仕事/恋愛で共通です。恋愛モードでは非表示にできます。
          </p>
        </Field>
      </section>

      {/* モード切り替えタブ(アプリ全体のモードと連動) */}
      <div className="mb-4 flex rounded-lg bg-[var(--surface)] p-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={[
              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
              mode === m
                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            {MODE_LABEL[m]}モード
          </button>
        ))}
      </div>

      {/* モード別項目 */}
      <section className="space-y-5">
        {mode === "romance" && (
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3">
            <div>
              <p className="text-sm font-medium">部署を表示する</p>
              <p className="text-xs text-[var(--muted)]">
                OFFにすると恋愛モードのプロフィールで部署が隠れます
              </p>
            </div>
            <Switch
              checked={!draft.romance.hideDepartment}
              onChange={(v) => updateModeProfile({ hideDepartment: !v })}
            />
          </div>
        )}

        <Field label="自己紹介文">
          <textarea
            value={modeProfile.bio}
            onChange={(e) => updateModeProfile({ bio: e.target.value })}
            rows={4}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
          />
        </Field>

        <TagPicker
          candidates={candidates}
          selected={mode === "work" ? draft.work.skills : draft.romance.hobbies}
          onChange={(tags) =>
            updateModeProfile(
              mode === "work" ? { skills: tags } : { hobbies: tags }
            )
          }
        />

        <div className="flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3">
          <div>
            <p className="text-sm font-medium">このモードに参加する</p>
            <p className="text-xs text-[var(--muted)]">
              OFFにすると{MODE_LABEL[mode]}モードの一覧に自分が出なくなります
            </p>
          </div>
          <Switch checked={isParticipating} onChange={toggleParticipate} />
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        className="mt-8 w-full rounded-lg bg-[var(--accent)] py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
      >
        保存する
      </button>
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
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-[var(--accent)]" : "bg-[var(--line)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
