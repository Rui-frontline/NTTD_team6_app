"use client";

import { useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { updateProfile, updateUser } from "@/lib/repository";
import { fileToAvatarImage } from "@/lib/image";
import { PageHeading } from "@/components/PageHeading";
import { PointBalance } from "@/components/PointBalance";
import type { Profile, User } from "@/lib/types";
import { MODE_LABEL, MODES, TAG_OPTIONS } from "@/lib/types";
import {
  JOB_TITLE_OPTIONS,
  PROFILE_FIELDS,
  UNSET,
  USER_FIELDS,
} from "@/lib/profile-fields";
import {
  departmentLeaf,
  findDepartmentPath,
  isDepartmentComplete,
  joinDepartmentPath,
  splitDepartmentPath,
} from "@/lib/departments";
import {
  DepartmentPicker,
  INPUT_CLASS,
  NumberSelect,
  Select,
  TextInput,
} from "./fields";
import { TagPicker } from "./TagPicker";

/** 年齢の選択肢。新規登録の入力欄と同じ 18〜99 に揃えている */
const AGE_OPTIONS = Array.from({ length: 99 - 18 + 1 }, (_, i) => 18 + i);

/**
 * マイページ本体。
 * - 表示中のモード(仕事/恋愛)はアプリ全体で共有されている useSession().mode を使う。
 *   タブを切り替えると data-mode も切り替わり、配色も連動する。
 * - 編集内容は下書き(draft)として持ち、「保存する」を押すまで確定しない。
 *   アイコンだけは選んだ時点で Storage に上がるが、users.avatar_url への
 *   反映は他の項目と同じく保存時にまとめて行う。
 * - 保存は lib/repository の updateUser / updateProfile を呼ぶ(Supabase保存)。
 *   保存後は session.refreshUser() でDBから読み直してローカルのcurrentUserも最新化する。
 */
export function MyPage() {
  const { currentUser, mode, setMode, loading, refreshUser } = useSession();
  const [draft, setDraft] = useState<User | null>(currentUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // 隠しファイル入力を「アイコンを変更」ボタンから開くための参照
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  // 経路を持っていない古いデータは、いちばん下の名前から逆引きして復元する。
  // 選択肢に無い部署（ダミーデータなど）は空のままになり、選び直してもらう。
  const departmentParts = draft.departmentPath
    ? splitDepartmentPath(draft.departmentPath)
    : (findDepartmentPath(draft.department) ?? []);
  // 選択肢に無い職種（選択式にする前に登録されたもの）が入っていないか。
  // 入っていたら未選択として扱い、選び直してもらう。
  const jobTitleInOptions = (JOB_TITLE_OPTIONS as readonly string[]).includes(
    draft.jobTitle,
  );
  const isParticipating = draft.enabledModes.includes(mode);
  const isWork = mode === "work";
  const fieldControlClass = isWork
    ? "w-full rounded-[14px] border border-[#DED9D0] bg-[#FBFAF7] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-0"
    : "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

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

  /**
   * 写真が選ばれたら、その場で Storage に上げて下書きのURLを差し替える。
   *
   * アップロードだけ先に済ませておき、users.avatar_url への保存は
   * 他の項目と同じく「保存する」を押したときにまとめて行う。
   * (保存せずに離れたぶんの画像は Storage に残るが、後から画面で片付けられる)
   */
  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // 同じファイルを選び直しても発火するように、値は毎回空にしておく
    e.target.value = "";
    if (!file || !draft) return;

    setUploadingAvatar(true);
    setError(null);
    try {
      const url = await fileToAvatarImage(draft.id, file);
      updateCommon("avatarUrl", url);
    } catch (err) {
      // lib/image.ts が投げるのは画面にそのまま出せる日本語のメッセージ
      setError(
        err instanceof Error
          ? err.message
          : "写真をアップロードできませんでした。",
      );
      console.error(err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !currentUser) return;

    // 新規登録で必須にしている項目は、ここでも同じ条件を守る。
    // 空のまま保存できると、探す画面のカードやフィルターから情報が欠落する。
    const name = draft.name.trim();
    const jobTitle = draft.jobTitle.trim();

    if (!name) {
      setError("名前は空にできません。");
      setSaved(false);
      return;
    }
    // 選択肢から選ばれていない職種は、探す画面の絞り込みと噛み合わないので弾く
    if (!(JOB_TITLE_OPTIONS as readonly string[]).includes(jobTitle)) {
      setError("職種を選択してください。");
      setSaved(false);
      return;
    }

    // 部署は draft.departmentPath ではなく departmentParts で見る。
    // 経路を持たない既存ユーザーは、画面上は末端の名前から復元できていても
    // draft.departmentPath が空のままなので、そちらを見ると必ず失敗し、
    // 部署に触っていなくても他の項目まで保存できなくなる。
    //
    // 未選択も途中で止めた状態も、この判定でまとめて弾ける。
    if (!isDepartmentComplete(departmentParts)) {
      setError("会社・部署はいちばん下の階層まで選んでください。");
      setSaved(false);
      return;
    }
    if (!Number.isInteger(draft.age) || draft.age < 18 || draft.age > 99) {
      setError("年齢は18〜99の範囲で入力してください。");
      setSaved(false);
      return;
    }

    // 希望年齢は両方入れたときだけ前後関係を見る（片方だけの指定も許す）
    const { preferredAgeMin, preferredAgeMax } = modeProfile;
    if (
      preferredAgeMin !== null &&
      preferredAgeMax !== null &&
      preferredAgeMin > preferredAgeMax
    ) {
      setError("希望する相手の年齢は、最低年齢を最高年齢以下にしてください。");
      setSaved(false);
      return;
    }

    // 復元したぶんもここで保存され、次からは経路が埋まった状態になる
    const department = departmentLeaf(departmentParts);
    const departmentPath = joinDepartmentPath(departmentParts);

    setSaving(true);
    setError(null);

    // updateUser成功後にupdateProfileが失敗した場合、ここに戻す値。
    // enabledModesも含むので、「参加ONだけ通って古いプロフィールのまま
    // 一覧に公開される」事故を防ぐために使う。
    const previousCommon = {
      name: currentUser.name,
      department: currentUser.department,
      departmentPath: currentUser.departmentPath,
      jobTitle: currentUser.jobTitle,
      age: currentUser.age,
      gender: currentUser.gender,
      university: currentUser.university,
      avatarUrl: currentUser.avatarUrl,
      enabledModes: currentUser.enabledModes,
    };

    try {
      await updateUser(draft.id, {
        name,
        department,
        departmentPath,
        jobTitle,
        age: draft.age,
        gender: draft.gender,
        university: draft.university.trim(),
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
      setDraft((prev) =>
        prev ? { ...prev, name, department, departmentPath, jobTitle } : prev,
      );
      
      // 保存できたことを一時的に知らせる。3秒で自動的に消す。
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("保存に失敗しました。もう一度お試しください。");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={
        isWork
          ? "mx-auto w-full max-w-6xl text-[var(--foreground)]"
          : "mx-auto max-w-xl bg-[var(--background)] px-4 py-6 text-[var(--foreground)]"
      }
    >
      <PageHeading
        title="マイページ"
        description="相手に表示されるプロフィールを編集できます。"
      />

      {!isWork ? (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3">
          <span className="text-sm font-medium">保有ポイント</span>
          <PointBalance className="text-[var(--accent)]" />
        </div>
      ) : null}

      <div
        className={
          isWork
            ? "grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8"
            : "block"
        }
      >
        {isWork ? (
        <aside className="premium-card overflow-hidden lg:sticky lg:top-26">
          <div className="aspect-[4/5] overflow-hidden bg-[var(--accent-soft)]">
            {draft.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.avatarUrl}
                alt="プロフィール写真"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                写真未設定
              </div>
            )}
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold tracking-[0.22em] text-[var(--gold)]">
              YOUR PROFILE
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-wide text-[var(--accent)]">
              {draft.name}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {draft.department} / {draft.jobTitle}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {modeProfile.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--accent-strong)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4">
              <span className="text-xs text-[var(--muted)]">保有ポイント</span>
              <PointBalance className="text-[var(--accent)]" />
            </div>
          </div>
        </aside>
        ) : null}

        <div className={isWork ? "premium-card p-5 sm:p-7 lg:p-9" : ""}>

      {/*
        保存中は編集をまとめて止める。
        fieldset の disabled は中の input / textarea / button すべてに伝わるので、
        入力欄・スイッチ・タグ・モードタブが一度に無効化される。
        保存ボタンだけを止めていたときは、通信中に編集できてしまい、
        保存後の refreshUser() でその編集が消えていた。
      */}
      <fieldset disabled={saving} className="m-0 border-0 p-0">

      {/* 共通項目 */}
      <section className={isWork ? "mb-9 space-y-5" : "mb-8 space-y-4"}>
        {isWork ? <SectionLabel number="01" title="基本情報" /> : null}
        <div className="flex items-center gap-4">
          <div
            className={
              isWork
                ? "h-18 w-18 shrink-0 overflow-hidden rounded-full border border-[var(--gold-soft)] bg-[var(--surface)] p-0.5"
                : "h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface)]"
            }
          >
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
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className={
                isWork
                  ? "rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)] disabled:opacity-60"
                  : "rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-60"
              }
            >
              {uploadingAvatar ? "アップロード中..." : "アイコンを変更"}
            </button>
            <p className="mt-1 text-xs text-[var(--muted)]">
              保存するまで反映されません
            </p>
          </div>
        </div>

        <Field label="名前">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => updateCommon("name", e.target.value)}
            className={fieldControlClass}
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
            className={fieldControlClass}
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
<<<<<<< HEAD
          <input
            type="text"
            value={draft.jobTitle}
            onChange={(e) => updateCommon("jobTitle", e.target.value)}
            className={fieldControlClass}
=======
          <Select
            value={jobTitleInOptions ? draft.jobTitle : UNSET}
            options={JOB_TITLE_OPTIONS}
            onChange={(v) => updateCommon("jobTitle", v)}
>>>>>>> 4b48676864818780b8b8355e95e0b1968b0beab7
          />
          {/* 選択肢に無い値が登録済みのときは、黙って消さずに知らせる */}
          {!jobTitleInOptions && draft.jobTitle ? (
            <p className="mt-1 text-xs text-[var(--accent-strong)]">
              現在の登録は「{draft.jobTitle}
              」です。選択肢に無いので選び直してください。
            </p>
          ) : null}
        </Field>

<<<<<<< HEAD
        <Field label="部署">
          <input
            type="text"
            value={draft.department}
            onChange={(e) => updateCommon("department", e.target.value)}
            className={fieldControlClass}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            値は仕事/恋愛で共通です。表示するかどうかは各モードのタブで設定できます。
          </p>
        </Field>
=======
        <DepartmentPicker
          parts={departmentParts}
          fallback={draft.department}
          onChange={(parts) => {
            // 表示と絞り込みで使うのはいちばん下の名前だけ。
            // 経路は選び直すときの復元にだけ使うので、別に持つ。
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    department: departmentLeaf(parts),
                    departmentPath: joinDepartmentPath(parts),
                  }
                : prev,
            );
          }}
        />
        <p className="-mt-1 text-xs text-[var(--muted)]">
          値は仕事/恋愛で共通です。表示するかどうかは各モードのタブで設定できます。
        </p>

        {/* 性別・出身大学。定義は lib/profile-fields.ts に置いてある */}
        {USER_FIELDS.map((field) => (
          <Field key={field.key} label={field.label}>
            {field.kind === "select" ? (
              <Select
                value={draft[field.key]}
                options={field.options}
                onChange={(v) => updateCommon(field.key, v)}
              />
            ) : (
              <TextInput
                value={draft[field.key]}
                onChange={(v) => updateCommon(field.key, v)}
              />
            )}
          </Field>
        ))}
>>>>>>> 4b48676864818780b8b8355e95e0b1968b0beab7
      </section>

      {/* モード切り替えタブ(アプリ全体のモードと連動) */}
      {isWork ? <SectionLabel number="02" title="プロフィール公開設定" /> : null}
      <div
        className={
          isWork
            ? "mb-5 mt-5 flex rounded-[16px] border border-[var(--line)] bg-[#F4F1EB] p-1.5"
            : "mb-4 flex rounded-lg bg-[var(--surface)] p-1"
        }
      >
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={[
              isWork
                ? "flex-1 rounded-[12px] py-2.5 text-sm font-medium transition-colors"
                : "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
              mode === m
                ? isWork
                  ? "bg-[var(--accent)] text-white [box-shadow:var(--soft-shadow)]"
                  : "bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            {MODE_LABEL[m]}モード
          </button>
        ))}
      </div>

      {/* モード別項目 */}
      <section className="space-y-5">
        <div
          className={
            isWork
              ? "flex items-center justify-between rounded-[14px] border border-[var(--line)] bg-[#FBFAF7] px-4 py-3.5"
              : "flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3"
          }
        >
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
            className={
              isWork
                ? "w-full resize-none rounded-[14px] border border-[#DED9D0] bg-[#FBFAF7] px-4 py-3 text-sm leading-relaxed text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-0"
                : "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
            }
          />
        </Field>

        {isWork ? <div className="pt-2">
          <SectionLabel number="03" title="興味・スキル" compact />
        </div> : null}

        <TagPicker
          candidates={candidates}
          selected={modeProfile.tags}
          onChange={(tags) => updateModeProfile({ tags })}
        />

<<<<<<< HEAD
        <div
          className={
            isWork
              ? "flex items-center justify-between rounded-[14px] border border-[var(--line)] bg-[#FBFAF7] px-4 py-3.5"
              : "flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3"
          }
        >
=======
        {/*
          モードごとの追加項目。何をどの順で出すかは
          lib/profile-fields.ts の PROFILE_FIELDS が持っている。
          19個ぶんを手書きするとこのファイルが読めなくなるため。
        */}
        {PROFILE_FIELDS[mode].map((field) => (
          <Field key={field.key} label={field.label}>
            {field.kind === "select" ? (
              <Select
                value={modeProfile[field.key]}
                options={field.options}
                onChange={(v) => updateModeProfile({ [field.key]: v })}
              />
            ) : field.kind === "number" ? (
              <NumberSelect
                value={modeProfile[field.key]}
                min={field.min}
                max={field.max}
                unit={field.unit}
                onChange={(v) => updateModeProfile({ [field.key]: v })}
              />
            ) : field.multiline ? (
              <textarea
                value={modeProfile[field.key]}
                onChange={(e) =>
                  updateModeProfile({ [field.key]: e.target.value })
                }
                rows={3}
                className={INPUT_CLASS + " resize-none"}
              />
            ) : (
              <TextInput
                value={modeProfile[field.key]}
                onChange={(v) => updateModeProfile({ [field.key]: v })}
              />
            )}
          </Field>
        ))}

        <div className="flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3">
>>>>>>> 4b48676864818780b8b8355e95e0b1968b0beab7
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
            {saved && !error && (
        <p className="mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          保存しました
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={
          isWork
            ? "premium-primary mt-8 w-full py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            : "mt-8 w-full rounded-lg bg-[var(--accent)] py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
        }
      >
        {saving ? "保存中..." : "保存する"}
      </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({
  number,
  title,
  compact = false,
}: {
  number: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className={["flex items-center gap-3", compact ? "mb-4" : ""].join(" ")}>
      <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-lg bg-[var(--accent)] px-2 text-[10px] font-bold tracking-wider text-white">
        {number}
      </span>
      <h2 className="text-base font-semibold tracking-wide text-[var(--accent)]">
        {title}
      </h2>
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
      <span className="profile-field-label mb-2 block text-sm font-medium text-[var(--accent)]">{label}</span>
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
