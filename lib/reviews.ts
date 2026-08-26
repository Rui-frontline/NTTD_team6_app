// 口コミ（星5評価）の決まりごと。
//
// 型と定数をここに置いて、lib/types.ts は触らない。
// あちらは全員が参照する共有ファイルで、変更のたびに相談が要るため。

import type { Message } from "@/lib/types";

/**
 * 評価を求めるまでの往復回数。
 *
 * supabase/reviews.sql の submit_review にある c_threshold と同じ値にすること。
 * 片方だけ変えると、画面には評価が出るのに送信だけ弾かれる。
 * SQL 側を直したときは、Supabase で流し直すところまでやらないと反映されない。
 */
export const REVIEW_RALLY_THRESHOLD = 5;

/** 星の最大値 */
export const MAX_RATING = 5;

/**
 * 口コミ1件で受け取り箱に届くポイント。
 *
 * supabase/reviews.sql の submit_review にある c_reward と同じ値にすること。
 * 実際に配るのは DB 側で、ここの値は画面に出す案内にしか使わない。
 * ずれていると「50ポイント」と書いてあるのに違う額が届く。
 */
export const REVIEW_REWARD_POINTS = 50;

/**
 * ある人の、あるモードでの評価。
 *
 * まだ1件も付いていないときは average が null になる。
 * 0 ではなく null なのは、「評価なし」と「星0」を区別するため
 * （星0 は付けられないので、0 が出たらそれは未評価の誤表示）。
 */
export type Rating = {
  average: number | null;
  total: number;
};

export const NO_RATING: Rating = { average: null, total: 0 };

/**
 * 何往復したか。
 *
 * 合計の通数ではなく「少ない側」で数える。合計だと片方が10連投した時点で
 * 達してしまい、相手が一度も返していない会話にまで評価を求めることになる。
 *
 * 数え方は supabase/reviews.sql の submit_review と同じ。あちらが本番の
 * 判定で、こちらは表示を出すかどうかの判断に使う。
 */
export function rallyCount(messages: Message[], meId: string): number {
  let mine = 0;
  let theirs = 0;
  for (const message of messages) {
    if (message.senderId === meId) mine += 1;
    else theirs += 1;
  }
  return Math.min(mine, theirs);
}
