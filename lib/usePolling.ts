"use client";

import { useEffect, useRef } from "react";

/**
 * 一定間隔で関数を呼び続ける。
 *
 * リアルタイム更新は仕様のスコープ外なので、代わりにこれで新着を拾う。
 * デモで2画面を並べたとき、リロードしなくても相手の送信が反映される。
 *
 * 使う側の例:
 *   usePolling(load, 5000, userId !== null);
 *
 * callback が Promise を返す場合は、**その完了を待ってから**次の待ち時間を数える。
 * setInterval だと、取得が間隔より遅い環境でリクエストが重なり続け、
 * 新しい問い合わせが古い問い合わせを追い越して結果が捨てられてしまう。
 * ここでは前回が終わってから次を予約するので、重なりが起きない。
 *
 * Supabase Realtime に差し替えたくなったら、この hook を呼んでいる箇所を
 * 購読関数に置き換えるだけでよい（画面の他の部分は変わらない）。
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const latest = useRef(callback);

  // 描画のたびに最新の関数を覚え直す。
  // これをしないと、タイマーが古い state を掴んだままの関数を呼び続ける。
  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      // 別のタブを見ている間は問い合わせない
      if (document.visibilityState === "visible") {
        try {
          await latest.current();
        } catch {
          // エラーの扱いは呼び出し側の責任。ここで止まらないようにするだけ
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    timer = setTimeout(tick, intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [intervalMs, enabled]);
}
