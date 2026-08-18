import { TalkScreen } from "@/components/TalkScreen";

export default async function TalkPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string | string[] }>;
}) {
  // 「探す」画面でマッチが成立したときに ?match=<id> で飛んでくる。
  // 同じ id が2回来ることは無いが、URL は手で書き換えられるので配列も受ける。
  const { match } = await searchParams;
  const initialMatchId = (Array.isArray(match) ? match[0] : match) ?? null;

  return <TalkScreen initialMatchId={initialMatchId} />;
}
