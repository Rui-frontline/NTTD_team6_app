"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Mode, Profile, User } from "@/lib/types";
import { MODE_LABEL } from "@/lib/types";
import { PROFILE_FIELDS, USER_FIELDS } from "@/lib/profile-fields";
import type { ProfileField } from "@/lib/profile-fields";
import { UserRating } from "@/components/reviews/UserRating";

/**
 * 相手のプロフィールを見るモーダル。
 *
 * トーク画面と履歴画面から、相手の名前を押して開く。
 * 表示専用で、いいね・ブロックなどの操作は持たない。開いた画面ごとに
 * できることが違うので、操作は呼ぶ側に任せる。
 *
 * 並べる項目は lib/profile-fields.ts をそのまま回す。ラベルも入力の種類も
 * あちらが持っているので、マイページに項目を足せばここにも自動で出る。
 *
 * 探す画面にも似たモーダルがあるが、そちらはまだ差し替えていない。
 * app/discover/page.tsx を別のPRが大きく書き換えている最中で、同じ範囲を
 * 触ると競合するため。あちらがマージされたら、この部品に寄せること。
 */
export function ProfileDetailModal({
  user,
  mode,
  onClose,
}: {
  user: User;
  mode: Mode;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const profile = user[mode];

  // Esc で閉じられるようにする。開いたまま操作が詰まらないため
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 開いた直後にフォーカスを中へ移す。背後のボタンに残っていると
  // キーボードでモーダルの外を操作できてしまう
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /*
    部署を出すかどうかは、いまのアプリ全体の挙動に合わせて
    「恋愛モードのときだけ showDepartment を見る」にしている。
    仕事モードでも尊重すべきかは、この画面だけで決める話ではないので触らない。
  */
  const showDepartment = !(mode === "romance" && !user.romance.showDepartment);

  /*
    描画先を document.body に移す。

    トークパネルは translate-x でスライドさせている。transform を持つ祖先が
    あると position: fixed はビューポートではなくその要素を基準にするため、
    そのまま置くとモーダルがパネルの中に閉じ込められる。トーク画面の外枠には
    overflow-hidden もあるので、はみ出したぶんは切り取られる。

    body 直下に出せば、どの画面から呼んでも同じ位置・同じ大きさで開く。
    サーバー側では開いた状態で描かれることがないので、document が無い間は
    何も出さないでよい。
  */
  if (typeof document === "undefined") return null;

  // 入力されている項目だけを集める。空欄は出さない
  const filled = [
    ...USER_FIELDS.filter((f) => user[f.key].trim() !== "").map((f) => ({
      label: f.label,
      value: user[f.key],
      multiline: false,
    })),
    ...PROFILE_FIELDS[mode]
      .filter((f) => hasValue(f, profile))
      .map((f) => ({
        label: f.label,
        value: formatValue(f, profile),
        multiline: f.kind === "text" && f.multiline === true,
      })),
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${user.name}さんのプロフィール`}
        // 中をクリックしても閉じないよう、背景への伝播を止める
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--card-shadow)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <p className="text-sm font-bold">
            プロフィール
            <span className="ml-2 text-xs font-medium text-[var(--muted)]">
              {MODE_LABEL[mode]}モード
            </span>
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-full bg-[var(--accent-soft)] px-4 py-1.5 text-sm text-[var(--accent-strong)] transition-opacity hover:opacity-80"
          >
            閉じる
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* 写真と基本情報。狭い画面では縦に落とす */}
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="w-full shrink-0 sm:w-56">
              {/* ダミー画像なので next/image ではなく img を使う */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="aspect-[3/4] w-full rounded-2xl bg-[var(--accent-soft)] object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              {/*
                名前と口コミの平均。評価が0件なら UserRating 側が何も出さないので、
                ここは名前だけが並ぶ形になる
              */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-2xl font-bold">{user.name}</h2>
                <UserRating userId={user.id} mode={mode} />
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {showDepartment ? `${user.department} / ` : ""}
                {user.jobTitle}
              </p>
              {mode === "romance" ? (
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {user.age}歳
                </p>
              ) : null}

              {profile.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--accent-soft)] px-3.5 py-1.5 text-sm text-[var(--accent-strong)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {profile.bio.trim() !== "" ? (
                <div className="mt-5">
                  <p className="text-xs font-bold text-[var(--muted)]">
                    自己紹介
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                    {profile.bio}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* マイページで入力する項目。入っているものだけ並べる */}
          {filled.length > 0 ? (
            <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
              {filled.map((item) => (
                <div
                  key={item.label}
                  // 長文は幅いっぱいを使う。2列に押し込むと読みにくい
                  className={item.multiline ? "sm:col-span-2" : undefined}
                >
                  <dt className="text-xs font-bold text-[var(--muted)]">
                    {item.label}
                  </dt>
                  <dd
                    className={[
                      "mt-1 text-sm",
                      item.multiline ? "whitespace-pre-wrap leading-relaxed" : "",
                    ].join(" ")}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-6 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
              まだ詳しいプロフィールは登録されていません。
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 入力されているか。数値は 0 と未設定を区別するため null で見る */
function hasValue(field: ProfileField, profile: Profile): boolean {
  if (field.kind === "number") return profile[field.key] !== null;
  return profile[field.key].trim() !== "";
}

/** 表示用の文字列。数値だけ単位を添える（170 → 170cm） */
function formatValue(field: ProfileField, profile: Profile): string {
  if (field.kind === "number") return `${profile[field.key]}${field.unit}`;
  return profile[field.key];
}
