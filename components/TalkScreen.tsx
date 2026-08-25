"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchList } from "@/components/MatchList";
import { PageHeading } from "@/components/PageHeading";
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
export function TalkScreen({
  /**
   * 最初から開いておく会話の match id。
   * 「探す」画面でマッチが成立したときに `/talk?match=<id>` で渡ってくる。
   */
  initialMatchId = null,
}: {
  initialMatchId?: string | null;
}) {
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

  // `/talk?match=<id>` で来たときは、その会話を最初から開いておく。
  // マッチが成立した直後に、相手を一覧から探し直さずそのまま話し始められる。
  //
  // 一覧が届くまでは開けないので、目的のマッチが一覧に現れた最初のレンダーで一度だけ開く。
  // effect にすると set-state-in-effect になるうえ、一度閉じた状態で描かれてから
  // パネルが後追いで滑り出てくるので、上の panelMode と同じくレンダー中に調整する。
  //
  // 開いたら autoOpenedId に記録して二度と開き直さない。
  // これが無いと、ユーザーが閉じてもポーリングのたびに勝手に開き直してしまう。
  const [autoOpenedId, setAutoOpenedId] = useState<string | null>(null);
  if (initialMatchId !== null && autoOpenedId !== initialMatchId) {
    // 別モードのマッチを指されたときは一覧に無いので、見つかるまで何もしない
    const target = matches.find((s) => s.match.id === initialMatchId);
    if (target) {
      setAutoOpenedId(initialMatchId);
      setSelected(target);
      setOpen(true);
    }
  }

  // モードが変わったらトークを閉じる。
  //
  // effect ではなくレンダー中に調整する（React 公式の「値が変わったときに
  // state を調整する」パターン）。effect だと一度古い状態で画面に描かれてから
  // 直るので、モードを切り替えた瞬間にパネルが残って見える。
  //
  // 直前のモードを panelMode に覚えているため、無限ループにはならない。
  // setPanelMode(mode) で条件が false になり、次のレンダーでは何もしない。
  //
  // selected はあえて残すので、閉じるアニメーション中も相手の名前が見えたままになる。
  const [panelMode, setPanelMode] = useState(mode);
  if (panelMode !== mode) {
    setPanelMode(mode);
    setOpen(false);
  }

  // 何番目の問い合わせかを覚えておき、最後に投げたものの結果だけを採用する。
  // ポーリングとモード切替が重なっても、古い結果が新しい結果を上書きしない。
  const requestId = useRef(0);

  // マッチごとに「どこまで既読にしたか」を覚えておく。
  // 保存した直後のポーリングは、まだ古い未読数を返してくることがあるので、
  // その結果をこちらの記録で打ち消すのに使う。
  const readUpToRef = useRef(new Map<string, number>());

  const applyLocalReads = useCallback((list: MatchSummary[]) => {
    return list.map((summary) => {
      if (summary.unreadCount === 0) return summary;
      const readUpTo = readUpToRef.current.get(summary.match.id);
      if (readUpTo === undefined) return summary;
      const latest = summary.latestMessage
        ? Date.parse(summary.latestMessage.createdAt)
        : 0;
      return latest <= readUpTo ? { ...summary, unreadCount: 0 } : summary;
    });
  }, []);

  // usePolling が完了を待てるように Promise を返す
  const load = useCallback(() => {
    if (!userId) return Promise.resolve();
    const id = ++requestId.current;

    return getMatches(userId, mode)
      .then((list) => {
        if (id !== requestId.current) return;
        setResult({ mode, matches: applyLocalReads(list), error: null });
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
  }, [userId, mode, applyLocalReads]);

  // ログインユーザーかモードが変わったら取り直す
  useEffect(() => {
    load();
  }, [load]);

  // 相手が送ったメッセージを拾うため、定期的に取り直す
  usePolling(load, POLLING_INTERVAL_MS, userId !== null);

  /**
   * 会話が「ここまで表示できた」と知らせてきたときに既読にする。
   *
   * 呼ぶのは Conversation の取得が成功したときだけなので、
   * 取得に失敗したメッセージが既読になることはない。
   */
  const markRead = useCallback((matchId: string, readAt: string) => {
    const at = Date.parse(readAt);
    const sent = readUpToRef.current.get(matchId) ?? 0;
    // 同じ位置まで記録済みなら何もしない（ポーリングのたびに書きに行かない）
    if (at <= sent) return;
    readUpToRef.current.set(matchId, at);

    // 表示できたぶんは読んだので、保存の完了を待たずにバッジを消す。
    // 表示用の派生値ではなく取得結果そのものを更新するので、
    // 次のポーリングを待たずに閉じてもバッジは復活しない。
    setResult((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            matches: prev.matches.map((summary) =>
              summary.match.id === matchId && summary.unreadCount !== 0
                ? { ...summary, unreadCount: 0 }
                : summary,
            ),
          },
    );

    void markMatchRead(matchId, readAt).catch((err: unknown) => {
      // 保存できなかったので、次の機会に書き直せるよう記録を戻す
      if (sent === 0) readUpToRef.current.delete(matchId);
      else readUpToRef.current.set(matchId, sent);
      // 既読の保存に失敗しても会話自体は続けられるので、画面にエラーは出さない。
      // ただし黙って消すと「バッジが消えない」原因が追えないので、ログには残す。
      console.warn(
        "既読位置を保存できませんでした。supabase/match_reads.sql の実行と RLS を確認してください。",
        err,
      );
    });
  }, []);

  if (!currentUser) {
    return <p className="text-sm text-muted">読み込み中…</p>;
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col gap-3">
      <PageHeading
        title="トーク"
        description="マッチした人との会話を確認できます。"
      />

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
              matches={matches}
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
            onRead={markRead}
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
            onBlocked={(matchId: string) => {
              // 次のポーリングを待たずに消す。
              // getMatches もブロック済みを外して返すので、復活はしない。
              setResult((prev) =>
                prev === null
                  ? prev
                  : {
                      ...prev,
                      matches: prev.matches.filter(
                        (summary) => summary.match.id !== matchId,
                      ),
                    },
              );
              setOpen(false);
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
