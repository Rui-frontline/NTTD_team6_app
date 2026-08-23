"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { useSession } from "@/lib/session";
import { getReactionHistory, deleteReaction, getUser } from "@/lib/repository";
import type { Reaction, User } from "@/lib/types";
import styles from "./history.module.css";

type ReactionWithUser = Reaction & {
  user: User;
};

export default function HistoryPage() {
  const { currentUser, mode } = useSession();
  const isWork = mode === "work";
  const [reactions, setReactions] = useState<ReactionWithUser[]>([]);
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
    <div
      className={isWork ? styles.workPage : undefined}
      style={{ padding: "24px 32px" }}
    >
      <PageHeading
        title="履歴"
        description="あなたがいいね・見送りした人の一覧です"
      />

      {loading ? (
        <div
          className={isWork ? styles.workLoadingState : undefined}
          style={{ textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }}
        >
          読み込み中...
        </div>
      ) : reactions.length === 0 ? (
        <div
          className={isWork ? styles.workEmptyState : undefined}
          style={{ textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }}
        >
          まだ履歴がありません
        </div>
      ) : (
        <div className={isWork ? styles.workGrid : undefined} style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "24px",
          marginTop: "32px",
        }}>
          {reactions.map((reaction) => (
            <div
              key={reaction.toUserId}
              className={isWork ? styles.workCard : undefined}
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
                <span
                  className={
                    isWork
                      ? reaction.type === "like"
                        ? styles.workLikeBadge
                        : styles.workPassBadge
                      : undefined
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "500",
                    backgroundColor: reaction.type === "like" ? "#FEF3F2" : "#F3F4F6",
                    color: reaction.type === "like" ? "#DC2626" : "#6B7280",
                  }}
                >
                  {reaction.type === "like" ? "♡ いいね" : "✕ 見送り"}
                </span>
                <span
                  className={isWork ? styles.workDate : undefined}
                  style={{ fontSize: "12px", color: "#9CA3AF" }}
                >
                  {new Date(reaction.createdAt).toLocaleDateString("ja-JP")}
                </span>
              </div>

              {/* アイコンと名前 */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img
                  className={isWork ? styles.workAvatar : undefined}
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
                  <p
                    className={isWork ? styles.workName : undefined}
                    style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#1E1B4B" }}
                  >
                    {reaction.user.name}
                  </p>
                  <p
                    className={isWork ? styles.workMeta : undefined}
                    style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6B7280" }}
                  >
                    {mode === "romance" && !reaction.user.romance.showDepartment
                      ? reaction.user.jobTitle
                      : `${reaction.user.department} / ${reaction.user.jobTitle}`}
                  </p>
                </div>
              </div>

              {/* 取り消しボタン */}
              <button
                className={isWork ? styles.workCancelButton : undefined}
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
    </div>
  );
}
