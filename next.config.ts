import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中だけ左下に出る Next.js のインジケーター（Nのボタン）を消す。
  // ルート情報や設定を見るための開発用の機能で、本番には出ない。
  // コンパイルエラーや実行時エラーの表示は false にしても残る。
  devIndicators: false,
};

export default nextConfig;
