import { Placeholder } from "@/components/Placeholder";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  return (
    <Placeholder
      title="チャット"
      branch="feat/chat"
      note={`マッチ ${matchId} の会話。吹き出し形式で、送信したら自分の画面に即反映します（通信はしません）。`}
    />
  );
}
