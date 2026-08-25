"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fileToMessageImage, isImageBody } from "@/lib/image";
import {
  blockUser,
  getMessages,
  hasReviewedMatch,
  sendMessage,
} from "@/lib/repository";
import { REVIEW_RALLY_THRESHOLD, rallyCount } from "@/lib/reviews";
import { useSession } from "@/lib/session";
import { usePolling } from "@/lib/usePolling";
import { ProfileDetailModal } from "@/components/profile/ProfileDetailModal";
import { ReviewPrompt } from "@/components/reviews/ReviewPrompt";
import type { MatchSummary, Message, Mode } from "@/lib/types";

/**
 * 右からスライドインしてくるトークパネル。
 *
 * 大事なのは「開いていないときも DOM に置いたままにする」こと。
 * 条件レンダリング（open ? <section/> : null）にすると、
 * 出るときも消えるときも一瞬で切り替わり、CSS のトランジションが走らない。
 * ここでは常に描画しておいて、translate-x だけを切り替えている。
 */
export function TalkPanel({
  mode,
  open,
  summary,
  onClose,
  onSent,
  onRead,
  onBlocked,
}: {
  mode: Mode;
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
  /** ブロックが成立したことを知らせる。一覧からこのマッチを消すのは親の仕事 */
  onBlocked: (matchId: string) => void;
}) {
  const isWork = mode === "work";
  const { currentUser } = useSession();

  // 確認ダイアログを出している対象の match id。null なら出していない。
  // 「開いているか」と「誰に対してか」を1つの state にまとめておくと、
  // 相手が入れ替わったときの取り消しを1か所で書ける。
  const [confirmingMatchId, setConfirmingMatchId] = useState<string | null>(
    null,
  );
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  /** 相手のプロフィールを開いているか。ヘッダーの名前から開く */
  const [showProfile, setShowProfile] = useState(false);

  // 相手が変わったり、パネルが閉じたりしたら確認を取り消す。
  // 出しっぱなしにすると、次に開いた別の相手にそのまま適用されかねない。
  // effect ではなくレンダー中に調整するのは、このファイルの他の箇所と同じ理由。
  if (
    confirmingMatchId !== null &&
    (!open || confirmingMatchId !== summary?.match.id)
  ) {
    setConfirmingMatchId(null);
    setBlockError(null);
  }

  const handleBlock = useCallback(async () => {
    if (!currentUser || !summary || blocking) return;

    setBlocking(true);
    setBlockError(null);

    try {
      await blockUser(currentUser.id, summary.partner.id, mode);
      setConfirmingMatchId(null);
      onBlocked(summary.match.id);
    } catch (err: unknown) {
      setBlockError(blockErrorMessage(err));
    } finally {
      setBlocking(false);
    }
  }, [blocking, currentUser, mode, onBlocked, summary]);

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
          <header
            className={
              isWork
                ? "flex items-center gap-3 border-b border-[#EAE6DF] bg-[rgba(255,253,252,0.9)] px-5 py-3.5"
                : "flex items-center gap-3 border-b border-line px-4 py-3"
            }
          >
            {/*
              アイコンと名前だけをボタンにして、プロフィールを開く。
              ヘッダー全体を押せるようにすると、右のブロックボタンまで
              巻き込んでしまう。
            */}
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              title={`${summary.partner.name}さんのプロフィールを見る`}
              className={[
                "flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors",
                isWork
                  ? "px-1 py-0.5 hover:bg-[rgba(12,35,64,0.04)]"
                  : "px-1 py-0.5 hover:bg-background",
              ].join(" ")}
            >
              {/* ダミー画像なので next/image ではなく img を使う */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={summary.partner.avatarUrl}
                alt=""
                width={32}
                height={32}
                className={
                  isWork
                    ? "h-9 w-9 shrink-0 rounded-full border border-[rgba(201,169,110,0.32)] bg-[#EEF1F6] object-cover p-0.5"
                    : "h-8 w-8 shrink-0 rounded-full bg-accent-soft"
                }
              />
              <span
                className={
                  isWork
                    ? "min-w-0 flex-1 truncate text-base font-semibold text-[#0C2340]"
                    : "min-w-0 flex-1 truncate text-sm font-bold"
                }
              >
                {summary.partner.name}
              </span>
            </button>

            {/*
              ブロックは恋愛モードだけ。仕事モードでは相手が同僚なので、
              業務の連絡経路を個人の判断で断てるようにはしない。
            */}
            {mode === "romance" ? (
              <button
                type="button"
                onClick={() => setConfirmingMatchId(summary.match.id)}
                aria-label={`${summary.partner.name}さんをブロックする`}
                title="ブロック"
                className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-background hover:text-accent"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="m5.64 5.64 12.72 12.72" />
                </svg>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              aria-label="トークを閉じる"
              className={
                isWork
                  ? "flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-muted transition-colors hover:bg-[#F4F1EB] hover:text-[#0C2340]"
                  : "rounded-full px-2 py-1 text-lg leading-none text-muted transition-colors hover:bg-background hover:text-foreground"
              }
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
            mode={mode}
            matchId={summary.match.id}
            partnerName={summary.partner.name}
            open={open}
            onSent={onSent}
            onRead={onRead}
          />

          {/* 確認ダイアログ。パネルの中だけを覆うので、左の一覧は見えたまま */}
          {confirmingMatchId !== null ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-6">
              <div
                role="dialog"
                aria-modal="true"
                aria-label="ブロックの確認"
                className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5 shadow-lg"
              >
                <p className="text-center text-sm font-bold">
                  {summary.partner.name}さんをブロックしますか？
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  ブロックすると、この会話はトーク一覧から消え、探す画面にも表示されなくなります。
                  相手に通知はされません。
                </p>

                {blockError ? (
                  <p className="mt-3 text-xs text-accent">{blockError}</p>
                ) : null}

                {/*
                  取り消し（NO）を左、実行（YES）を右に置いている。
                  消えたら戻せない操作なので、押し慣れた位置に YES を置かない。
                */}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingMatchId(null)}
                    disabled={blocking}
                    className="flex-1 rounded-xl border border-line px-3 py-2 text-sm font-bold transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    NO
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleBlock();
                    }}
                    disabled={blocking}
                    className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {blocking ? "処理中" : "YES"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/*
            プロフィールは fixed で画面全体に出す。パネルの中に閉じ込めると
            スライドインの枠に収まってしまい、内容が読みにくい。
          */}
          {showProfile ? (
            <ProfileDetailModal
              user={summary.partner}
              mode={mode}
              onClose={() => setShowProfile(false)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/**
 * ブロックに失敗したときに画面へ出す文言。
 *
 * 「ブロックできませんでした」とだけ出すと、原因が分からず手が止まる。
 * 実際いちばん多いのは supabase/blocks.sql の実行忘れなので、
 * そのときは推測ではなく、やることをそのまま書く。
 */
function blockErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";

  // PGRST205: PostgREST がテーブルを見つけられない
  // 42P01:    PostgreSQL の relation does not exist
  if (code === "PGRST205" || code === "42P01") {
    return "ブロックの保存先がまだありません。Supabase の SQL Editor で supabase/blocks.sql を実行してください。";
  }

  // 42501: RLS で弾かれた。ポリシーか、ログインしているユーザーがずれている
  if (code === "42501") {
    return "ブロックの権限がありません。supabase/blocks.sql のポリシーを確認してください。";
  }

  if (err instanceof Error && err.message) return err.message;
  return "ブロックできませんでした。";
}

/** 1つのマッチぶんの会話。state はすべてこの相手に紐づく */
function Conversation({
  mode,
  matchId,
  partnerName,
  open,
  onSent,
  onRead,
}: {
  mode: Mode;
  matchId: string;
  /** 評価モーダルの文面に出す相手の名前 */
  partnerName: string;
  open: boolean;
  onSent: (created: Message) => void;
  onRead: (matchId: string, readAt: string) => void;
}) {
  const { currentUser } = useSession();
  const isWork = mode === "work";
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * この会話にもう星をつけたか。null は「まだ調べていない」。
   * 調べ終わるまで評価モーダルを出さないので、既に評価した相手に
   * 一瞬だけ出てしまうことがない。
   */
  const [reviewed, setReviewed] = useState<boolean | null>(null);
  /** 「あとで」を押したか。開いている間だけ有効で、開き直すとまた出る */
  const [skippedReview, setSkippedReview] = useState(false);
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

  // 評価済みかを1回だけ調べる。この部品は match ごとに key を分けているので、
  // 相手が変わればマウントし直され、ここも引き直される。
  useEffect(() => {
    let alive = true;
    hasReviewedMatch(matchId)
      .then((result) => {
        if (alive) setReviewed(result);
      })
      .catch(() => {
        // supabase/reviews.sql を流していない環境ではここに来る。
        // 「評価済み」扱いにしてモーダルを出さない。出したところで
        // 送信も失敗するので、会話の邪魔にしかならない。
        if (alive) setReviewed(true);
      });
    return () => {
      alive = false;
    };
  }, [matchId]);

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
   * 縮小して Storage に上げてから送るので、選んでから吹き出しが出るまで一拍ある。
   * その間 busy にしておき、二重送信と文章の送信を止める。
   */
  const handleSendImage = useCallback(
    async (file: File) => {
      if (!currentUser || busy) return;

      setBusy(true);
      setError(null);

      try {
        await send(await fileToMessageImage(matchId, file));
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "写真を送信できませんでした。";
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, currentUser, matchId, send],
  );

  /*
    評価を求めるかどうか。

    パネルは閉じていても DOM に残るので、open を見ないと、閉じた会話の
    ぶんまで画面全体を覆うモーダルが出てしまう。

    reviewed が null（調べている最中）の間は出さない。先に出してしまうと、
    評価済みの相手にも一瞬だけ表示される。
  */
  const askReview =
    open &&
    loaded &&
    reviewed === false &&
    !skippedReview &&
    currentUser !== null &&
    rallyCount(messages, currentUser.id) >= REVIEW_RALLY_THRESHOLD;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className={
          isWork
            ? "flex-1 overflow-y-auto bg-[rgba(248,245,239,0.34)] px-4 py-5"
            : "flex-1 overflow-y-auto px-3 py-3"
        }
      >
        {!loaded ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            読み込み中…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            まだメッセージはありません。
          </div>
        ) : (
          <div className={isWork ? "flex flex-col gap-3" : "flex flex-col gap-2"}>
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
                      // 本文は Storage の URL（古いものは data URL）で、どちらも
                      // next/image の設定対象外なので img をそのまま使う。
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
                          isWork
                            ? "max-w-full rounded-[16px] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                            : "max-w-full rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                          mine
                            ? isWork
                              ? "ml-auto bg-[#0C2340] text-white shadow-[0_5px_14px_rgba(12,35,64,0.12)]"
                              : "ml-auto bg-accent text-white"
                            : isWork
                              ? "border border-[#EAE6DF] bg-[#FFFDFC] text-[#0C2340]"
                              : "bg-[var(--bubble-other-bg)] border border-line",
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

      <div
        className={
          isWork
            ? "border-t border-[#EAE6DF] bg-[#FFFDFC]"
            : "border-t border-line bg-surface"
        }
      >
        {error ? (
          <p className="px-3 pb-2 pt-3 text-xs text-accent">{error}</p>
        ) : null}

        {/*
          送信の直前に必ず目に入るよう、入力欄のすぐ上に置いている。
          常時出したままにするので、本文より一段小さく・薄くして邪魔をしない。
        */}
        <p className="px-3 pt-3 text-[11px] leading-relaxed text-muted">
          健全なサービスを運営する目的で運営者がメッセージの内容を確認・削除することがあります。相手への配慮あるやり取りをお願いいたします。これに同意した上で送信してください。
        </p>

        <div
          className={
            isWork
              ? "flex items-end gap-2 px-4 pb-4 pt-2"
              : "flex items-end gap-2 px-3 pb-3 pt-2"
          }
        >
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
            className={
              isWork
                ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#DED9D0] bg-[#FBFAF7] text-muted transition-colors hover:border-[#0C2340] hover:text-[#0C2340] disabled:cursor-not-allowed disabled:opacity-50"
                : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            }
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
            className={
              isWork
                ? "max-h-32 min-h-11 flex-1 resize-none rounded-[14px] border border-[#DED9D0] bg-[#FBFAF7] px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-[#0C2340] focus:shadow-[0_0_0_3px_rgba(12,35,64,0.05)]"
                : "max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
            }
          />
          <button
            type="button"
            onClick={() => {
              void handleSend();
            }}
            disabled={busy || input.trim() === ""}
            className={
              isWork
                ? "min-h-11 rounded-[14px] bg-[#0C2340] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(12,35,64,0.18)] transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(12,35,64,0.22)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                : "rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {busy ? "送信中" : "送信"}
          </button>
        </div>
      </div>

      {askReview ? (
        <ReviewPrompt
          matchId={matchId}
          partnerName={partnerName}
          onDone={() => setReviewed(true)}
          onSkip={() => setSkippedReview(true)}
        />
      ) : null}
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
