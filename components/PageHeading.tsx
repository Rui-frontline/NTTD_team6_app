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
    <div className="page-heading mb-7">
      <div
        className="page-heading-accent mb-3 h-px w-9 bg-[var(--gold)]"
        aria-hidden="true"
      />
      <h1 className="text-[1.75rem] leading-tight text-[var(--accent)] sm:text-[2rem]">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}
