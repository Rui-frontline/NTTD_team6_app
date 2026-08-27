"use client";

import { useCallback, useEffect, useState } from "react";
import { DailyMissions } from "@/components/points/DailyMissions";
import { ItemShop } from "@/components/points/ItemShop";
import { PointHistory } from "@/components/points/PointHistory";
import { PointsSummary } from "@/components/points/PointsSummary";
import { RewardInbox } from "@/components/points/RewardInbox";
import { useSession } from "@/lib/session";
import {
  claimPointRewards,
  exchangeItem,
  getPendingRewards,
  getPointEvents,
  getUserItems,
  syncDailyMissions,
} from "@/lib/repository";
import type { PointEvent, PointReward, UserItems } from "@/lib/repository";
import { POINT_HISTORY_LIMIT } from "@/lib/points";
import type { DailyProgress, ItemId } from "@/lib/points";

type Tab = "missions" | "shop";

/**
 * ポイント画面。
 *
 * 画面の作りは pictures/ポイント_仕事モード.png に合わせている。
 * 上から 保有ポイントの帯 → 履歴 → タブ（デイリーミッション / ポイントを使う）。
 *
 * ポイントの流れは3段になっている。
 *   1. 何かを達成する → 受け取り箱に届く（残高はまだ増えない）
 *   2. 受け取り箱で受け取る → 残高が増え、履歴に残る
 *   3. アイテムと交換する → 残高が減り、持ち物が増える
 *
 * 1段目のうちデイリーミッションは、この画面を開いたときに
 * syncDailyMissions() が箱へ入れる（受信箱を覗いたら届いている、という形）。
 */
export default function PointsPage() {
  const { currentUser, refreshUser } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rewards, setRewards] = useState<PointReward[]>([]);
  const [events, setEvents] = useState<PointEvent[]>([]);
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [items, setItems] = useState<UserItems>({});

  const [inboxOpen, setInboxOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [exchanging, setExchanging] = useState<ItemId | null>(null);
  const [tab, setTab] = useState<Tab>("missions");
  /** 受け取り・交換の結果を一時的に知らせる。3秒で消す */
  const [notice, setNotice] = useState<string | null>(null);

  const userId = currentUser?.id ?? null;

  /**
   * 画面に出すものをまとめて読み直す。
   *
   * ミッションの同期を先に済ませてから箱を読む。順番が逆だと、
   * 今日ぶんが届いた直後に「0件」と出てしまう。
   */
  const load = useCallback(async (id: string) => {
    // 同期は失敗しても他を止めない。SQL 未実行の環境でも履歴だけは見せたい
    const daily = await syncDailyMissions().catch((e) => {
      console.error("デイリーミッションの同期に失敗しました", e);
      return null;
    });
    const [pending, history, owned] = await Promise.all([
      getPendingRewards(id),
      getPointEvents(id, POINT_HISTORY_LIMIT),
      getUserItems(id),
    ]);
    return { daily, pending, history, owned };
  }, []);

  // 初回の読み込み。
  // effect の中で同期的に setState すると React 19 の set-state-in-effect に
  // 触れるので、更新は非同期の完了後だけで行う。
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    load(userId)
      .then(({ daily, pending, history, owned }) => {
        if (!alive) return;
        setProgress(daily);
        setRewards(pending);
        setEvents(history);
        setItems(owned);
      })
      .catch((e) => {
        console.error("ポイント情報の取得に失敗しました", e);
        if (alive) {
          setError(
            "ポイント情報を読み込めませんでした。supabase/point_rewards.sql を実行してください。",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, load]);

  /** 操作のあとに読み直す。イベント経由なので setState を直接書いてよい */
  const reload = async (id: string) => {
    const { daily, pending, history, owned } = await load(id);
    setProgress(daily);
    setRewards(pending);
    setEvents(history);
    setItems(owned);
  };

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3000);
  };

  /** ids を省略するとまとめて受け取る */
  const handleClaim = async (ids?: string[]) => {
    if (!userId) return;
    setClaiming(true);
    setError(null);
    try {
      const result = await claimPointRewards(ids);
      if (result.claimed === 0) {
        showNotice("受け取れるポイントがありませんでした。");
      } else {
        showNotice(`${result.awarded}ポイントを受け取りました。`);
      }
      // 残高はサイドバーとこの画面の両方に出るので、読み直して揃える
      await refreshUser();
      await reload(userId);
    } catch (e) {
      console.error("ポイントの受け取りに失敗しました", e);
      setError("ポイントを受け取れませんでした。もう一度お試しください。");
    } finally {
      setClaiming(false);
    }
  };

  const handleExchange = async (item: ItemId) => {
    if (!userId) return;
    setExchanging(item);
    setError(null);
    try {
      const result = await exchangeItem(item);
      showNotice(`${result.label}と交換しました。`);
      await refreshUser();
      await reload(userId);
    } catch (e) {
      console.error("交換に失敗しました", e);
      // 残高不足は DB 側が例外にする。押せない状態でも、他の端末で
      // 使ったあとなら起こりうる
      setError("交換できませんでした。ポイントが足りているか確認してください。");
    } finally {
      setExchanging(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="py-10 text-center text-sm text-[var(--muted)]">
        ログインしてください
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-[var(--muted)]">
        読み込み中...
      </div>
    );
  }

  const pendingPoints = rewards.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--foreground)]">
      {error ? (
        <p className="mb-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </p>
      ) : null}
      {notice && !error ? (
        <p className="mb-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent-strong)]">
          {notice}
        </p>
      ) : null}

      <div className="space-y-4">
        <PointsSummary
          points={currentUser.points}
          pendingCount={rewards.length}
          pendingPoints={pendingPoints}
          onOpenInbox={() => setInboxOpen(true)}
        />

        <PointHistory events={events} />

        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--soft-shadow)]">
          {/* タブ。デザイン案では2枚が横いっぱいに並ぶ */}
          <div role="tablist" className="grid grid-cols-2">
            <TabButton
              active={tab === "missions"}
              onClick={() => setTab("missions")}
            >
              今日のデイリーミッション
            </TabButton>
            <TabButton active={tab === "shop"} onClick={() => setTab("shop")}>
              ポイントを使う
            </TabButton>
          </div>

          {tab === "missions" ? (
            <DailyMissions progress={progress} />
          ) : (
            <ItemShop
              points={currentUser.points}
              items={items}
              exchanging={exchanging}
              onExchange={handleExchange}
            />
          )}
        </section>
      </div>

      {inboxOpen ? (
        <RewardInbox
          rewards={rewards}
          claiming={claiming}
          onClaim={(id) => handleClaim([id])}
          onClaimAll={() => handleClaim()}
          onClose={() => setInboxOpen(false)}
        />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        // 狭い画面では左右の余白と文字を詰める。半分の幅に
        // 「今日のデイリーミッション」が入らず、行が増えて段差になる
        "px-2 py-3.5 text-xs font-bold transition-colors sm:px-4 sm:text-sm",
        active
          ? "bg-[var(--accent)] text-white"
          : "bg-[var(--accent-soft)] text-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
