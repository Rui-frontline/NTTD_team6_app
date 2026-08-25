"use client";

import { useEffect, useState } from "react";
import { getUserRating } from "@/lib/repository";
import { NO_RATING } from "@/lib/reviews";
import type { Rating } from "@/lib/reviews";
import type { Mode } from "@/lib/types";
import { StarRating } from "@/components/reviews/StarRating";

/**
 * ある人の平均評価を、星と数字で出す。
 *
 * 自分で取得まで行う部品にしている。プロフィール詳細のモーダルが2つある
 * （components/profile/ProfileDetailModal.tsx と app/discover/page.tsx）ので、
 * 呼ぶ側に取得を書かせると同じ処理が2箇所に増える。
 *
 * 1人ぶんの表示専用。一覧の各行に置くと人数ぶん問い合わせが飛ぶので、
 * そういう使い方をするときはまとめて引く形に作り直すこと。
 */
export function UserRating({
  userId,
  mode,
  size = 16,
}: {
  userId: string;
  mode: Mode;
  size?: number;
}) {
  const [rating, setRating] = useState<Rating | null>(null);

  useEffect(() => {
    // 取得中に別の人へ切り替わったとき、古い結果を捨てる
    let alive = true;

    getUserRating(userId, mode)
      .then((result) => {
        if (alive) setRating(result);
      })
      .catch(() => {
        /*
          supabase/reviews.sql を流していない環境ではここに来る。
          プロフィール全体を巻き添えにする理由は無いので、
          「評価なし」と同じ扱いにして星の欄ごと出さない。
        */
        if (alive) setRating(NO_RATING);
      });

    return () => {
      alive = false;
    };
  }, [userId, mode]);

  // 取得前と0件は何も出さない。
  // 「★0.0」と出すと、評価が無いだけなのに低評価に見える
  if (!rating || rating.total === 0 || rating.average === null) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 align-middle"
      title={`${rating.total}件の評価の平均`}
    >
      <StarRating value={rating.average} size={size} />
      <span className="text-sm font-bold text-[var(--foreground)]">
        {rating.average.toFixed(1)}
      </span>
      <span className="text-xs text-[var(--muted)]">({rating.total})</span>
    </span>
  );
}
