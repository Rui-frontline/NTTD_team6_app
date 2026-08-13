import { Placeholder } from "@/components/Placeholder";

export default function TalkPage() {
  return (
    <Placeholder
      title="トーク"
      branch="feat/chat"
      note="左にマッチ一覧（アイコン・名前・最新メッセージ・時刻）、項目をタップすると右からトークがスライドイン。ヘッダーで選んでいるモードのマッチだけを表示します。repository の getMatches / getMessages / sendMessage を使ってください。"
    />
  );
}
