import { createClient } from "@supabase/supabase-js";

// Supabase への接続。アプリ全体でこの1つを使い回す。
//
// 環境変数は .env.local に置く（コミットしないこと）。
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Supabase の環境変数が設定されていません。" +
      ".env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を書いてください。",
  );
}

export const supabase = createClient(url, publishableKey);
