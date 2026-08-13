import { Placeholder } from "@/components/Placeholder";

export default function MePage() {
  return (
    <Placeholder
      title="マイページ"
      branch="feat/profile"
      note="共通項目（名前・アイコン・部署・職種・年齢）と、モード別項目（自己紹介・タグ・部署の表示可否・参加ON/OFF）を編集します。repository の updateUser / updateProfile、タグの候補は types の TAG_OPTIONS を使ってください。"
    />
  );
}
