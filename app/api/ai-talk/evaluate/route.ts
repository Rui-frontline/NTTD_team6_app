import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EVALUATION_PROMPT = `あなたは会話スキルの評価者です。提供された会話履歴を分析し、以下の形式でJSON形式で評価を返してください。

評価基準：
1. 質問力（0-100点）: 相手に興味を持ち、適切な質問をしているか
2. 共感力（0-100点）: 相手の気持ちに寄り添い、理解を示しているか
3. 会話の広げ方（0-100点）: 話題を自然に展開し、会話を深められているか

必ず以下のJSON形式で返してください：
{
  "overall_score": 総合点（0-100の整数）,
  "scores": {
    "質問力": 点数（0-100の整数）,
    "共感力": 点数（0-100の整数）,
    "会話の広げ方": 点数（0-100の整数）
  },
  "good_points": ["良かった点1", "良かった点2", "良かった点3"],
  "improvements": ["改善点1", "改善点2"]
}`;

export async function POST(request: NextRequest) {
  try {
    // 評価も Claude を呼ぶので、対話側と同じく送り主を確かめる
    const auth = await verifyRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "messages are required" },
        { status: 400 }
      );
    }

    // 会話履歴を整形
    const conversationText = messages
      .map((m: { role: string; content: string }) => {
        const speaker = m.role === "user" ? "ユーザー" : "AI";
        return `${speaker}: ${m.content}`;
      })
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: EVALUATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下の会話を評価してください：\n\n${conversationText}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      // JSONを抽出
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evaluation = JSON.parse(jsonMatch[0]);
        return NextResponse.json(evaluation);
      }
    }

    return NextResponse.json(
      { error: "Failed to parse evaluation" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Evaluation Error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate conversation" },
      { status: 500 }
    );
  }
}
