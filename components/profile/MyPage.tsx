"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { updateProfile, updateUser } from "@/lib/repository";
import type { Profile, User } from "@/lib/types";
import { MODE_LABEL, MODES, TAG_OPTIONS } from "@/lib/types";
import { TagPicker } from "./TagPicker";

/** 年齢の選択肢。新規登録の入力欄と同じ 18〜99 に揃えている */
const AGE_OPTIONS = Array.from({ length: 99 - 18 + 1 }, (_, i) => 18 + i);

/**
 * マイページ本体。
 * - 表示中のモード(仕事/恋愛)はアプリ全体で共有されている useSession().mode を使う。
 *   タブを切り替えると data-mode も切り替わり、配色も連動する。
 * - 編集内容は下書き(draft)として持ち、「保存する」を押すまで確定しない。
 * - 保存は lib/repository の updateUser / updateProfile を呼ぶ(Supabase保存)。
 *   保存後は session.refreshUser() でDBから読み直してローカルのcurrentUserも最新化する。
 */
export function MyPage() {
  const { currentUser, mode, setMode, loading, refreshUser } = useSession();
  const [draft, setDraft] = useState<User | null>(currentUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 下書きにcurrentUserを取り込むのは「表示するユーザーが変わったとき」だけにする。
  //
  // currentUserが変わるたびに同期すると、保存後のrefreshUser()でも発火してしまい、
  // 保存中に編集した内容がDBの古い値で上書きされて消える。
  // (保存中は入力欄を止めるようにもしたが、それだけに頼らない)
  //
  // effectではなくレンダー中に調整しているのは、effectだと一度古い状態で画面に
  // 描かれてから直るため。直前のidを覚えているので無限ループにはならない。
  const [draftUserId, setDraftUserId] = useState<string | null>(
    currentUser?.id ?? null,
  );
  if ((currentUser?.id ?? null) !== draftUserId) {
    setDraftUserId(currentUser?.id ?? null);
    setDraft(currentUser);
  }

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

  const candidates = TAG_OPTIONS[mode];
  const modeProfile = draft[mode];
  const isParticipating = draft.enabledModes.includes(mode);

  const updateCommon = <K extends keyof User>(key: K, value: User[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateModeProfile = (patch: Partial<Profile>) => {
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

const handleSave = async () => {
    if (!draft || !currentUser) return;

    // 新規登録で必須にしている項目は、ここでも同じ条件を守る。
    // 空のまま保存できると、探す画面のカードやフィルターから情報が欠落する。
    const name = draft.name.trim();
    const department = draft.department.trim();
    const jobTitle = draft.jobTitle.trim();

    if (!name || !department || !jobTitle) {
      setError("名前・部署・職種は空にできません。");
      return;
    }
    if (!Number.isInteger(draft.age) || draft.age < 18 || draft.age > 99) {
      setError("年齢は18〜99の範囲で入力してください。");
      return;
    }

    setSaving(true);
    setError(null);

    // updateUser成功後にupdateProfileが失敗した場合、ここに戻す値。
    // enabledModesも含むので、「参加ONだけ通って古いプロフィールのまま
    // 一覧に公開される」事故を防ぐために使う。
    const previousCommon = {
      name: currentUser.name,
      department: currentUser.department,
      jobTitle: currentUser.jobTitle,
      age: currentUser.age,
      avatarUrl: currentUser.avatarUrl,
      enabledModes: currentUser.enabledModes,
    };

    try {
      await updateUser(draft.id, {
        name,
        department,
        jobTitle,
        age: draft.age,
        avatarUrl: draft.avatarUrl,
        enabledModes: draft.enabledModes,
      });

      try {
        await updateProfile(draft.id, mode, modeProfile);
      } catch (profileError) {
        // 後段が失敗したので、先行したupdateUserを元の値に戻す。
        try {
          await updateUser(draft.id, previousCommon);
        } catch (rollbackError) {
          // ロールバック自体の失敗はコンソールに残すだけにする。
          // ここで例外を投げ直すと元のエラーが握りつぶされるため。
          console.error("ロールバックにも失敗しました", rollbackError);
        }
        throw profileError;
      }

      await refreshUser(); // DBから読み直してローカルのcurrentUserも最新化
      // 前後の空白を落とした値で保存したので、入力欄の表示も揃えておく
      setDraft((prev) => (prev ? { ...prev, name, department, jobTitle } : prev));
    } catch (e) {
      setError("保存に失敗しました。もう一度お試しください。");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl bg-[var(--background)] px-4 py-6 text-[var(--foreground)]">
      <h1 className="mb-6 text-xl font-bold">マイページ</h1>

      {/*
        保存中は編集をまとめて止める。
        fieldset の disabled は中の input / textarea / button すべてに伝わるので、
        入力欄・スイッチ・タグ・モードタブが一度に無効化される。
        保存ボタンだけを止めていたときは、通信中に編集できてしまい、
        保存後の refreshUser() でその編集が消えていた。
      */}
      <fieldset disabled={saving} className="m-0 border-0 p-0">

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
          {/*
            数値入力ではなく選択にしている。
            input[type=number] は中身を全部消すと Number("") が 0 になり、
            意図せず 0 歳で保存されてしまうため。選択なら範囲外の値を作れない。
          */}
          <select
            value={AGE_OPTIONS.includes(draft.age) ? draft.age : ""}
            onChange={(e) => updateCommon("age", Number(e.target.value))}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {/* 登録前のデータなどで範囲外の値が入っていたとき用 */}
            {AGE_OPTIONS.includes(draft.age) ? null : (
              <option value="" disabled>
                選択してください
              </option>
            )}
            {AGE_OPTIONS.map((age) => (
              <option key={age} value={age}>
                {age}
              </option>
            ))}
          </select>
        </Field>

        <Field label="職種">
          <input
            type="text"
            value={draft.jobTitle}
            onChange={(e) => updateCommon("jobTitle", e.target.value)}
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
            値は仕事/恋愛で共通です。表示するかどうかは各モードのタブで設定できます。
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
        <div className="flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3">
          <div>
            <p className="text-sm font-medium">部署を表示する</p>
            <p className="text-xs text-[var(--muted)]">
              {MODE_LABEL[mode]}モードのプロフィールに部署を表示します
            </p>
          </div>
          <Switch
            checked={modeProfile.showDepartment}
            onChange={(v) => updateModeProfile({ showDepartment: v })}
          />
        </div>

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
          selected={modeProfile.tags}
          onChange={(tags) => updateModeProfile({ tags })}
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

      </fieldset>

      {error && (
        <p className="mt-4 text-sm text-[var(--accent-strong)]">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-8 w-full rounded-lg bg-[var(--accent)] py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
      >
        {saving ? "保存中..." : "保存する"}
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
      // p-0 が無いと button の既定の内側余白のぶん、中の丸がずれる
      className={[
        "relative h-6 w-11 shrink-0 rounded-full p-0 transition-colors",
        "disabled:opacity-50",
        checked ? "bg-[var(--accent)]" : "bg-[var(--line)]",
      ].join(" ")}
    >
      {/*
        left-0.5 が要る。absolute は位置指定が無いと「本来そこに置かれるはずだった
        場所」を起点にするため、button の内側余白のぶん右にずれた状態から
        translate-x-5 が乗り、丸が枠を飛び出していた。
        枠 44px / 丸 20px なので、左右 2px ずつ空けて移動量は 20px。
      */}
      <span
        className={[
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}
