"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fileToMessageImage, isImageBody } from "@/lib/image";
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
  onRead,
}: {
  open: boolean;
  /** 表示する相手。閉じるアニメーション中も中身を残したいので、閉じても null にしない */
  summary: MatchSummary | null;
  onClose: () => void;
  onSent: (created: Message) => void;
  /**
   * 実際に画面に出せたメッセージの、最後の createdAt を知らせる。
   * useCallback などで参照を固定して渡すこと（Conversation の取得処理の
   * 依存に入るので、毎回作り直すと取得が止まらなくなる）。
   */
  onRead: (matchId: string, readAt: string) => void;
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

          {/*
            key に matchId を渡しているので、相手を切り替えると React が
            Conversation を作り直す。書きかけの下書き・前の相手の吹き出し・
            エラー表示がまとめて消えるので、別の相手への誤送信が起きない。
            「値が変わったら state を全部リセットする」React の定石。
          */}
          <Conversation
            key={summary.match.id}
            matchId={summary.match.id}
            open={open}
            onSent={onSent}
            onRead={onRead}
          />
        </>
      ) : null}
    </section>
  );
}

/** 1つのマッチぶんの会話。state はすべてこの相手に紐づく */
function Conversation({
  matchId,
  open,
  onSent,
  onRead,
}: {
  matchId: string;
  open: boolean;
  onSent: (created: Message) => void;
  onRead: (matchId: string, readAt: string) => void;
}) {
  const { currentUser } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // 写真を選ぶための input。見た目はアイコンのボタンなので、本体は隠して click() で開く
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 取得が終わった時点で、まだ開いているかを見るために最新の open を覚えておく。
  // usePolling を止めても実行中の getMessages は止まらないので、
  // 開いてすぐ閉じると、その1往復ぶんの結果が後から届く。
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // usePolling が完了を待てるように Promise を返す
  const load = useCallback(() => {
    return getMessages(matchId)
      .then((list) => {
        setMessages(list);
        setLoaded(true);
        setError(null);

        // 既読にしてよいのは「実際に画面へ出せた」ぶんだけ。
        // 取得に失敗したときや、まだ取れていない相手のメッセージまで
        // 既読にしてしまうと、二度と未読として気づけなくなる。
        // 送信直後にここを呼ばないのも同じ理由で、次の取得を待って
        // 相手の新着ごと表示できてから既読にする。
        //
        // 取得中に閉じられていたら既読にしない。開いてすぐ閉じた場合、
        // 中身は画面外の inert なパネルに描かれるだけで読めていないため。
        const last = list[list.length - 1];
        if (last && openRef.current) onRead(matchId, last.createdAt);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "メッセージの取得に失敗しました。";
        setError(message);
        throw err;
      });
  }, [matchId, onRead]);

  useEffect(() => {
    void load();
  }, [load]);

  // 相手が送ったメッセージを拾う。閉じている間は叩かない
  usePolling(load, 3000, open);

  // 依存を messages ではなく件数にしている。
  // 配列そのものだと、ポーリングのたびに新しい配列が来て、
  // 過去を読み返している最中に一番下へ引き戻されてしまう。
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  /**
   * 送信の共通部分。本文が文章でも写真の data URL でも、
   * ここから先の扱いは同じ（messages に1行入れるだけ）。
   */
  const send = useCallback(
    async (body: string) => {
      if (!currentUser) return;
      const created = await sendMessage(matchId, currentUser.id, body);
      setMessages((prev) => [...prev, created]);
      onSent(created);
    },
    [currentUser, matchId, onSent],
  );

  const handleSend = useCallback(async () => {
    if (!currentUser || busy) return;

    const body = input.trim();
    if (!body) return;

    setBusy(true);
    setError(null);

    try {
      await send(body);
      setInput("");
      textareaRef.current?.focus();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "メッセージの送信に失敗しました。";
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [busy, currentUser, input, send]);

  /**
   * 選ばれた写真を送る。
   *
   * 縮小してから送るので、選んでから吹き出しが出るまで一拍ある。
   * その間 busy にしておき、二重送信と文章の送信を止める。
   */
  const handleSendImage = useCallback(
    async (file: File) => {
      if (!currentUser || busy) return;

      setBusy(true);
      setError(null);

      try {
        await send(await fileToMessageImage(file));
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "写真を送信できませんでした。";
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, currentUser, send],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {!loaded ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            読み込み中…
          </div>
        ) : messages.length === 0 ? (
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
                    {isImageBody(message.body) ? (
                      // 写真は吹き出しの枠を付けず、画像そのものを角丸で出す。
                      // 本文が data URL なので next/image は使えない（最適化の対象外）。
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.body}
                        alt="送信された写真"
                        className={[
                          "max-h-64 max-w-full rounded-2xl border border-line object-contain",
                          mine ? "ml-auto" : "",
                        ].join(" ")}
                      />
                    ) : (
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
                    )}
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
          {/*
            accept="image/*" にしておくと、スマホでは OS のシートに
            「写真を選ぶ」と「カメラで撮影」の両方が並ぶ。
          */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // 同じ写真をもう一度選んでも change が起きるよう、選択を空に戻しておく
              event.target.value = "";
              if (file) void handleSendImage(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label="写真を送る"
            title="写真を送る"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-background text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="M21 15.5 16.5 11 7 20.5" />
            </svg>
          </button>
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
  );
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
