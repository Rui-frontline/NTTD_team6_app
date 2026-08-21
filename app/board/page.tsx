"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { useSession } from "@/lib/session";
import {
  getBoards,
  createBoard,
  updateBoard,
  deleteBoard,
  joinBoard,
  leaveBoard,
  getBoardParticipantIds,
  getBoardMessages,
  sendBoardMessage,
  getUser,
} from "@/lib/repository";
import type { Board, BoardMessage, User } from "@/lib/types";

export default function BoardPage() {
  const { currentUser, mode } = useSession();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // 募集一覧を取得
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    getBoards(mode)
      .then((data) => setBoards(data))
      .catch((error) => console.error("募集一覧取得エラー:", error))
      .finally(() => setLoading(false));
  }, [currentUser, mode]);

  // フィルタリング
  const filteredBoards = showOnlyActive
    ? boards.filter((b) => b.status === "募集中")
    : boards;

  if (!currentUser) {
    return <div>ログインしてください</div>;
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <PageHeading
        title="募集"
        description={
          mode === "work"
            ? "プロジェクトメンバーや協力者を募集できます"
            : "趣味仲間やイベント参加者を募集できます"
        }
      />

      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "32px",
          marginBottom: "24px",
        }}
      >
        {/* フィルター */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => setShowOnlyActive(true)}
            style={{
              padding: "8px 16px",
              backgroundColor: showOnlyActive ? "#3B82F6" : "#F3F4F6",
              color: showOnlyActive ? "#FFFFFF" : "#6B7280",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            募集中のみ
          </button>
          <button
            onClick={() => setShowOnlyActive(false)}
            style={{
              padding: "8px 16px",
              backgroundColor: !showOnlyActive ? "#3B82F6" : "#F3F4F6",
              color: !showOnlyActive ? "#FFFFFF" : "#6B7280",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            全て表示
          </button>
        </div>

        {/* 新規投稿ボタン */}
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: "12px 24px",
            background: "linear-gradient(to right, #3B82F6, #8B5CF6)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
          }}
        >
          + 新規投稿
        </button>
      </div>

      {/* 一覧表示 */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            marginTop: "80px",
            fontSize: "18px",
            color: "#666",
          }}
        >
          読み込み中...
        </div>
      ) : filteredBoards.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            marginTop: "80px",
            fontSize: "18px",
            color: "#666",
          }}
        >
          まだ募集がありません
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "24px",
          }}
        >
          {filteredBoards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onClick={() => setSelectedBoard(board)}
              currentUserId={currentUser.id}
            />
          ))}
        </div>
      )}

      {/* 投稿作成モーダル */}
      {showCreateModal && (
        <CreateBoardModal
          mode={mode}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newBoard) => {
            setBoards([newBoard, ...boards]);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* 詳細モーダル */}
      {selectedBoard && (
        <BoardDetailModal
          board={selectedBoard}
          currentUser={currentUser}
          onClose={() => setSelectedBoard(null)}
          onUpdated={(updatedBoard) => {
            setBoards((prev) =>
              prev.map((b) => (b.id === updatedBoard.id ? updatedBoard : b))
            );
            setSelectedBoard(updatedBoard);
          }}
          onDeleted={() => {
            setBoards((prev) => prev.filter((b) => b.id !== selectedBoard.id));
            setSelectedBoard(null);
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── 募集カード ─────────────────────────

function BoardCard({
  board,
  onClick,
  currentUserId,
}: {
  board: Board;
  onClick: () => void;
  currentUserId: string;
}) {
  const [participantCount, setParticipantCount] = useState(0);
  const [posterName, setPosterName] = useState("");

  useEffect(() => {
    getBoardParticipantIds(board.id).then((ids) => setParticipantCount(ids.length));
    getUser(board.userId).then((user) => {
      if (user) setPosterName(user.name);
    });
  }, [board.id, board.userId]);

  const isOwner = board.userId === currentUserId;
  const deadlineText = board.deadline
    ? new Date(board.deadline).toLocaleDateString("ja-JP")
    : "";

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
      }}
    >
      {/* ステータスバッジ */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "500",
            backgroundColor:
              board.status === "募集中" ? "#DBEAFE" : "#F3F4F6",
            color: board.status === "募集中" ? "#1E40AF" : "#6B7280",
          }}
        >
          {board.status}
        </span>
        {isOwner && (
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "500",
              backgroundColor: "#FEF3C7",
              color: "#92400E",
            }}
          >
            投稿者
          </span>
        )}
      </div>

      {/* タイトル */}
      <h3
        style={{
          margin: 0,
          fontSize: "20px",
          fontWeight: "bold",
          color: "#1E1B4B",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {board.title}
      </h3>

      {/* 説明文（冒頭のみ） */}
      <p
        style={{
          margin: 0,
          fontSize: "14px",
          color: "#6B7280",
          lineHeight: "1.6",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
        }}
      >
        {board.description}
      </p>

      {/* メタ情報 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: "13px",
          color: "#6B7280",
        }}
      >
        <div>👤 {posterName}</div>
        <div>
          👥 参加者: {participantCount}
          {board.maxParticipants && ` / ${board.maxParticipants}`}人
        </div>
        {deadlineText && <div>📅 期限: {deadlineText}</div>}
      </div>
    </div>
  );
}

// ───────────────────────── 投稿作成モーダル ─────────────────────────

function CreateBoardModal({
  mode,
  onClose,
  onCreated,
}: {
  mode: "work" | "romance";
  onClose: () => void;
  onCreated: (board: Board) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      alert("タイトルと説明を入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const board = await createBoard({
        mode,
        title: title.trim(),
        description: description.trim(),
        maxParticipants,
        deadline: deadline || null,
      });
      onCreated(board);
    } catch (error) {
      console.error("投稿作成エラー:", error);
      alert("投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 24px 0", fontSize: "24px", fontWeight: "bold" }}>
          新規募集を投稿
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* タイトル */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              タイトル <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: プロジェクトメンバー募集"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "16px",
              }}
            />
          </div>

          {/* 説明 */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              説明 <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="募集の詳細を入力してください"
              rows={6}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "16px",
                resize: "vertical",
              }}
            />
          </div>

          {/* 募集人数 */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              募集人数（任意）
            </label>
            <input
              type="number"
              min="1"
              value={maxParticipants ?? ""}
              onChange={(e) =>
                setMaxParticipants(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="無制限"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "16px",
              }}
            />
          </div>

          {/* 期限 */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              募集期限（任意）
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "16px",
              }}
            />
          </div>

          {/* ボタン */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                padding: "12px 24px",
                backgroundColor: "#F3F4F6",
                color: "#374151",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(to right, #3B82F6, #8B5CF6)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                cursor: submitting ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "500",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "投稿中..." : "投稿する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 詳細モーダル ─────────────────────────

function BoardDetailModal({
  board,
  currentUser,
  onClose,
  onUpdated,
  onDeleted,
}: {
  board: Board;
  currentUser: User;
  onClose: () => void;
  onUpdated: (board: Board) => void;
  onDeleted: () => void;
}) {
  const [participants, setParticipants] = useState<User[]>([]);
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isParticipant, setIsParticipant] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwner = board.userId === currentUser.id;

  // 参加者とメッセージを取得
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getBoardParticipantIds(board.id).then(async (ids) => {
        const users = await Promise.all(ids.map((id) => getUser(id)));
        return users.filter((u): u is User => u !== null);
      }),
      getBoardMessages(board.id),
    ])
      .then(([users, msgs]) => {
        setParticipants(users);
        setMessages(msgs);
        setIsParticipant(users.some((u) => u.id === currentUser.id));
      })
      .catch((error) => console.error("データ取得エラー:", error))
      .finally(() => setLoading(false));
  }, [board.id, currentUser.id]);

  // メッセージをポーリング
  useEffect(() => {
    if (!isParticipant) return;

    const interval = setInterval(() => {
      getBoardMessages(board.id)
        .then(setMessages)
        .catch((error) => console.error("メッセージ取得エラー:", error));
    }, 3000);

    return () => clearInterval(interval);
  }, [board.id, isParticipant]);

  const handleJoin = async () => {
    try {
      await joinBoard(board.id, currentUser.id);
      setParticipants([...participants, currentUser]);
      setIsParticipant(true);
    } catch (error) {
      console.error("参加エラー:", error);
      alert("参加に失敗しました");
    }
  };

  const handleLeave = async () => {
    if (!confirm("この募集から退出しますか？")) return;

    try {
      await leaveBoard(board.id, currentUser.id);
      setParticipants(participants.filter((p) => p.id !== currentUser.id));
      setIsParticipant(false);
    } catch (error) {
      console.error("退出エラー:", error);
      alert("退出に失敗しました");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const message = await sendBoardMessage(board.id, currentUser.id, newMessage.trim());
      setMessages([...messages, message]);
      setNewMessage("");
    } catch (error) {
      console.error("メッセージ送信エラー:", error);
      alert("メッセージ送信に失敗しました");
    }
  };

  const handleCloseRecruitment = async () => {
    if (!confirm("募集を終了しますか？")) return;

    try {
      await updateBoard(board.id, { status: "募集終了" });
      onUpdated({ ...board, status: "募集終了" });
    } catch (error) {
      console.error("募集終了エラー:", error);
      alert("募集終了に失敗しました");
    }
  };

  const handleDelete = async () => {
    if (!confirm("この募集を削除しますか？参加者のデータも全て削除されます。")) return;

    try {
      await deleteBoard(board.id);
      onDeleted();
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "0",
          maxWidth: "900px",
          width: "95%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: "500",
                  backgroundColor:
                    board.status === "募集中" ? "#DBEAFE" : "#F3F4F6",
                  color: board.status === "募集中" ? "#1E40AF" : "#6B7280",
                }}
              >
                {board.status}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
              {board.title}
            </h2>
            <p
              style={{
                margin: "12px 0 0 0",
                fontSize: "14px",
                color: "#6B7280",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
              }}
            >
              {board.description}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "24px",
              color: "#6B7280",
            }}
          >
            ×
          </button>
        </div>

        {/* 参加者一覧 */}
        <div style={{ padding: "20px 32px", borderBottom: "1px solid #E5E7EB" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: "500",
              color: "#374151",
              marginBottom: "12px",
            }}
          >
            参加者 ({participants.length}
            {board.maxParticipants && ` / ${board.maxParticipants}`}人)
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {participants.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  backgroundColor: "#F3F4F6",
                  borderRadius: "12px",
                }}
              >
                <img
                  src={p.avatarUrl}
                  alt=""
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
                <span style={{ fontSize: "14px", color: "#374151" }}>
                  {p.name}
                  {p.id === board.userId && " (投稿者)"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* グループチャット */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6B7280",
              }}
            >
              読み込み中...
            </div>
          ) : !isParticipant ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                padding: "40px",
              }}
            >
              <p style={{ margin: 0, fontSize: "16px", color: "#6B7280" }}>
                参加するとグループチャットが利用できます
              </p>
              {board.status === "募集中" && (
                <button
                  onClick={handleJoin}
                  style={{
                    padding: "12px 32px",
                    background: "linear-gradient(to right, #3B82F6, #8B5CF6)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "600",
                  }}
                >
                  参加する
                </button>
              )}
            </div>
          ) : (
            <>
              {/* メッセージ一覧 */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {messages.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#9CA3AF",
                      fontSize: "14px",
                    }}
                  >
                    まだメッセージがありません
                  </div>
                ) : (
                  messages.map((msg) => {
                    const sender = participants.find((p) => p.id === msg.userId);
                    const isMine = msg.userId === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "start",
                        }}
                      >
                        <img
                          src={sender?.avatarUrl}
                          alt=""
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#6B7280",
                              marginBottom: "4px",
                            }}
                          >
                            {sender?.name}
                            {msg.userId === board.userId && " (投稿者)"}
                            <span style={{ marginLeft: "8px" }}>
                              {new Date(msg.createdAt).toLocaleTimeString("ja-JP", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div
                            style={{
                              padding: "10px 14px",
                              backgroundColor: isMine ? "#EEF2FF" : "#F3F4F6",
                              borderRadius: "12px",
                              fontSize: "14px",
                              color: "#374151",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {msg.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* メッセージ入力 */}
              <div
                style={{
                  padding: "16px 32px",
                  borderTop: "1px solid #E5E7EB",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="メッセージを入力..."
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(to right, #3B82F6, #8B5CF6)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    cursor: newMessage.trim() ? "pointer" : "not-allowed",
                    fontSize: "14px",
                    fontWeight: "500",
                    opacity: newMessage.trim() ? 1 : 0.5,
                  }}
                >
                  送信
                </button>
              </div>
            </>
          )}
        </div>

        {/* フッター（アクション） */}
        <div
          style={{
            padding: "16px 32px",
            borderTop: "1px solid #E5E7EB",
            display: "flex",
            gap: "12px",
            justifyContent: isOwner ? "space-between" : "flex-end",
          }}
        >
          {isOwner ? (
            <>
              <div style={{ display: "flex", gap: "8px" }}>
                {board.status === "募集中" && (
                  <button
                    onClick={handleCloseRecruitment}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#FEF3C7",
                      color: "#92400E",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    募集終了
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#FEE2E2",
                    color: "#991B1B",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  削除
                </button>
              </div>
            </>
          ) : (
            isParticipant && (
              <button
                onClick={handleLeave}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#F3F4F6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                退出する
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
