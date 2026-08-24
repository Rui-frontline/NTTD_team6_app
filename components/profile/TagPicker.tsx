"use client";

import { MAX_TAGS, type Mode } from "@/lib/types";

interface TagPickerProps {
  mode: Mode;
  candidates: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * タグは自由入力ではなく候補から選ぶ方式。
 * 1モードにつき最大 MAX_TAGS 個まで選択できる。
 * 配色はモードごとに切り替わる CSS 変数(--accent 系)を参照する。
 */
export function TagPicker({
  mode,
  candidates,
  selected,
  onChange,
}: TagPickerProps) {
  const isMaxed = selected.length >= MAX_TAGS;
  const isWork = mode === "work";

  const toggleTag = (tag: string) => {
    const isSelected = selected.includes(tag);
    if (isSelected) {
      onChange(selected.filter((t) => t !== tag));
      return;
    }
    if (isMaxed) return; // 上限に達している場合は選択不可(解除は可能)
    onChange([...selected, tag]);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span
          className={
            isWork
              ? "text-sm font-medium text-[#31415A]"
              : "text-sm font-medium text-[var(--foreground)]"
          }
        >
          タグ
        </span>
        <span
          className={[
            "text-xs",
            isWork
              ? isMaxed
                ? "text-[#806126]"
                : "text-[var(--muted)]"
              : isMaxed
                ? "text-[var(--accent-strong)]"
                : "text-[var(--muted)]",
          ].join(" ")}
        >
          {selected.length}/{MAX_TAGS}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {candidates.map((tag) => {
          const isSelected = selected.includes(tag);
          const disabled = !isSelected && isMaxed;
          return (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => toggleTag(tag)}
              aria-pressed={isSelected}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                isWork
                  ? isSelected
                    ? "border-[#0C2340] bg-[#EEF1F6] text-[#31415A] shadow-[0_2px_8px_rgba(12,35,64,0.06)]"
                    : disabled
                      ? "cursor-not-allowed border-[#EAE6DF] bg-[#FBFAF7] text-[var(--muted)] opacity-60"
                      : "border-[#DED9D0] bg-[#FFFDFC] text-[#31415A] hover:border-[#0C2340] hover:bg-[#F4F1EB]"
                  : isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : disabled
                      ? "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] cursor-not-allowed opacity-60"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]",
              ].join(" ")}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
