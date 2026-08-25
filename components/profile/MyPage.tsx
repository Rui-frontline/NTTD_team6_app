"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import {
  claimProfileMilestones,
  getClaimedMilestones,
  updateProfile,
  updateUser,
} from "@/lib/repository";
import type { ClaimedMilestones } from "@/lib/repository";
import { fileToAvatarImage } from "@/lib/image";
import { profileCompletion } from "@/lib/profile-completion";
import { PageHeading } from "@/components/PageHeading";
import { PointBalance } from "@/components/PointBalance";
import { ProfileCompletion } from "./ProfileCompletion";
import type { Mode, Profile, User } from "@/lib/types";
import { MODE_LABEL, TAG_OPTIONS } from "@/lib/types";
import type { ProfileField } from "@/lib/profile-fields";
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
 *
 * 画面の作りは pictures/マイページ_仕事モード.png に合わせている。
 * 左に写真とポイントの札、右に番号付きの節を積んだカード、という2段組み。
 * 節の分け方は仕事モードだけデザイン案どおりに切ってあり、恋愛モードは
 * これまでどおり lib/profile-fields.ts の並びをそのまま出す。
 *
 * - 表示中のモード(仕事/恋愛)はアプリ全体で共有されている useSession().mode を使う。
 *   切り替えはヘッダーのモードスイッチが担当する（画面内には置かない）。
 * - 編集内容は下書き(draft)として持ち、「変更を保存」を押すまで確定しない。
 *   アイコンだけは選んだ時点で Storage に上がるが、users.avatar_url への
 *   反映は他の項目と同じく保存時にまとめて行う。
 * - 保存は lib/repository の updateUser / updateProfile を呼ぶ(Supabase保存)。
 *   保存後は session.refreshUser() でDBから読み直してローカルのcurrentUserも最新化する。
 */
export function MyPage() {
  const { currentUser, mode, loading, refreshUser } = useSession();
  const [draft, setDraft] = useState<User | null>(currentUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** 保存時に受け取れたポイント。0 なら何も出さない */
  const [awarded, setAwarded] = useState(0);

  // 隠しファイル入力を「写真を変更」ボタンから開くための参照
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // 受け取り済みの充実度の段。バーの目盛りに印を付けるのに使う。
  //
  // effect の中で同期的に setState すると React 19 の set-state-in-effect に
  // 触れるので、更新は .then() の中だけで行う。
  // 取得に失敗しても getClaimedMilestones が空を返すので、画面は印なしで動く。
  const [claimed, setClaimed] = useState<ClaimedMilestones>({
    work: [],
    romance: [],
  });
  const userId = currentUser?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getClaimedMilestones(userId).then((next) => {
      if (alive) setClaimed(next);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

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

  // バーの2層。ポイントの判定に使うのは保存済みのほうだけで、
  // 下書きのほうは「保存すればここまで伸びる」を見せるためにしか使わない。
  const savedCompletion = profileCompletion(currentUser ?? draft, mode);
  const draftCompletion = profileCompletion(draft, mode);

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
   * モード別の入力欄を key で1つ出す。
   *
   * ラベルや入力の種類は lib/profile-fields.ts が持っているので、
   * 画面側は「どの節にどの順で置くか」だけを決める。
   */
  const modeField = (key: string) => {
    const field = PROFILE_FIELDS[mode].find((f) => f.key === key);
    if (!field) return null;
    return (
      <ModeField
        key={key}
        field={field}
        profile={modeProfile}
        onChange={updateModeProfile}
      />
    );
  };

  /**
   * 写真が選ばれたら、その場で Storage に上げて下書きのURLを差し替える。
   *
   * アップロードだけ先に済ませておき、users.avatar_url への保存は
   * 他の項目と同じく「変更を保存」を押したときにまとめて行う。
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

  /** 編集を捨てて、保存済みの値に戻す */
  const handleCancel = () => {
    setDraft(currentUser);
    setError(null);
    setSaved(false);
    setAwarded(0);
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
    setAwarded(0);

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

      /*
        充実度の段に届いていたらポイントを受け取る。

        数えるのは「DBに送ったのと同じ内容」。下書きから数えると、
        保存していない入力でポイントが付いてしまう。trim した3項目だけ
        差し替えたものを渡す（updateUser に渡した値と揃える）。

        二度目が付かないことは DB 側の主キーが持っているので、
        画面は届いているかどうかだけを見て毎回呼んでよい。
      */
      const savedUser: User = {
        ...draft,
        name,
        department,
        departmentPath,
        jobTitle,
        university: draft.university.trim(),
      };
      const percent = profileCompletion(savedUser, mode).percent;

      let claimResult = { claimed: [] as number[], awarded: 0 };
      try {
        claimResult = await claimProfileMilestones(mode, percent);
      } catch (claimError) {
        // 受け取りに失敗しても保存は成功している。ここで例外を投げると
        // 「保存できたのにエラー表示」になるので、記録するだけにする。
        // 段の判定はDB側なので、次に保存したときに取りこぼしを回収できる。
        console.error("ポイントの受け取りに失敗しました", claimError);
      }
      if (claimResult.claimed.length > 0) {
        setClaimed((prev) => ({
          ...prev,
          [mode]: [...prev[mode], ...claimResult.claimed].sort((a, b) => a - b),
        }));
      }
      setAwarded(claimResult.awarded);

      // 残高と保存内容をまとめて読み直す。
      // ポイントを受け取ったあとに呼ぶので、サイドバーの残高も一度で揃う。
      await refreshUser();
      // 前後の空白を落とした値で保存したので、入力欄の表示も揃えておく
      setDraft((prev) =>
        prev ? { ...prev, name, department, departmentPath, jobTitle } : prev,
      );

      // 保存できたことを一時的に知らせる。3秒で自動的に消す。
      // ポイントの獲得も同じ枠に出すので、一緒に片付ける。
      setSaved(true);
      window.setTimeout(() => {
        setSaved(false);
        setAwarded(0);
      }, 3000);
    } catch (e) {
      setError("保存に失敗しました。もう一度お試しください。");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl text-[var(--foreground)]">
      {/*
        保存中は編集をまとめて止める。
        fieldset の disabled は中の input / textarea / button すべてに伝わるので、
        入力欄・スイッチ・タグ・写真の変更が一度に無効化される。
        保存ボタンだけを止めていたときは、通信中に編集できてしまい、
        保存後の refreshUser() でその編集が消えていた。
      */}
      <fieldset disabled={saving} className="m-0 border-0 p-0">
        <PageHeading
          title="マイページ"
          description="相手に表示されるプロフィールを編集できます。"
        />

        {/*
          左の札と右のカードの2段組み。
          狭い画面では1列に落として、札が上に来るようにする。
        */}
        <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
          {/* ── 左：写真とポイント ───────────────────────── */}
          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--soft-shadow)] lg:sticky lg:top-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-32 w-32 overflow-hidden rounded-full bg-[var(--accent)]">
                {draft.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.avatarUrl}
                    alt="プロフィール写真"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // 写真が無いときは頭文字を出す。空の丸より誰の欄か分かりやすい
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold tracking-wide text-white">
                    {initials(draft.name)}
                  </div>
                )}
              </div>

              <p className="mt-4 text-xl font-bold">{draft.name || "名前未設定"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {draft.department || "会社・部署未設定"}
              </p>

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
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-60"
              >
                <CameraIcon />
                {uploadingAvatar ? "アップロード中..." : "写真を変更"}
              </button>
              <p className="mt-2 text-xs text-[var(--muted)]">
                保存するまで反映されません
              </p>
            </div>

            <hr className="my-6 border-[var(--line)]" />

            {/* 充実度はモードごとに別々に数える。目盛りの印もモードごと */}
            <ProfileCompletion
              saved={savedCompletion}
              draft={draftCompletion}
              claimed={claimed[mode]}
            />

            <hr className="my-6 border-[var(--line)]" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">保有ポイント</span>
              <PointBalance className="text-[var(--accent)]" />
            </div>

            <hr className="my-6 border-[var(--line)]" />

            {/*
              参加スイッチ。プロフィールの中身ではなく「一覧に出るかどうか」の
              設定なので、節の中には入れず左の札に置いている。
              ここでは ToggleRow を使わない。カードの中に枠付きの箱を入れると
              二重の囲みになるので、上のポイント行と同じ見た目に揃える。
            */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">このモードに参加する</span>
                <Switch
                  checked={isParticipating}
                  onChange={toggleParticipate}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                OFFにすると{MODE_LABEL[mode]}モードの一覧に自分が出なくなります
              </p>
            </div>
          </aside>

          {/* ── 右：プロフィールの記入 ───────────────────── */}
          <div className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--soft-shadow)]">
            <Section
              number="01"
              title="基本情報"
              description="名前・所属・あなたのこと"
              scope="shared"
              mode={mode}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="名前">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateCommon("name", e.target.value)}
                    className={INPUT_CLASS}
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
                    className={INPUT_CLASS}
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
                  <Select
                    value={jobTitleInOptions ? draft.jobTitle : UNSET}
                    options={JOB_TITLE_OPTIONS}
                    onChange={(v) => updateCommon("jobTitle", v)}
                  />
                  {/* 選択肢に無い値が登録済みのときは、黙って消さずに知らせる */}
                  {!jobTitleInOptions && draft.jobTitle ? (
                    <p className="mt-1 text-xs text-[var(--accent-strong)]">
                      現在の登録は「{draft.jobTitle}
                      」です。選択肢に無いので選び直してください。
                    </p>
                  ) : null}
                </Field>

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

                {/* 会社・部署は選択欄が最大4段に増えるので、幅いっぱいを使う */}
                <div className="sm:col-span-2">
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
                  {/*
                    この節で唯一の例外。部署の「値」は users にあって共通だが、
                    「出すかどうか」は profiles にあってモードごとに持てる。
                    節の見出しは共通と出ているので、ここだけ印を付けて断る。
                  */}
                  <ToggleRow
                    className="mt-3"
                    title="会社・部署を表示する"
                    description="OFFにするとプロフィールから部署を隠します"
                    checked={modeProfile.showDepartment}
                    onChange={(v) => updateModeProfile({ showDepartment: v })}
                    badge={<ScopeBadge scope="mode" mode={mode} />}
                  />
                </div>
              </div>
            </Section>

            <Section
              number="02"
              title="自己紹介"
              description="あなたらしさが伝わる文章"
              scope="mode"
              mode={mode}
            >
              <Field label="自己紹介文">
                <textarea
                  value={modeProfile.bio}
                  onChange={(e) => updateModeProfile({ bio: e.target.value })}
                  rows={4}
                  className={INPUT_CLASS + " resize-none"}
                />
              </Field>
            </Section>

            <Section
              number="03"
              title="タグ"
              description="プロフィールに出る興味・スキル"
              scope="mode"
              mode={mode}
            >
              <TagPicker
                candidates={candidates}
                selected={modeProfile.tags}
                onChange={(tags) => updateModeProfile({ tags })}
              />
            </Section>

            {/*
              ここから先の節の切り方はモードで違う。
              仕事モードだけデザイン案どおりに 04〜06 へ分けている。
              恋愛モードは項目が14個あり分け方が未定なので、これまでどおり
              lib/profile-fields.ts の並びをひと続きで出す。
            */}
            {mode === "work" ? (
              <>
                <Section
                  number="04"
                  title="実績・資格"
                  description="これまで携わった仕事と、持っている資格"
                  scope="mode"
                  mode={mode}
                >
                  <div className="space-y-4">
                    {modeField("workAchievements")}
                    {modeField("certifications")}
                  </div>
                </Section>

                <Section
                  number="05"
                  title="話せること・相談したいこと"
                  description="声をかけてもらうきっかけになる項目"
                  scope="mode"
                  mode={mode}
                >
                  <div className="space-y-4">
                    {modeField("canTalkAbout")}
                    {modeField("wantToConsult")}
                  </div>
                </Section>

                <Section
                  number="06"
                  title="今後の興味"
                  description="これから関わってみたい領域"
                  scope="mode"
                  mode={mode}
                >
                  {modeField("interestedAreas")}
                </Section>
              </>
            ) : (
              <Section
                number="04"
                title="詳しいプロフィール"
                description="体型・休日・希望する相手など"
                scope="mode"
                mode={mode}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {PROFILE_FIELDS.romance.map((field) => (
                    <ModeField
                      key={field.key}
                      field={field}
                      profile={modeProfile}
                      onChange={updateModeProfile}
                    />
                  ))}
                </div>
              </Section>
            )}

            <div className="p-6">
              {error && (
                <p className="mb-4 text-sm text-[var(--accent-strong)]">
                  {error}
                </p>
              )}
              {saved && !error && (
                <p className="mb-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                  保存しました
                  {/*
                    残高はここでは増えない。届いたぶんは受け取り箱に入り、
                    ポイント画面で受け取ったときに増える。
                  */}
                  {awarded > 0 ? (
                    <span className="ml-2 font-bold">
                      ＋{awarded}ポイントを受け取り箱に届けました
                    </span>
                  ) : null}
                </p>
              )}

              <div className="flex items-center justify-end gap-3">
                {/*
                  アップロード中はどちらも押せなくする。
                  走っている fileToAvatarImage は止められず、終わった時点で
                  updateCommon("avatarUrl", url) が下書きを書き換えるため、
                  この間に確定させると結果がずれる。

                  キャンセル … 下書きを戻しても、あとから新しい写真が入り直す。
                  保存     … 古い avatarUrl を書いたあとで下書きだけ新しくなり、
                              選んだ写真が未保存のまま残る。
                */}
                {uploadingAvatar && (
                  <p className="text-xs text-[var(--muted)]">
                    写真のアップロード中は保存・キャンセルできません
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={uploadingAvatar}
                  className="rounded-lg border border-[var(--line)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={uploadingAvatar}
                  className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "保存中..." : "変更を保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}

/** 名前から丸の中に出す頭文字を作る。「佐藤 花」→「佐花」、「花子」→「花子」 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  // 絵文字やサロゲートペアで壊れないよう、コードポイント単位で切る
  const chars = (s: string) => Array.from(s);
  if (parts.length === 1) return chars(parts[0]).slice(0, 2).join("");
  return chars(parts[0])[0] + chars(parts[1])[0];
}

/**
 * その項目が両モードで共有されるのか、いま見ているモードだけのものか。
 *
 * users テーブルにある項目（名前・年齢・部署など）は1人に1つなので、
 * 仕事モードで直すと恋愛モードにも出る。profiles テーブルの項目は
 * モードごとに行が分かれているので、それぞれ別に持てる。
 * この違いは画面を見ただけでは分からないため、節ごとに明示する。
 */
type Scope = "shared" | "mode";

function ScopeBadge({
  scope,
  mode,
  className = "",
}: {
  scope: Scope;
  mode: Mode;
  className?: string;
}) {
  const shared = scope === "shared";
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-medium leading-none",
        shared
          ? "border-[var(--line)] text-[var(--muted)]"
          : "border-[var(--line)] bg-[var(--accent-soft)] text-[var(--accent-strong)]",
        className,
      ].join(" ")}
    >
      {/* 文字を読まなくても色で見分けられるように、小さな印を添える */}
      <span
        aria-hidden
        className={[
          "h-1.5 w-1.5 rounded-full",
          shared ? "bg-[var(--muted)]" : "bg-[var(--accent)]",
        ].join(" ")}
      />
      {shared ? "仕事・恋愛で共通" : `${MODE_LABEL[mode]}モードのみ`}
    </span>
  );
}

/** 番号付きの節。デザイン案の 01/02/03… の見出しにあたる */
function Section({
  number,
  title,
  description,
  scope,
  mode,
  children,
}: {
  number: string;
  title: string;
  description: string;
  scope: Scope;
  mode: Mode;
  children: React.ReactNode;
}) {
  return (
    <section className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">
          {number}
        </span>
        <div>
          <h2 className="text-base font-bold leading-tight">{title}</h2>
          <p className="text-xs text-[var(--muted)]">{description}</p>
        </div>
        <ScopeBadge scope={scope} mode={mode} className="ml-auto" />
      </div>
      {children}
    </section>
  );
}

/**
 * モード別の入力欄1つ。
 * 種類ごとの出し分けをここにまとめ、節を並べる側は key を渡すだけにする。
 */
function ModeField({
  field,
  profile,
  onChange,
}: {
  field: ProfileField;
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}) {
  return (
    <Field label={field.label}>
      {field.kind === "select" ? (
        <Select
          value={profile[field.key]}
          options={field.options}
          onChange={(v) => onChange({ [field.key]: v })}
        />
      ) : field.kind === "number" ? (
        <NumberSelect
          value={profile[field.key]}
          min={field.min}
          max={field.max}
          unit={field.unit}
          onChange={(v) => onChange({ [field.key]: v })}
        />
      ) : field.multiline ? (
        <textarea
          value={profile[field.key]}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
          rows={3}
          className={INPUT_CLASS + " resize-none"}
        />
      ) : (
        <TextInput
          value={profile[field.key]}
          onChange={(v) => onChange({ [field.key]: v })}
        />
      )}
    </Field>
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

/** 説明つきのスイッチ1行 */
function ToggleRow({
  title,
  description,
  checked,
  onChange,
  badge,
  className = "",
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** 節の見出しと適用範囲が違う行だけ、ここに ScopeBadge を渡す */
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] px-4 py-3",
        className,
      ].join(" ")}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {badge}
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
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

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
