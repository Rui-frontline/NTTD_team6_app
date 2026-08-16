"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchList } from "@/components/MatchList";
import { TalkPanel } from "@/components/TalkPanel";
import { getMatches } from "@/lib/repository";
import { useSession } from "@/lib/session";
import { usePolling } from "@/lib/usePolling";
import { MODE_LABEL, type MatchSummary, type Mode } from "@/lib/types";

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

  // モードが変わったらトークを閉じる。
  // effect ではなくレンダー中に調整するのが React の推奨（公式ドキュメントの
  // 「propsが変わったときにstateを調整する」パターン）。
  // selected はあえて残すので、閉じるアニメーション中も相手の名前が見えたままになる。
  const [panelMode, setPanelMode] = useState(mode);
  if (panelMode !== mode) {
    setPanelMode(mode);
    setOpen(false);
  }

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
