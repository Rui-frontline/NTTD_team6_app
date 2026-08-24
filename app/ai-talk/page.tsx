"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ModeSwitch } from "@/components/ModeSwitch";
import { useSession } from "@/lib/session";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function AiTalkPage() {
  const router = useRouter();
  const { currentUser, mode } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // モード変更時にメッセージをクリア
  useEffect(() => {
    setMessages([]);
  }, [mode]);

  if (!currentUser) {
    router.push("/login");
    return null;
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // TODO: ここにClaude API呼び出しを実装
      // 以下はダミーの応答です。実際のAPI呼び出しに置き換えてください。

      // const response = await fetch("/api/ai-talk", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     mode,
      //     messages: [...messages, userMessage].map(m => ({
      //       role: m.role,
      //       content: m.content,
      //     })),
      //   }),
      // });

      // const data = await response.json();
      // const aiMessage: Message = {
      //   role: "assistant",
      //   content: data.content,
      //   timestamp: new Date(),
      // };

      // ダミーの応答（実装時に削除してください）
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const aiMessage: Message = {
        role: "assistant",
        content:
          mode === "romance"
            ? "こんにちは！楽しくお話ししましょう。（※これはダミーの応答です。Claude APIを実装してください）"
            : "お疲れ様です。ビジネスについてお話しましょう。（※これはダミーの応答です。Claude APIを実装してください）",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI応答エラー:", error);
      alert("メッセージの送信に失敗しました");
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

  const getTitle = () => {
    return mode === "romance" ? "異性との会話練習" : "ビジネス会話練習";
  };

  const getDescription = () => {
    return mode === "romance"
      ? "AIと会話して、デートやカジュアルな会話の練習をしましょう"
      : "AIと会話して、ビジネスシーンでのコミュニケーションを練習しましょう";
  };

  // 恋愛モードがOFFの場合の表示
  if (mode === "romance" && !currentUser.enabledModes.includes("romance")) {
    return (
      <div className="flex h-screen w-full flex-col">
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

  return (
    <div className="flex h-screen w-full flex-col">
      {/* ヘッダー */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-6">
        <div>
          <h1 className="text-lg font-bold text-[var(--fg)]">{getTitle()}</h1>
          <p className="text-sm text-[var(--fg-muted)]">{getDescription()}</p>
        </div>
        <ModeSwitch />
      </header>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-6">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--fg)]">
                会話を始めましょう
              </p>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                下のメッセージ欄から話しかけてください
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
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
                <div className="max-w-[70%] rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3">
                  <p className="text-[var(--fg-muted)]">入力中...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div className="shrink-0 border-t border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[var(--card-border)] bg-[var(--bg)] px-4 py-3 text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
              style={{ minHeight: "48px", maxHeight: "120px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="rounded-xl bg-[var(--primary)] px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              送信
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)]">
            Enter で送信、Shift + Enter で改行
          </p>
        </div>
      </div>
    </div>
  );
}
