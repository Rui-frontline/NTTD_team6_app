"use client";

import type { MatchSummary } from "@/lib/types";

/**
 * 右からスライドインしてくるトークパネル。
 *
 * 大事なのは「開いていないときも DOM に置いたままにする」こと。
 * 条件レンダリング（open ? <section/> : null）にすると、
 * 出るときも消えるときも一瞬で切り替わり、CSS のトランジションが走らない。
 * ここでは常に描画しておいて、translate-x だけを切り替えている。
 */
export function TalkPanel({
  open,
  summary,
  onClose,
}: {
  open: boolean;
  /** 表示する相手。閉じるアニメーション中も中身を残したいので、閉じても null にしない */
  summary: MatchSummary | null;
  onClose: () => void;
}) {
  return (
    <section
      // 閉じている間は中身を丸ごと無効化する。
      // aria-hidden は支援技術から隠すだけ、pointer-events-none はマウスを止めるだけで、
      // どちらも Tab キーでの移動を止められない（画面外のボタンにフォーカスが当たってしまう）。
      // inert なら子孫すべてがフォーカス対象から外れ、閉じた瞬間にフォーカスも外れる。
      inert={!open}
      aria-hidden={!open}
      aria-label="トーク"
      className={[
        "absolute inset-0 flex flex-col bg-surface transition-transform duration-300 ease-out",
        // 閉じているときは画面の外（右）へ逃がす。
        // pointer-events-none が無いと、見えていないパネルが右側のクリックを吸ってしまう。
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      ].join(" ")}
    >
      {summary ? (
        <>
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            {/* ダミー画像なので next/image ではなく img を使う */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={summary.partner.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full bg-accent-soft"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              {summary.partner.name}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="トークを閉じる"
              className="rounded-full px-2 py-1 text-lg leading-none text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              ×
            </button>
          </header>

          {/* ここに次のステップで吹き出しと入力欄を作る */}
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            メッセージはこの先のステップで作ります
          </div>
        </>
      ) : null}
    </section>
  );
}
