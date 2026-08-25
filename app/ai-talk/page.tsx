"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ModeSwitch } from "@/components/ModeSwitch";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * ログイン中のアクセストークン。
 *
 * 送信のたびに取り直す。画面を開いた時点のものを使い回すと、長く開いたまま
 * にした場合に期限切れのトークンを送ってしまう。getSession() は期限が近ければ
 * 更新してから返す。
 */
async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** 画面に出す不具合の種類。原因ごとに文面と対処を変えるために区別する */
type Notice = "session" | "failed";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type Situation = {
  id: string;
  label: string;
  description: string;
};

const ROMANCE_SITUATIONS: Situation[] = [
  {
    id: "first_date",
    label: "初デート",
    description: "初めてのデートでの会話。相手のことを知り、楽しい時間を過ごしましょう",
  },
  {
    id: "second_date",
    label: "2回目のデート",
    description: "2回目のデート。前回より距離を縮めて、より深い話をしてみましょう",
  },
  {
    id: "confession",
    label: "告白",
    description: "気持ちを伝えるシーン。誠実に、相手の気持ちも考えながら話しましょう",
  },
];

const WORK_SITUATIONS: Situation[] = [
  {
    id: "business_negotiation",
    label: "商談",
    description: "クライアントとの商談。相手のニーズを理解し、提案を進めましょう",
  },
  {
    id: "presentation",
    label: "プレゼン",
    description: "社内プレゼン。要点を明確に伝え、質疑応答に対応しましょう",
  },
  {
    id: "report_to_boss",
    label: "上司への報告",
    description: "上司への進捗報告。簡潔に状況を説明し、判断を仰ぎましょう",
  },
];

export default function AiTalkPage() {
  const router = useRouter();
  const { currentUser, mode } = useSession();
  const [selectedSituation, setSelectedSituation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    overall_score: number;
    scores: { [key: string]: number };
    good_points: string[];
    improvements: string[];
  } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // モード変更時にシチュエーション選択とメッセージをリセット
  useEffect(() => {
    setSelectedSituation(null);
    setMessages([]);
    setTurnCount(0);
    setShowEvaluation(false);
    setEvaluation(null);
    setNotice(null);
  }, [mode]);

  if (!currentUser) {
    router.push("/login");
    return null;
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // 身分証を先に用意する。画面の状態を変える前に確かめるので、期限切れの
    // ときに「自分の発言だけ増えて返事が来ない」状態にならない
    const token = await accessToken();
    if (!token) {
      setNotice("session");
      return;
    }
    setNotice(null);

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // ターンカウントを増やす
    const newTurnCount = turnCount + 1;
    setTurnCount(newTurnCount);

    try {
      const response = await fetch("/api/ai-talk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          situation: selectedSituation,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      // 401 だけは他の失敗と切り分ける。再読み込みで直る不具合なのか、
      // 手の打ちようがない障害なのかが画面から分かるようにするため
      if (response.status === 401) {
        setNotice("session");
        return;
      }

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();
      const aiMessage: Message = {
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // 10ターンに達したら評価を取得
      if (newTurnCount >= 10) {
        const evalResponse = await fetch("/api/ai-talk/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage, aiMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (evalResponse.ok) {
          const evalData = await evalResponse.json();
          setEvaluation(evalData);
        } else {
          // 評価が取れないと点数が「...」のまま止まる。理由を出さないと
          // 待てば出るのか壊れているのかが分からない
          setNotice(evalResponse.status === 401 ? "session" : "failed");
        }

        setShowEvaluation(true);
      }
    } catch (error) {
      console.error("AI応答エラー:", error);
      setNotice("failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSituations = () => {
    return mode === "romance" ? ROMANCE_SITUATIONS : WORK_SITUATIONS;
  };

  const getTitle = () => {
    if (!selectedSituation) {
      return mode === "romance" ? "異性との会話練習" : "ビジネス会話練習";
    }
    const situation = getSituations().find((s) => s.id === selectedSituation);
    return situation?.label || "";
  };

  const getDescription = () => {
    if (!selectedSituation) {
      return mode === "romance"
        ? "シチュエーションを選んで会話練習を始めましょう"
        : "シチュエーションを選んで会話練習を始めましょう";
    }
    const situation = getSituations().find((s) => s.id === selectedSituation);
    return situation?.description || "";
  };

  /*
    不具合を画面に出す帯。会話画面と評価画面の両方に置く。

    ここを黙って握りつぶすと、止まったときに「ログインし直せば直る」のか
    「Claude 側の障害で打つ手が無い」のかが区別できない。デモ中に原因を
    調べる時間は無いので、対処まで画面に書いておく。
  */
  const noticeBanner = notice ? (
    <div className="mx-auto mb-3 flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5">
      <p className="min-w-0 text-sm text-amber-900">
        {notice === "session"
          ? "ログインの有効期限が切れました。ページを再読み込みしてください。"
          : "AIの応答に失敗しました。時間をおいて、もう一度送信してください。"}
      </p>
      {notice === "session" ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-80"
        >
          再読み込み
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100"
        >
          閉じる
        </button>
      )}
    </div>
  ) : null;

  // 恋愛モードがOFFの場合の表示
  if (mode === "romance" && !currentUser.enabledModes.includes("romance")) {
    return (
      <div className="flex h-full w-full flex-col -mx-6 -my-8">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-6">
          <h1 className="text-lg font-bold text-[var(--fg)]">AI対話練習</h1>
          <ModeSwitch />
        </header>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
          }}
        >
          <p style={{ fontSize: "20px", color: "#374151", margin: 0 }}>
            恋愛機能はOFFです
          </p>
          <p style={{ fontSize: "16px", color: "#6B7280", margin: 0 }}>
            恋愛モードを利用するには、マイページで機能をONにしてください
          </p>
          <button
            onClick={() => router.push("/me")}
            style={{
              padding: "12px 32px",
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
            マイページで設定する
          </button>
        </div>
      </div>
    );
  }

  // シチュエーション選択画面
  if (!selectedSituation) {
    return (
      <div
        // 余白は両モード共通。仕事モード用に別の値を当てていたが、それは
        // PR #44 の AppShell の余白に合わせたもので、巻き戻した今は引きすぎて
        // 中身が左へずれ、サイドバーに潜り込む
        className="flex h-full w-full flex-col -mx-6 -my-8"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-6">
          <div>
            <h1 className="text-lg font-bold text-[var(--fg)]">{getTitle()}</h1>
            <p className="text-sm text-[var(--fg-muted)]">{getDescription()}</p>
          </div>
          <ModeSwitch />
        </header>
        <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-6">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-xl font-bold text-[var(--fg)]">
              シチュエーションを選択してください
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getSituations().map((situation) => (
                <button
                  key={situation.id}
                  onClick={() => setSelectedSituation(situation.id)}
                  className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-left transition-all hover:border-[var(--primary)] hover:shadow-lg"
                >
                  <h3 className="mb-2 text-lg font-bold text-[var(--fg)]">
                    {situation.label}
                  </h3>
                  <p className="text-sm text-[var(--fg-muted)]">
                    {situation.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 評価画面
  if (showEvaluation) {
    return (
      <div
        // 余白は両モード共通。仕事モード用に別の値を当てていたが、それは
        // PR #44 の AppShell の余白に合わせたもので、巻き戻した今は引きすぎて
        // 中身が左へずれ、サイドバーに潜り込む
        className="flex h-full w-full flex-col -mx-6 -my-8"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-6">
          <h1 className="text-lg font-bold text-[var(--fg)]">会話練習完了！</h1>
          <ModeSwitch />
        </header>
        <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-6">
          {noticeBanner}
          <div className="mx-auto max-w-3xl space-y-6">
            {/* 総合評価 */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
              <h2 className="mb-4 text-xl font-bold text-[var(--fg)]">
                総合評価
              </h2>
              <div className="mb-4 text-center">
                <div className="text-5xl font-bold text-[var(--primary)]">
                  {evaluation?.overall_score ?? "..."}点
                </div>
                {!evaluation && (
                  <p className="mt-2 text-sm text-[var(--fg-muted)]">
                    評価を取得中...
                  </p>
                )}
              </div>
            </div>

            {/* スコア詳細 */}
            {evaluation && (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
                <h2 className="mb-4 text-xl font-bold text-[var(--fg)]">
                  スコア詳細
                </h2>
                <div className="space-y-3">
                  {Object.entries(evaluation.scores).map(([label, score]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-[var(--fg)]">{label}</span>
                        <span className="font-bold text-[var(--fg)]">
                          {score}点
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg)]">
                        <div
                          className="h-full bg-[var(--primary)]"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 良かった点 */}
            {evaluation && evaluation.good_points.length > 0 && (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
                <h2 className="mb-4 text-xl font-bold text-[var(--fg)]">
                  良かった点
                </h2>
                <ul className="space-y-2 text-sm text-[var(--fg)]">
                  {evaluation.good_points.map((point, index) => (
                    <li key={index}>• {point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 改善点 */}
            {evaluation && evaluation.improvements.length > 0 && (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
                <h2 className="mb-4 text-xl font-bold text-[var(--fg)]">
                  改善できる点
                </h2>
                <ul className="space-y-2 text-sm text-[var(--fg)]">
                  {evaluation.improvements.map((point, index) => (
                    <li key={index}>• {point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setMessages([]);
                  setTurnCount(0);
                  setShowEvaluation(false);
                  setEvaluation(null);
                }}
                className="flex-1 rounded-xl bg-black py-3 font-bold text-white transition-opacity hover:opacity-80"
              >
                もう一度練習する
              </button>
              <button
                onClick={() => {
                  setSelectedSituation(null);
                  setMessages([]);
                  setTurnCount(0);
                  setShowEvaluation(false);
                  setEvaluation(null);
                }}
                className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] py-3 font-bold text-[var(--fg)] transition-colors hover:bg-[var(--bg)]"
              >
                シチュエーション変更
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      // 余白は両モード共通。仕事モード用に別の値を当てていたが、それは
      // PR #44 の AppShell の余白に合わせたもので、巻き戻した今は引きすぎて
      // 中身が左へずれ、サイドバーに潜り込む
      className="flex h-full w-full flex-col -mx-6 -my-8"
    >
      {/* ヘッダー */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-[var(--fg)]">{getTitle()}</h1>
            <span className="shrink-0 rounded-full bg-[var(--bg)] px-3 py-1 text-xs font-bold text-[var(--fg)]">
              {turnCount}/10
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedSituation(null);
              setMessages([]);
              setTurnCount(0);
              setShowEvaluation(false);
              setEvaluation(null);
            }}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] transition-colors hover:bg-[var(--bg)]"
          >
            変更
          </button>
          <ModeSwitch />
        </div>
      </header>

      {/* メッセージエリア */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg)] px-4 py-2">
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  message.role === "user"
                    ? "bg-black text-white"
                    : "bg-[var(--card-bg)] text-[var(--fg)] border border-[var(--card-border)]"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    message.role === "user"
                      ? "text-white/70"
                      : "text-[var(--fg-muted)]"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5">
                <p className="text-[var(--fg-muted)]">入力中...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 入力エリア */}
      <div className="shrink-0 border-t border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2">
        {noticeBanner}
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力... (Enter: 送信 / Shift+Enter: 改行)"
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[var(--card-border)] bg-[var(--bg)] px-3 py-2 text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
              style={{ minHeight: "40px", maxHeight: "80px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="rounded-xl bg-black px-5 py-2 font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
