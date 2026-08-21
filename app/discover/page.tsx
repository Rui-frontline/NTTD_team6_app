"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { useSession } from "@/lib/session";
import { getUsers, likeUser, passUser } from "@/lib/repository";
import type { User } from "@/lib/types";
import type { DiscoverFilter } from "@/lib/repository";
import { TAG_OPTIONS } from "@/lib/types";

export default function DiscoverPage() {
  const { currentUser, mode } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  // 成立したマッチの id。「トークを見に行く」でこの会話を直接開くために持つ
  const [matchedMatchId, setMatchedMatchId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DiscoverFilter>({});
  const [showFilter, setShowFilter] = useState(false);
  const [showDetailProfile, setShowDetailProfile] = useState(false);
  const [testMode, setTestMode] = useState(false); // テストモード（初期値OFF、必要時はコードで変更）

  // 現在表示中のユーザー
  const currentUser_displayed = users[currentIndex] || null;

  // ユーザー一覧を取得
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    setCurrentIndex(0); // モードやフィルター変更時は最初から
    getUsers(mode, currentUser.id, filter)
      .then((data) => setUsers(data))
      .catch((error) => console.error("ユーザー取得エラー:", error))
      .finally(() => setLoading(false));
  }, [currentUser, mode, filter]);

  // 次のユーザーに進む
  const goToNextUser = () => {
    setCurrentIndex((prev) => {
      // テストモード中は最後まで行ったら最初に戻る
      if (testMode && prev + 1 >= users.length) {
        return 0;
      }
      return prev + 1;
    });
  };

  // いいねボタンの処理
  const handleLike = async (targetUser: User) => {
    if (!currentUser) return;

    // テストモード：DBに保存せず次に進むだけ
    if (testMode) {
      goToNextUser();
      return;
    }

    try {
      const match = await likeUser(currentUser.id, targetUser.id, mode);

      // マッチ成立の確認
      if (match) {
        console.log("マッチ成立！", match);
        // モーダルを表示
        setMatchedUser(targetUser);
        setMatchedMatchId(match.id);
      }

      // 次のユーザーに進む
      goToNextUser();
    } catch (error) {
      console.error("いいね送信エラー:", error);
      alert("いいねの送信に失敗しました");
    }
  };

  // 見送るボタンの処理
  const handlePass = async (targetUser: User) => {
    if (!currentUser) return;

    // テストモード：DBに保存せず次に進むだけ
    if (testMode) {
      goToNextUser();
      return;
    }

    try {
      // 恋愛モードの場合のみDBに保存
      if (mode === "romance") {
        await passUser(currentUser.id, targetUser.id, mode);
      }
      // 仕事モードの場合は保存しない（リロードで戻る）

      // 次のユーザーに進む
      goToNextUser();
    } catch (error) {
      console.error("見送りエラー:", error);
      alert("見送りに失敗しました");
    }
  };

  if (!currentUser) {
    return <div>ログインしてください</div>;
  }

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <>
      {/* 見出しはコンテナの外に置く。中に入れるとコンテナの上下 padding のぶん
          下がってしまい、トーク・マイページと縦位置が揃わないため */}
      <PageHeading
        title="あなたにおすすめ"
        description="あなたにおすすめの人を紹介します。"
      />

    {/* 背景色は指定しない。モードで切り替わる地の色（globals.css の
        --background）をそのまま使い、他の画面と揃えるため */}
    {/* paddingTop は 60px から詰めている。右上の操作ボタンは absolute で
        top: 20px に置かれているため、画面幅によってはカードと重なるが、
        重なるのはテストモードなど開発用のボタンなので許容している */}
    <div style={{
      display: "flex",
      flexDirection: "column",
      padding: "20px 0 60px",
      position: "relative",
    }}>
      {/* フィルターボタン（右上） */}
      <button
        onClick={() => setShowFilter(true)}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "10px 20px",
          backgroundColor: "#FFFFFF",
          color: "#374151",
          border: "1px solid #E5E7EB",
          borderRadius: "20px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
        }}
      >
        フィルター
      </button>

      {currentUser_displayed ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}>
          {/* 写真とプロフィール */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
          }}>
            {/* 左：写真カード */}
            <div style={{
              width: "300px",
              height: "500px",
              backgroundColor: "#FFFFFF",
              borderRadius: "28px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <img
                src={currentUser_displayed.avatarUrl}
                alt={currentUser_displayed.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>

            {/* 右：プロフィールカード */}
            <div style={{
              width: "600px",
              height: "500px",
              backgroundColor: "#FFFFFF",
              borderRadius: "28px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
              padding: "32px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              flexShrink: 0,
            }}>
              {/* 名前 */}
              <h1 style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: "bold",
                color: "#1E1B4B",
              }}>
                {currentUser_displayed.name}
              </h1>

              {/* 基本情報 */}
              <p style={{
                margin: 0,
                fontSize: "16px",
                color: "#6B7280",
              }}>
                {/* 恋愛モードで部署を隠す設定を確認 */}
                {mode === "romance" && !currentUser_displayed.romance.showDepartment
                  ? currentUser_displayed.jobTitle
                  : `${currentUser_displayed.department} / ${currentUser_displayed.jobTitle}`}
              </p>

              {/* 区切り線 */}
              <div style={{ height: "1px", backgroundColor: "#E5E7EB" }} />

              {/* 年齢（恋愛モードのみ） */}
              {mode === "romance" && (
                <div>
                  <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "bold", color: "#1E1B4B" }}>
                    年齢
                  </p>
                  <p style={{ margin: 0, fontSize: "16px", color: "#374151" }}>
                    {currentUser_displayed.age}歳
                  </p>
                </div>
              )}

              {/* タグ */}
              <div>
                <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "bold", color: "#1E1B4B" }}>
                  タグ
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {(mode === "work" ? currentUser_displayed.work.tags : currentUser_displayed.romance.tags).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "6px 16px",
                        backgroundColor: "#EEF2FF",
                        color: "#4F46E5",
                        borderRadius: "20px",
                        fontSize: "14px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* 区切り線 */}
              <div style={{ height: "1px", backgroundColor: "#E5E7EB" }} />

              {/* 自己紹介 */}
              <div>
                <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "bold", color: "#1E1B4B" }}>
                  自己紹介
                </p>
                <p style={{
                  margin: 0,
                  fontSize: "15px",
                  color: "#374151",
                  lineHeight: "1.7",
                  whiteSpace: "pre-wrap",
                }}>
                  {/* 冒頭100文字のみ表示 */}
                  {(mode === "work" ? currentUser_displayed.work.bio : currentUser_displayed.romance.bio).slice(0, 100)}
                  {(mode === "work" ? currentUser_displayed.work.bio : currentUser_displayed.romance.bio).length > 100 && "..."}
                </p>
              </div>

              {/* 詳細プロフィールを見るボタン */}
              <button
                onClick={() => setShowDetailProfile(true)}
                style={{
                  marginTop: "auto",
                  padding: "12px 0",
                  backgroundColor: "transparent",
                  color: "#4F46E5",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  textDecoration: "underline",
                }}
              >
                詳細プロフィールを見る →
              </button>
            </div>
          </div>

          {/* ボタン */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
          }}>
            <button
              onClick={() => handlePass(currentUser_displayed)}
              style={{
                width: "200px",
                height: "56px",
                backgroundColor: "#FFFFFF",
                color: "#374151",
                border: "1px solid #E5E7EB",
                borderRadius: "28px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
              }}
            >
              ✕ 見送る
            </button>
            <button
              onClick={() => handleLike(currentUser_displayed)}
              style={{
                width: "200px",
                height: "56px",
                background: "linear-gradient(to right, #3B82F6, #8B5CF6)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "28px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              }}
            >
              ♡ いいね
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          color: "#666",
        }}>
          {users.length === 0 ? "ユーザーが見つかりませんでした" : "全てのユーザーを確認しました"}
        </div>
      )}

      {/* フィルターパネル（右からスライドイン） */}
      {showFilter && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          }}
          onClick={() => setShowFilter(false)}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: "400px",
              backgroundColor: "white",
              padding: "20px",
              overflowY: "auto",
              boxShadow: "-2px 0 10px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>フィルター</h2>
              <button
                onClick={() => setShowFilter(false)}
                style={{
                  padding: "5px 15px",
                  backgroundColor: "#ccc",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                閉じる
              </button>
            </div>

            {/* 仕事モードのフィルター */}
            {mode === "work" && (
              <>
                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>部署:</strong>
                    <input
                      type="text"
                      placeholder="例: 開発部"
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        setFilter((prev) => ({
                          ...prev,
                          departments: value ? [value] : undefined,
                        }));
                      }}
                      style={{ marginTop: "5px", padding: "8px", width: "100%", boxSizing: "border-box" }}
                    />
                  </label>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>職種:</strong>
                    <input
                      type="text"
                      placeholder="例: エンジニア"
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        setFilter((prev) => ({
                          ...prev,
                          jobTitles: value ? [value] : undefined,
                        }));
                      }}
                      style={{ marginTop: "5px", padding: "8px", width: "100%", boxSizing: "border-box" }}
                    />
                  </label>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>タグ:</strong>
                    <select
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilter((prev) => ({
                          ...prev,
                          tags: value ? [value] : undefined,
                        }));
                      }}
                      style={{ marginTop: "5px", padding: "8px", width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="">すべて</option>
                      {TAG_OPTIONS.work.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            {/* 恋愛モードのフィルター */}
            {mode === "romance" && (
              <>
                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>年齢:</strong>
                    <div style={{ marginTop: "5px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="number"
                        placeholder="最小"
                        onChange={(e) => {
                          const value = e.target.value;
                          setFilter((prev) => ({
                            ...prev,
                            minAge: value ? Number(value) : undefined,
                          }));
                        }}
                        style={{ padding: "8px", width: "80px" }}
                      />
                      <span>〜</span>
                      <input
                        type="number"
                        placeholder="最大"
                        onChange={(e) => {
                          const value = e.target.value;
                          setFilter((prev) => ({
                            ...prev,
                            maxAge: value ? Number(value) : undefined,
                          }));
                        }}
                        style={{ padding: "8px", width: "80px" }}
                      />
                      <span>歳</span>
                    </div>
                  </label>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>タグ:</strong>
                    <select
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilter((prev) => ({
                          ...prev,
                          tags: value ? [value] : undefined,
                        }));
                      }}
                      style={{ marginTop: "5px", padding: "8px", width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="">すべて</option>
                      {TAG_OPTIONS.romance.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            <button
              onClick={() => {
                setFilter({});
                setShowFilter(false);
              }}
              style={{
                padding: "10px 20px",
                backgroundColor: "#ccc",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px",
                width: "100%",
              }}
            >
              フィルターをクリア
            </button>
          </div>
        </div>
      )}

      {/* 詳細プロフィールモーダル */}
      {showDetailProfile && currentUser_displayed && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowDetailProfile(false)}
        >
          <div
            style={{
              width: "900px",
              maxHeight: "90vh",
              backgroundColor: "#FFFFFF",
              borderRadius: "28px",
              padding: "40px",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
              <button
                onClick={() => setShowDetailProfile(false)}
                style={{
                  padding: "8px 20px",
                  backgroundColor: "#F3F4F6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "20px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                閉じる
              </button>
            </div>

            {/* 写真とプロフィールを横並び */}
            <div style={{ display: "flex", gap: "32px" }}>
              {/* 写真 */}
              <div style={{ width: "300px", flexShrink: 0 }}>
                <img
                  src={currentUser_displayed.avatarUrl}
                  alt={currentUser_displayed.name}
                  style={{
                    width: "100%",
                    aspectRatio: "3/4",
                    objectFit: "cover",
                    borderRadius: "20px",
                  }}
                />
              </div>

              {/* 詳細情報 */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* 名前 */}
                <h1 style={{
                  margin: 0,
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#1E1B4B",
                }}>
                  {currentUser_displayed.name}
                </h1>

                {/* 基本情報 */}
                <div>
                  <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "bold", color: "#1E1B4B" }}>
                    基本情報
                  </p>
                  {/* 恋愛モードで部署を隠す設定を確認 */}
                  {!(mode === "romance" && !currentUser_displayed.romance.showDepartment) && (
                    <p style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>
                      部署: {currentUser_displayed.department}
                    </p>
                  )}
                  <p style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>
                    職種: {currentUser_displayed.jobTitle}
                  </p>
                  {mode === "romance" && (
                    <p style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>
                      年齢: {currentUser_displayed.age}歳
                    </p>
                  )}
                </div>

                {/* 区切り線 */}
                <div style={{ height: "1px", backgroundColor: "#E5E7EB" }} />

                {/* タグ */}
                <div>
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "bold", color: "#1E1B4B" }}>
                    タグ
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(mode === "work" ? currentUser_displayed.work.tags : currentUser_displayed.romance.tags).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: "8px 20px",
                          backgroundColor: "#EEF2FF",
                          color: "#4F46E5",
                          borderRadius: "20px",
                          fontSize: "15px",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 区切り線 */}
                <div style={{ height: "1px", backgroundColor: "#E5E7EB" }} />

                {/* 自己紹介 */}
                <div>
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "bold", color: "#1E1B4B" }}>
                    自己紹介
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: "16px",
                    color: "#374151",
                    lineHeight: "1.8",
                    whiteSpace: "pre-wrap",
                  }}>
                    {mode === "work" ? currentUser_displayed.work.bio : currentUser_displayed.romance.bio}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* マッチ成立モーダル */}
      {matchedUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            animation: "fadeIn 0.3s ease-in-out",
          }}
          onClick={() => {
            setMatchedUser(null);
            setMatchedMatchId(null);
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              padding: "40px",
              borderRadius: "28px",
              maxWidth: "650px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
              animation: "scaleIn 0.3s ease-in-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 見出し */}
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <h2
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "#1E1B4B",
                }}
              >
                マッチ成立！
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#6B7280",
                }}
              >
                相互にいいねが送られました
              </p>
            </div>

            {/* 写真と情報を横並び */}
            <div style={{
              display: "flex",
              gap: "28px",
              marginBottom: "36px",
              alignItems: "center"
            }}>
              {/* 左：写真 */}
              <div
                style={{
                  width: "160px",
                  height: "160px",
                  flexShrink: 0,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid #EEF2FF",
                  boxShadow: "0 4px 12px rgba(79, 70, 229, 0.15)",
                }}
              >
                <img
                  src={matchedUser.avatarUrl}
                  alt={matchedUser.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>

              {/* 右：情報 */}
              <div style={{ flex: 1 }}>
                {/* 相手の名前 */}
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#1E1B4B",
                  }}
                >
                  {matchedUser.name}
                </h3>

                {/* 部署・職種 */}
                <p
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    color: "#6B7280",
                  }}
                >
                  {matchedUser.department} / {matchedUser.jobTitle}
                </p>

                {/* メッセージ */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#374151",
                    lineHeight: "1.6",
                  }}
                >
                  トーク画面でメッセージを送ってみましょう
                </p>
              </div>
            </div>

            {/* ボタン */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => {
                  setMatchedUser(null);
                  setMatchedMatchId(null);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#FFFFFF",
                  color: "#374151",
                  border: "1px solid #E5E7EB",
                  borderRadius: "28px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                }}
              >
                後で
              </button>
              <button
                onClick={() => {
                  // 成立した会話を開いた状態でトーク画面へ。
                  // window.location.href だとページ全体が再読み込みされ、
                  // ログイン状態の復元からやり直しになるので router.push を使う。
                  router.push(
                    matchedMatchId ? `/talk?match=${matchedMatchId}` : "/talk",
                  );
                }}
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(to right, #3B82F6, #8B5CF6)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "28px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                }}
              >
                トークを開く
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes scaleIn {
              from {
                opacity: 0;
                transform: scale(0.9);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
    </>
  );
}
