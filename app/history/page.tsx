"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { useSession } from "@/lib/session";
import { getReactionHistory, deleteReaction, getUser } from "@/lib/repository";
import type { Reaction, User } from "@/lib/types";

type ReactionWithUser = Reaction & {
  user: User;
};

export default function HistoryPage() {
  const { currentUser, mode } = useSession();
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
      className={mode === "work" ? "mx-auto w-full max-w-6xl" : ""}
      style={mode === "romance" ? { padding: "24px 32px" } : undefined}
    >
      <PageHeading
        title="履歴"
        description="あなたがいいね・見送りした人の一覧です"
      />

      {loading ? (
        <div
          className={mode === "work" ? "mt-16 text-center text-sm text-muted" : ""}
          style={
            mode === "romance"
              ? { textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }
              : undefined
          }
        >
          読み込み中...
        </div>
      ) : reactions.length === 0 ? (
        <div
          className={
            mode === "work"
              ? "premium-card mt-12 px-6 py-16 text-center text-sm text-muted"
              : ""
          }
          style={
            mode === "romance"
              ? { textAlign: "center", marginTop: "40px", fontSize: "18px", color: "#666" }
              : undefined
          }
        >
          まだ履歴がありません
        </div>
      ) : (
        <div
          className={
            mode === "work"
              ? "mt-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5"
              : ""
          }
          style={
            mode === "romance"
              ? {
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "24px",
                  marginTop: "32px",
                }
              : undefined
          }
        >
          {reactions.map((reaction) => (
            <div
              key={reaction.toUserId}
              className={
                mode === "work"
                  ? "premium-card flex flex-col gap-5 p-5 transition-transform duration-200 hover:-translate-y-1"
                  : ""
              }
              style={
                mode === "romance"
                  ? {
                      backgroundColor: "#FFFFFF",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }
                  : undefined
              }
            >
              {/* ラベル（いいね or 見送り） */}
              <div className="flex items-center justify-between">
                <span
                  className={
                    mode === "work"
                      ? [
                          "rounded-full px-3 py-1.5 text-xs font-medium",
                          reaction.type === "like"
                            ? "bg-[var(--gold-soft)] text-[var(--accent)]"
                            : "bg-[#F0ECE6] text-muted",
                        ].join(" ")
                      : ""
                  }
                  style={
                    mode === "romance"
                      ? {
                          padding: "6px 12px",
                          borderRadius: "12px",
                          fontSize: "14px",
                          fontWeight: "500",
                          backgroundColor: reaction.type === "like" ? "#FEF3F2" : "#F3F4F6",
                          color: reaction.type === "like" ? "#DC2626" : "#6B7280",
                        }
                      : undefined
                  }
                >
                  {reaction.type === "like" ? "♡ いいね" : "✕ 見送り"}
                </span>
                <span
                  className={mode === "work" ? "text-[11px] text-muted" : ""}
                  style={mode === "romance" ? { fontSize: "12px", color: "#9CA3AF" } : undefined}
                >
                  {new Date(reaction.createdAt).toLocaleDateString("ja-JP")}
                </span>
              </div>

              {/* アイコンと名前 */}
              <div className="flex items-center gap-3">
                <img
                  src={reaction.user.avatarUrl}
                  alt={reaction.user.name}
                  className={
                    mode === "work"
                      ? "h-15 w-15 rounded-full border border-[var(--gold-soft)] object-cover p-0.5"
                      : ""
                  }
                  style={
                    mode === "romance"
                      ? { width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover" }
                      : undefined
                  }
                />
                <div>
                  <p
                    className={
                      mode === "work"
                        ? "font-serif text-lg font-semibold tracking-wide text-[var(--accent)]"
                        : ""
                    }
                    style={
                      mode === "romance"
                        ? { margin: 0, fontSize: "18px", fontWeight: "bold", color: "#1E1B4B" }
                        : undefined
                    }
                  >
                    {reaction.user.name}
                  </p>
                  <p
                    className={mode === "work" ? "mt-1 text-xs leading-relaxed text-muted" : ""}
                    style={
                      mode === "romance"
                        ? { margin: "4px 0 0 0", fontSize: "14px", color: "#6B7280" }
                        : undefined
                    }
                  >
                    {mode === "romance" && !reaction.user.romance.showDepartment
                      ? reaction.user.jobTitle
                      : `${reaction.user.department} / ${reaction.user.jobTitle}`}
                  </p>
                </div>
              </div>

              {/* 取り消しボタン */}
              <button
                onClick={() => handleDelete(reaction)}
                className={
                  mode === "work"
                    ? "rounded-[14px] border border-line bg-[#FBFAF7] px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    : ""
                }
                style={
                  mode === "romance"
                    ? {
                        padding: "10px",
                        backgroundColor: "#F3F4F6",
                        color: "#6B7280",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "500",
                      }
                    : undefined
                }
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
