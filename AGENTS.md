# Repository Agent Instructions

このファイルには、このリポジトリで作業するAIエージェント向けの指示を記載します。

## Next.js-specific instructions

以下のブロックは`next dev`によって自動生成・更新されます。
`BEGIN`から`END`までの内容は手動で編集または削除しないでください。

<!-- BEGIN:nextjs-agent-rules -->

**# This is NOT the Next.js you know**

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Code Review Rules

### Output language

- レビューの要約とインラインコメントは、すべて日本語で記述してください。
- コード上の識別子、ファイルパス、API名、コマンド、エラーメッセージは原文のまま記述してください。
- 専門用語を使う場合は、必要に応じて短い日本語の説明を添えてください。

### Review priorities

- 正しくない動作、セキュリティ脆弱性、データ損失、重大なパフォーマンス低下、後方互換性の破壊につながる問題を優先してください。
- 各指摘には「何が問題か」「どのような影響があるか」「どう修正すべきか」を簡潔に記述してください。
- フォーマットやlintなど、CIで機械的に検出できる問題は、動作の正しさに影響しない限り指摘しないでください。