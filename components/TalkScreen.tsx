"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchList } from "@/components/MatchList";
import { TalkPanel } from "@/components/TalkPanel";
import { getMatches, markMatchRead } from "@/lib/repository";
import { useSession } from "@/lib/session";
import { usePolling } from "@/lib/usePolling";
import {
  MODE_LABEL,
  type MatchSummary,
  type Message,
  type Mode,
} from "@/lib/types";

/** 一覧を取り直す間隔。相手の新着を拾うために定期的に叩く */
const POLLING_INTERVAL_MS = 5000;

/** getMatches の結果。「どのモードで取ったか」を一緒に持つ */
type LoadResult = {
  mode: Mode;
  matches: MatchSummary[];
  error: string | null;
};

/**
 * トーク画面の本体。
 *
 * 左にマッチ一覧、右にトークパネル。一覧の項目を押すとパネルが右から出てくる。
 * 一覧はヘッダーで選んでいるモードのものだけを表示する（画面内に別のタブは作らない）。
 *
 * Supabase のセッションはブラウザ側にあるので、サーバーコンポーネントから
 * repository を呼ぶと 0 件になる。そのため必ずクライアント側で取得する。
 */
export function TalkScreen() {
  const { currentUser, mode } = useSession();
  const userId = currentUser?.id ?? null;

  const [result, setResult] = useState<LoadResult | null>(null);

  // 取得結果に「どのモードのものか」を持たせておくと、
  // loading / matches / error を state を増やさず計算で出せる。
  const current = result !== null && result.mode === mode ? result : null;
  const loading = current === null;
  const error = current?.error ?? null;

  // 最新メッセージが新しい順に並べる。
  // まだ会話が無いマッチは、マッチが成立した日時で比べる
  // （＝マッチした直後の相手が一番上に来る）。
  const matches = useMemo(() => {
    if (current === null) return [];
    return [...current.matches].sort((a, b) => timeOf(b) - timeOf(a));
  }, [current]);

  // パネルの「中身」と「開いているか」は別々に持つ。
  // 閉じるときに selected を null にすると中身が先に消えてしまい、
  // 空のパネルが滑り出ていく不自然な動きになるため。
  const [selected, setSelected] = useState<MatchSummary | null>(null);
  const [open, setOpen] = useState(false);

  /** いま開いている会話。閉じているときは null */
  const openMatchId = open ? selected?.match.id ?? null : null;

  // 開いている会話は読んでいる最中なので、一覧のバッジは即座に消す。
  // 既読の保存自体は下の effect でやるが、その結果が一覧に返ってくるのは
  // 次のポーリングのあとなので、表示側でも 0 にしておく。
  const displayedMatches = useMemo(
    () =>
      openMatchId === null
        ? matches
        : matches.map((summary) =>
            summary.match.id === openMatchId && summary.unreadCount !== 0
              ? { ...summary, unreadCount: 0 }
              : summary,
          ),
    [matches, openMatchId],
  );

  // モードが変わったらトークを閉じる。
  // setState をレンダー中に呼ぶと無限ループになるため、effect に寄せる。
  // selected はあえて残すので、閉じるアニメーション中も相手の名前が見えたままになる。
  const [panelMode, setPanelMode] = useState(mode);
  useEffect(() => {
    if (panelMode !== mode) {
      setPanelMode(mode);
      setOpen(false);
    }
  }, [mode, panelMode]);

  // 何番目の問い合わせかを覚えておき、最後に投げたものの結果だけを採用する。
  // ポーリングとモード切替が重なっても、古い結果が新しい結果を上書きしない。
  const requestId = useRef(0);

  // usePolling が完了を待てるように Promise を返す
  const load = useCallback(() => {
    if (!userId) return Promise.resolve();
    const id = ++requestId.current;

    return getMatches(userId, mode)
      .then((list) => {
        if (id !== requestId.current) return;
        setResult({ mode, matches: list, error: null });
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        const message =
          err instanceof Error ? err.message : "マッチの取得に失敗しました。";
        // 一時的な通信エラーで一覧が消えないよう、取れていた分は残す
        setResult((prev) => ({
          mode,
          matches: prev !== null && prev.mode === mode ? prev.matches : [],
          error: message,
        }));
      });
  }, [userId, mode]);

  // ログインユーザーかモードが変わったら取り直す
  useEffect(() => {
    load();
  }, [load]);

  // 相手が送ったメッセージを拾うため、定期的に取り直す
  usePolling(load, POLLING_INTERVAL_MS, userId !== null);

  // 開いている会話の既読位置を保存する。
  //
  // 記録するのは「読んだ最後のメッセージの時刻」なので、最新メッセージが増えるたびに
  // 書き直す。こうしておくと、開いたまま相手が送ってきた分も未読に戻らない。
  const openLatestAt =
    matches.find((summary) => summary.match.id === openMatchId)?.latestMessage
      ?.createdAt ?? null;

  useEffect(() => {
    if (!userId || openMatchId === null || openLatestAt === null) return;
    void markMatchRead(openMatchId, userId, openLatestAt).catch(
      (err: unknown) => {
        // 既読の保存に失敗しても会話自体は続けられるので、画面にエラーは出さない。
        // ただし黙って消すと「バッジが消えない」原因が追えないので、ログには残す。
        console.warn(
          "既読位置を保存できませんでした。supabase/match_reads.sql の実行と RLS を確認してください。",
          err,
        );
      },
    );
  }, [openLatestAt, openMatchId, userId]);

  if (!currentUser) {
    return <p className="text-sm text-muted">読み込み中…</p>;
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col gap-3">
      <h1 className="text-lg font-extrabold">トーク</h1>

      {error ? (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          {error}
        </p>
      ) : null}

      {/* overflow-hidden が、画面外に逃がしたパネルのはみ出しを隠している */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-line">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted">読み込み中…</p>
          ) : matches.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">
              {MODE_LABEL[mode]}モードのマッチはまだありません。
            </p>
          ) : (
            <MatchList
              matches={displayedMatches}
              selectedMatchId={selected?.match.id ?? null}
              onSelect={(summary) => {
                setSelected(summary);
                setOpen(true);
              }}
            />
          )}
        </div>

        {/* パネルは absolute で置くので、その基準になる relative をここに付ける */}
        <div className="relative flex-1">
          <TalkPanel
            open={open}
            summary={selected}
            onClose={() => setOpen(false)}
            onSent={(created: Message) => {
              setResult((prev) => {
                if (prev === null || prev.mode !== mode) return prev;

                const matches = [...prev.matches]
                  .map((summary) =>
                    summary.match.id === created.matchId
                      ? { ...summary, latestMessage: created }
                      : summary,
                  )
                  .sort((a, b) => timeOf(b) - timeOf(a));

                return { ...prev, matches };
              });

              setSelected((prev) =>
                prev && prev.match.id === created.matchId
                  ? { ...prev, latestMessage: created }
                  : prev,
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** 並べ替えに使う時刻。会話があれば最新メッセージ、無ければマッチ成立日時 */
function timeOf(summary: MatchSummary): number {
  return Date.parse(
    summary.latestMessage?.createdAt ?? summary.match.createdAt,
  );
}
