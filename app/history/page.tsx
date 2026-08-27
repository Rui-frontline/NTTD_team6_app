"use client";

import { useEffect, useState } from "react";
import { ProfileDetailModal } from "@/components/profile/ProfileDetailModal";
import { useSession } from "@/lib/session";
import {
  getReactionHistory,
  deleteReaction,
  getUser,
  getBlockedUsers,
  unblockUser,
  type BlockedUser,
} from "@/lib/repository";
import type { Reaction, User } from "@/lib/types";

type ReactionWithUser = Reaction & {
  user: User;
};

export default function HistoryPage() {
  const { currentUser, mode } = useSession();
  const [reactions, setReactions] = useState<ReactionWithUser[]>([]);
  /**
   * プロフィールを開いている相手。null なら開いていない。
   * いいね一覧とブロック中一覧で同じ state を使い回す。
   */
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 履歴を取得
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    getReactionHistory(currentUser.id, mode)
      .then(async (data) => {
        // 各反応に対して相手のユーザー情報を取得
        const withUsers = await Promise.all(
          data.map(async (reaction) => {
            const user = await getUser(reaction.toUserId);
            return { ...reaction, user: user! };
          })
        );
        setReactions(withUsers);
      })
      .catch((error) => console.error("履歴取得エラー:", error))
      .finally(() => setLoading(false));
  }, [currentUser, mode]);

  // ブロックした人の一覧。恋愛モードでしかブロックできないので、そこだけ出す
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);

  // 解除の確認を出している相手。null なら出していない
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [unblockError, setUnblockError] = useState<string | null>(null);

  // モードを切り替えたら、前のモードの一覧と確認ダイアログを捨てる。
  //
  // effect ではなくレンダー中に調整する。effect だと一度古い状態で描かれてから
  // 直るので、切り替えた瞬間に前のモードの内容が残って見える。
  // 直前のモードを覚えているので、無限ループにはならない。
  const [listMode, setListMode] = useState(mode);
  if (listMode !== mode) {
    setListMode(mode);
    setBlocked([]);
    setBlockedLoading(true);
    setUnblockTarget(null);
    setUnblockError(null);
  }

  useEffect(() => {
    if (!currentUser || mode !== "romance") return;

    // 切り替えが速いと古い結果が後から届くので、届いた時点で捨てられるようにする
    let cancelled = false;

    getBlockedUsers(currentUser.id, mode)
      .then((list) => {
        if (!cancelled) setBlocked(list);
      })
      .catch((error) => {
        // 一覧が出ないだけで履歴そのものは見られるので、画面は止めない
        console.error("ブロック一覧の取得エラー:", error);
        if (!cancelled) setBlocked([]);
      })
      .finally(() => {
        if (!cancelled) setBlockedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, mode]);

  // ブロック解除処理
  const handleUnblock = async () => {
    if (!currentUser || !unblockTarget || unblocking) return;

    setUnblocking(true);
    setUnblockError(null);

    try {
      await unblockUser(currentUser.id, unblockTarget.user.id, mode);
      setBlocked((prev) =>
        prev.filter((b) => b.user.id !== unblockTarget.user.id),
      );
      setUnblockTarget(null);
    } catch (error) {
      console.error("ブロック解除エラー:", error);
      setUnblockError(
        error instanceof Error && error.message
          ? error.message
          : "ブロックを解除できませんでした。",
      );
    } finally {
      setUnblocking(false);
    }
  };

  // 取り消し処理
  const handleDelete = async (reaction: Reaction) => {
    if (!currentUser) return;
    if (!confirm("この履歴を削除しますか？")) return;

    try {
      await deleteReaction(currentUser.id, reaction.toUserId, mode);
      // 画面から削除
      setReactions((prev) => prev.filter((r) => r.toUserId !== reaction.toUserId));
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました");
    }
  };

  if (!currentUser) {
    return <div>ログインしてください</div>;
  }

  return (
    // 上の余白は AppShell が持つ。ここで足すと二重になる
    <div style={{ padding: "0 32px 24px" }}>
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#1E1B4B" }}>
        いいね・見送りした人
      </h2>

      {loading ? (
        <div style={{ textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }}>
          読み込み中...
        </div>
      ) : reactions.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }}>
          まだ履歴がありません
        </div>
      ) : (
        <div style={{
          display: "grid",
          // min(300px, 100%) にしないと、狭い画面で列が 300px を下回れず
              // 横にはみ出す
              gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
          gap: "24px",
          marginTop: "32px",
        }}>
          {reactions.map((reaction) => (
            <div
              key={reaction.toUserId}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* ラベル（いいね or 見送り） */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: "500",
                  backgroundColor: reaction.type === "like" ? "#FEF3F2" : "#F3F4F6",
                  color: reaction.type === "like" ? "#DC2626" : "#6B7280",
                }}>
                  {reaction.type === "like" ? "♡ いいね" : "✕ 見送り"}
                </span>
                <span style={{ fontSize: "12px", color: "#9CA3AF" }}>
                  {new Date(reaction.createdAt).toLocaleDateString("ja-JP")}
                </span>
              </div>

              {/*
                アイコンと名前だけをボタンにする。行全体を押せるようにすると、
                右の取り消しボタンまで巻き込んでしまう。
              */}
              <button
                type="button"
                onClick={() => setProfileUser(reaction.user)}
                title={`${reaction.user.name}さんのプロフィールを見る`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <img
                  src={reaction.user.avatarUrl}
                  alt={reaction.user.name}
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
                <div>
                  <p style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#1E1B4B" }}>
                    {reaction.user.name}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6B7280" }}>
                    {mode === "romance" && !reaction.user.romance.showDepartment
                      ? reaction.user.jobTitle
                      : `${reaction.user.department} / ${reaction.user.jobTitle}`}
                  </p>
                </div>
              </button>

              {/* 取り消しボタン */}
              <button
                onClick={() => handleDelete(reaction)}
                style={{
                  padding: "10px",
                  backgroundColor: "#F3F4F6",
                  color: "#6B7280",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                取り消し
              </button>
            </div>
          ))}
        </div>
      )}

      {/*
        ブロックした人。ブロックは恋愛モードにしか無いので、そこだけ出す。
        並び順（新しい順）・グリッド・カードの作りは、上のいいね一覧に揃えている。
      */}
      {mode === "romance" ? (
        <>
          <h2 style={{ margin: "40px 0 0 0", fontSize: "18px", fontWeight: "bold", color: "#1E1B4B" }}>
            ブロックした人
          </h2>

          {blockedLoading ? (
            <div style={{ textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }}>
              読み込み中...
            </div>
          ) : blocked.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }}>
              ブロックした人はいません
            </div>
          ) : (
            <div style={{
              display: "grid",
              // min(300px, 100%) にしないと、狭い画面で列が 300px を下回れず
              // 横にはみ出す
              gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
              gap: "24px",
              marginTop: "24px",
            }}>
              {blocked.map((item) => (
                <div
                  key={item.user.id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "20px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {/* ラベルとブロックした日 */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <span style={{
                      padding: "6px 12px",
                      borderRadius: "12px",
                      fontSize: "14px",
                      fontWeight: "500",
                      backgroundColor: "#F3F4F6",
                      color: "#374151",
                    }}>
                      🚫 ブロック中
                    </span>
                    <span style={{ fontSize: "12px", color: "#9CA3AF" }}>
                      {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>

                  {/* 解除ボタンを巻き込まないよう、ここも名前だけをボタンにする */}
                  <button
                    type="button"
                    onClick={() => setProfileUser(item.user)}
                    title={`${item.user.name}さんのプロフィールを見る`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: 0,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.user.avatarUrl}
                      alt={item.user.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                    <div>
                      <p style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#1E1B4B" }}>
                        {item.user.name}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6B7280" }}>
                        {item.user.romance.showDepartment
                          ? `${item.user.department} / ${item.user.jobTitle}`
                          : item.user.jobTitle}
                      </p>
                    </div>
                  </button>

                  {/* ブロック解除ボタン */}
                  <button
                    onClick={() => {
                      setUnblockError(null);
                      setUnblockTarget(item);
                    }}
                    style={{
                      padding: "10px",
                      backgroundColor: "#F3F4F6",
                      color: "#6B7280",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    ブロック解除
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/*
        解除の確認。トーク画面のブロック確認と同じ「YES / NO」の並びにしている。
        取り消しの NO を左、実行の YES を右に置く。
      */}
      {unblockTarget ? (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ブロック解除の確認"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "360px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <p style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: "bold",
              color: "#1E1B4B",
              textAlign: "center",
            }}>
              {unblockTarget.user.name}さんのブロックを解除しますか？
            </p>
            <p style={{ margin: "12px 0 0 0", fontSize: "13px", lineHeight: 1.7, color: "#6B7280" }}>
              解除すると、この人がまた「探す」画面に表示されるようになります。
            </p>

            {unblockError ? (
              <p style={{ margin: "12px 0 0 0", fontSize: "13px", color: "#DC2626" }}>
                {unblockError}
              </p>
            ) : null}

            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button
                onClick={() => setUnblockTarget(null)}
                disabled={unblocking}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#F3F4F6",
                  color: "#6B7280",
                  border: "none",
                  borderRadius: "8px",
                  cursor: unblocking ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  opacity: unblocking ? 0.5 : 1,
                }}
              >
                NO
              </button>
              <button
                onClick={() => {
                  void handleUnblock();
                }}
                disabled={unblocking}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  cursor: unblocking ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  opacity: unblocking ? 0.5 : 1,
                }}
              >
                {unblocking ? "処理中" : "YES"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        相手のプロフィール。ブロック解除の確認と同じ層（z-index 50）に出るので、
        両方が同時に開かないようにしている。確認を出しているあいだは
        プロフィールを出さない。
      */}
      {profileUser && !unblockTarget ? (
        <ProfileDetailModal
          user={profileUser}
          mode={mode}
          onClose={() => setProfileUser(null)}
        />
      ) : null}
    </div>
  );
}
