/**
 * 未実装画面の仮表示。
 * 担当ブランチが実装したら、このコンポーネントごと置き換える。
 */
export function Placeholder({
  title,
  branch,
  note,
}: {
  title: string;
  branch: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface p-8">
      <h1 className="text-xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        この画面は <code className="font-mono text-accent">{branch}</code> で実装します。
      </p>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
    </div>
  );
}
