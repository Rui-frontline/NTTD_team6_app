import { Placeholder } from "@/components/Placeholder";
import { getUser } from "@/lib/repository";

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);

  return (
    <Placeholder
      title={user ? `${user.name} のプロフィール` : "プロフィール"}
      branch="feat/profile"
      note="顔写真・基本情報・フリー欄・ハートボタン。表示する項目はモードによって変わります。"
    />
  );
}
