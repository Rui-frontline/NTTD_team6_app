// API ルートの呼び出し元を確かめる。
//
// /api/ai-talk は公開URLなので、ログインしていない第三者からも POST できる。
// その先で Claude を呼ぶ＝従量課金が発生するため、サーバー側で「うちの
// ログイン済みユーザーか」を確かめてから通す。
//
// このアプリのログイン状態はブラウザの中（localStorage）にしか無く、
// Cookie も @supabase/ssr も使っていないので、サーバーからは見えない。
// そこで呼ぶ側が Authorization ヘッダにアクセストークンを載せ、ここで
// Supabase に問い合わせて本物か確かめる。
//
// JWT を自前で検証しない。署名や失効の判定は Supabase に任せる。

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Supabase の環境変数が設定されていません。" +
      ".env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を書いてください。",
  );
}

// 検証専用のクライアント。
//
// lib/supabase.ts のものはブラウザ用でセッションを保持するため、サーバーで
// 使い回すとリクエストをまたいで状態が混ざる恐れがある。ここは毎回トークンを
// 引数で渡すだけなので、保持も自動更新もしない。
const verifier = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false };

/**
 * リクエストの Authorization ヘッダを検証する。
 *
 * 通らない理由（ヘッダが無い／形式が違う／期限切れ／偽造）は区別せず、
 * まとめて `{ ok: false }` を返す。呼ぶ側は 401 を返すだけでよく、
 * 攻撃者にどこで弾かれたかの手がかりを渡さずに済む。
 *
 * Supabase 自体に繋がらない場合はここで例外が飛ぶ。認証の失敗ではなく
 * 障害なので、401 ではなく 500 として扱いたい。呼ぶ側の try で拾う。
 */
export async function verifyRequest(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return { ok: false };

  const token = header.slice("Bearer ".length).trim();
  if (token === "") return { ok: false };

  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) return { ok: false };

  return { ok: true, userId: data.user.id };
}
