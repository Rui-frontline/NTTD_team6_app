import { Placeholder } from "@/components/Placeholder";

export default function DiscoverPage() {
  return (
    <Placeholder
      title="探す"
      branch="feat/discover"
      note="左にユーザーカードのグリッド＋フィルター、カードをクリックすると右ペインに詳細（ページ遷移はしない）。repository の getUsers / likeUser / passUser を使ってください。見送るは恋愛モードだけ保存され、仕事モードはリロードで戻ります。"
    />
  );
}
