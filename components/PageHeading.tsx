/**
 * 各画面の左上に置く見出し。
 *
 * デザイン案（pictures/）では、どの画面もメイン領域の左上に
 * 「大きな見出し ＋ 一行の説明」が入っている。画面ごとに書き方が
 * ばらけないよう、ここにまとめている。
 */
export function PageHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}
