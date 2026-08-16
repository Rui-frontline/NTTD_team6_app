"use client";

import { useEffect, useRef } from "react";

/**
 * 一定間隔で関数を呼び続ける。
 *
 * リアルタイム更新は仕様のスコープ外なので、代わりにこれで新着を拾う。
 * デモで2画面を並べたとき、リロードしなくても相手の送信が反映される。
 *
 * 使う側の例:
 *   usePolling(() => void load(), 5000, userId !== null);
 *
 * Supabase Realtime に差し替えたくなったら、この hook を呼んでいる箇所を
 * 購読関数に置き換えるだけでよい（画面の他の部分は変わらない）。
 */
export function usePolling(
  callback: () => void,
  intervalMs: number,
  enabled = true,
) {
  const latest = useRef(callback);

  // 描画のたびに最新の関数を覚え直す。
  // これをしないと、setInterval が古い state を掴んだままの関数を呼び続ける。
  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      // 別のタブを見ている間は問い合わせない
      if (document.visibilityState !== "visible") return;
      latest.current();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, enabled]);
}
