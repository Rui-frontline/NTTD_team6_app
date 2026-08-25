import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// シチュエーション別のシステムプロンプト
const SITUATION_PROMPTS: Record<string, string> = {
  // 恋愛モード
  first_date: `あなたは初デートの相手です。明るく、楽しい会話を心がけてください。相手のことを知りたがり、共通の趣味や話題を見つけようとします。適度に質問を返し、会話を盛り上げてください。`,
  second_date: `あなたは2回目のデートの相手です。前回よりも少し打ち解けた雰囲気で、より深い話題にも触れます。相手の価値観や将来のことにも興味を示してください。`,
  confession: `あなたは告白されるかもしれない状況にいる相手です。相手の気持ちを真摯に受け止め、誠実に応答してください。プレッシャーをかけすぎず、自然な会話を心がけます。`,

  // 仕事モード
  business_negotiation: `あなたは商談相手のクライアントです。自社のニーズを持ちつつも、良い提案には興味を示します。具体的な質問をし、メリットを確認します。プロフェッショナルな態度を保ってください。`,
  presentation: `あなたは社内プレゼンを聞く上司または同僚です。提案内容について質問し、不明点を確認します。建設的なフィードバックを提供してください。`,
  report_to_boss: `あなたは部下から報告を受ける上司です。進捗状況を理解し、必要に応じて指示やアドバイスを出します。簡潔で的確なコミュニケーションを心がけてください。`,
};

export async function POST(request: NextRequest) {
  try {
    // Claude を呼ぶ前に送り主を確かめる。ここを通さないと、URLを知っている
    // だけの第三者に ANTHROPIC_API_KEY を使わせることになる
    const auth = await verifyRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { situation, messages } = body;

    if (!situation || !messages) {
      return NextResponse.json(
        { error: "situation and messages are required" },
        { status: 400 }
      );
    }

    const systemPrompt = SITUATION_PROMPTS[situation] || "";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    });

    const content = response.content[0];
    if (content.type === "text") {
      return NextResponse.json({ content: content.text });
    }

    return NextResponse.json(
      { error: "Unexpected response type" },
      { status: 500 }
    );
  } catch (error) {
    console.error("AI Talk Error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
