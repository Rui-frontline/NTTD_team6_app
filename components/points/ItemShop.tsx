"use client";

import { formatPoints } from "@/components/PointBalance";
import { ITEMS } from "@/lib/points";
import type { ItemId } from "@/lib/points";
import type { UserItems } from "@/lib/repository";

/**
 * ポイントを使う。交換するとアイテムが1つ増える。
 *
 * 値段は lib/points.ts に置いてあるが、実際に引かれる額は DB 側
 * （exchange_item）が決める。画面から金額を渡すと 0 ポイントで
 * 交換できてしまうため。ここの cost は表示と「押せるかどうか」の判定用。
 */
export function ItemShop({
  points,
  items,
  exchanging,
  onExchange,
}: {
  /** いまの残高。足りない品はボタンを止める */
  points: number;
  items: UserItems;
  /** 交換中のアイテム。二重に押せないようにする */
  exchanging: ItemId | null;
  onExchange: (item: ItemId) => void;
}) {
  return (
    <div className="p-5">
      <h3 className="text-base font-bold">ポイントを使う</h3>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        貯めたポイントをアイテムと交換できます
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {ITEMS.map((item) => {
          const owned = items[item.id] ?? 0;
          const enough = points >= item.cost;
          const busy = exchanging === item.id;

          return (
            <li
              key={item.id}
              className="flex flex-col rounded-xl border border-[var(--line)] p-4"
            >
              <div className="flex items-start gap-3">
                {/*
                  スーパーいいねだけ絵文字ではなく虹色のハートにする。
                  探す画面で光るものと同じ印を、買う場所にも出すため。

                  rainbow-heart は app/globals.css の全体クラス。
                  絵文字は色を変えられないので、文字の ♥ に差し替えている。
                */}
                {item.id === "super_like" ? (
                  <span className="rainbow-heart text-2xl leading-none" aria-hidden>
                    ♥
                  </span>
                ) : (
                  <span className="text-2xl" aria-hidden>
                    {item.emoji}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[var(--accent)]">
                  {formatPoints(item.cost)} pt
                </span>
                <span className="text-xs text-[var(--muted)]">
                  所持 {owned}個
                </span>
              </div>

              <button
                type="button"
                onClick={() => onExchange(item.id)}
                disabled={!enough || busy}
                className="mt-3 rounded-lg bg-[var(--accent)] py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "交換中..." : enough ? "交換する" : "ポイントが足りません"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
