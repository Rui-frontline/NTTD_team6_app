"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMessages, sendMessage } from "@/lib/repository";
import { useSession } from "@/lib/session";
import { usePolling } from "@/lib/usePolling";
import type { MatchSummary, Message } from "@/lib/types";

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
  onSent,
}: {
  open: boolean;
  /** 表示する相手。閉じるアニメーション中も中身を残したいので、閉じても null にしない */
  summary: MatchSummary | null;
  onClose: () => void;
  onSent: (created: Message) => void;
}) {
  const { currentUser } = useSession();
  const matchId = summary?.match.id ?? null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(() => {
    if (!matchId) return Promise.resolve();
    return getMessages(matchId)
      .then((list) => {
        setMessages(list);
        setError(null);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "メッセージの取得に失敗しました。";
        setError(message);
        throw err;
      });
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(load, 3000, open && matchId !== null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!matchId || !currentUser || busy) return;

    const body = input.trim();
    if (!body) return;

    setBusy(true);
    setError(null);

    try {
      const created = await sendMessage(matchId, currentUser.id, body);
      setMessages((prev) => [...prev, created]);
      onSent(created);
      setInput("");
      textareaRef.current?.focus();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "メッセージの送信に失敗しました。";
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [busy, currentUser, input, matchId, onSent]);

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

          <div className="flex flex-1 flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  まだメッセージはありません。
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((message) => {
                    const mine = message.senderId === currentUser?.id;
                    return (
                      <div
                        key={message.id}
                        className={[
                          "flex w-full",
                          mine ? "justify-end" : "justify-start",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "flex max-w-[70%] items-end gap-2",
                            mine ? "flex-row-reverse" : "",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "max-w-full rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                              mine
                                ? "ml-auto bg-accent text-white"
                                : "bg-background border border-line",
                            ].join(" ")}
                          >
                            {message.body}
                          </div>
                          <time className="shrink-0 text-[11px] text-muted">
                            {formatBubbleTime(message.createdAt)}
                          </time>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-line bg-surface">
              {error ? (
                <p className="px-3 pb-2 pt-3 text-xs text-accent">{error}</p>
              ) : null}
              <div className="flex items-end gap-2 p-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="メッセージを入力"
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleSend();
                  }}
                  disabled={busy || input.trim() === ""}
                  className="rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "送信中" : "送信"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
