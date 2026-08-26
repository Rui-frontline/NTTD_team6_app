"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { submitReview } from "@/lib/repository";
import { MAX_RATING, REVIEW_REWARD_POINTS } from "@/lib/reviews";
import { StarIcon } from "@/components/reviews/StarRating";

/**
 * 十分に会話した相手への評価を求めるモーダル。
 *
 * 往復10回に達したトークで、まだ評価していないときに出る。
 * 星だけを受け取り、コメントは持たない。
 *
 * 「あとで」を押しても記録は残さない。会話を開き直すとまた出る。
 * 却下を DB に残すには列を足すことになるうえ、評価する導線がここしか
 * 無いので、完全に消すと二度と付けられなくなる。
 */
export function ReviewPrompt({
  matchId,
  partnerName,
  onDone,
  onSkip,
}: {
  matchId: string;
  partnerName: string;
  /** 送信できたとき。呼ぶ側で「評価済み」にする */
  onDone: () => void;
  /** あとでにしたとき */
  onSkip: () => void;
}) {
  const [rating, setRating] = useState(0);
  // マウスを乗せている星。押す前に何点になるか分かるようにする
  const [hovered, setHovered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  // 開いた直後のフォーカスを中へ移す。背後のボタンに残っていると
  // キーボードでモーダルの外を操作できてしまう
  useEffect(() => {
    skipRef.current?.focus();
  }, []);

  // Esc は「あとで」と同じ扱い。送信は明示的に押させる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const handleSubmit = async () => {
    if (rating < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitReview(matchId, rating);
      onDone();
    } catch (err: unknown) {
      setError(reviewErrorMessage(err));
      setBusy(false);
    }
  };

  /*
    描画先を document.body に移す。

    トークパネルは translate-x でスライドさせている。transform を持つ祖先が
    あると position: fixed はビューポートではなくその要素を基準にするため、
    そのまま置くとモーダルがパネルの中に閉じ込められる。
  */
  if (typeof document === "undefined") return null;

  // 選択中と、マウスを乗せている星。乗せている間はそちらを優先して見せる
  const shown = hovered || rating;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${partnerName}さんの評価`}
        className="w-full max-w-sm rounded-3xl bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-[var(--card-shadow)]"
      >
        <p className="text-center text-base font-bold">
          {partnerName}さんとの会話はいかがでしたか？
        </p>
        {/*
          「相手には分かりません」とは書かない。個別の行は見せないが、
          評価がまだ少ないうちは平均から点数を逆算できてしまう。
          仕組みとして守れないことを約束しない。
        */}
        <p className="mt-2 text-center text-xs leading-relaxed text-[var(--muted)]">
          個別の点数は表示されません。プロフィールに平均だけが出ます。
        </p>

        {/*
          もらえることを押す前に見せる。押したあとに知らせても、
          評価をつける動機にはならない。
          実際に配るのは DB 側なので、ここは案内でしかない
        */}
        <p className="mt-3 text-center text-sm font-bold text-[var(--accent-strong)]">
          投稿すると {REVIEW_REWARD_POINTS}ポイント
        </p>

        <div
          className="mt-5 flex justify-center gap-1"
          onMouseLeave={() => setHovered(0)}
        >
          {Array.from({ length: MAX_RATING }, (_, i) => {
            const value = i + 1;
            return (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHovered(value)}
                aria-label={`星${value}`}
                aria-pressed={rating === value}
                className="rounded-lg p-1 transition-transform hover:scale-110 disabled:cursor-not-allowed"
              >
                <StarIcon size={36} filled={value <= shown ? 1 : 0} />
              </button>
            );
          })}
        </div>

        {/* 高さを固定して、選ぶたびに下のボタンが動かないようにする */}
        <p className="mt-2 h-5 text-center text-sm font-bold">
          {rating > 0 ? `星${rating}` : ""}
        </p>

        {error ? (
          <p className="mt-2 text-center text-xs leading-relaxed text-[var(--accent)]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            ref={skipRef}
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold transition-colors hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            あとで
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={rating < 1 || busy}
            className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "送信中" : "送信"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 送信に失敗したときに画面へ出す文言。
 *
 * 「送信できませんでした」だけだと原因が分からず手が止まる。
 * 実際いちばん多いのは supabase/reviews.sql の実行忘れなので、
 * そのときは推測ではなく、やることをそのまま書く。
 * components/TalkPanel.tsx の blockErrorMessage と同じ考え方。
 */
function reviewErrorMessage(err: unknown): string {
  const code = fieldOf(err, "code");
  const message = fieldOf(err, "message");

  // PGRST202: PostgREST が関数を見つけられない
  // 42883:    PostgreSQL の function does not exist
  if (code === "PGRST202" || code === "42883") {
    return "評価の保存先がまだありません。Supabase の SQL Editor で supabase/reviews.sql を実行してください。";
  }

  // P0001: 関数の中の raise exception。往復数が足りないなど、理由が文面に入っている。
  // 画面と DB でしきい値がずれていると、モーダルは出るのにここで弾かれる。
  if (code === "P0001" && message) {
    return `${message}（supabase/reviews.sql を流し直すと直ることがあります）`;
  }

  if (message) return message;
  return "評価を送信できませんでした。";
}

/**
 * エラーオブジェクトから文字列の項目を取り出す。
 *
 * Supabase が返すエラーは Error のインスタンスではなく、ただのオブジェクト。
 * `err instanceof Error` で判定すると常に false になり、本当の理由を
 * 握りつぶして汎用の文言しか出せなくなる。
 */
function fieldOf(err: unknown, key: string): string {
  if (err instanceof Error && key === "message") return err.message;
  if (typeof err !== "object" || err === null || !(key in err)) return "";
  const value = (err as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
