"use client";

import {
  departmentLevels,
  isDepartmentComplete,
} from "@/lib/departments";
import { UNSET, UNSET_LABEL, numberOptions } from "@/lib/profile-fields";

// マイページと新規登録で共通に使う入力部品。
//
// 部署と職種は選択肢からしか選べないようにしたので、片方の画面だけに
// 実装すると、もう片方から候補外の値が入り込んでしまう。
// （実際、登録フォームが自由入力のままだったせいで、候補外の職種で
//   登録したユーザーがマイページで何も保存できなくなっていた）

/** 入力欄の見た目。同じ指定を何度も書かないようにまとめている */
export const INPUT_CLASS =
  "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

/** 仕事モードのマイページだけで使う、アイボリー基調の入力欄 */
export const WORK_INPUT_CLASS =
  "w-full rounded-[14px] border border-[#DED9D0] bg-[#FBFAF7] px-4 py-2.5 text-sm text-[var(--foreground)] transition-[border-color,box-shadow] focus:border-[#0C2340] focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(12,35,64,0.05)]";

export function TextInput({
  value,
  onChange,
  className = INPUT_CLASS,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

/** 選択式。未設定は空文字で表す */
export function Select({
  value,
  options,
  onChange,
  className = INPUT_CLASS,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value={UNSET}>{UNSET_LABEL}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/**
 * 数値の選択。未設定は null で表す。
 *
 * input[type=number] を使わないのは、中身を全部消したときに Number("") が
 * 0 になり、「未設定」と「0」を区別できなくなるため。
 */
export function NumberSelect({
  value,
  min,
  max,
  unit,
  onChange,
  className = INPUT_CLASS,
}: {
  value: number | null;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number | null) => void;
  className?: string;
}) {
  return (
    <select
      value={value === null ? UNSET : String(value)}
      onChange={(e) =>
        onChange(e.target.value === UNSET ? null : Number(e.target.value))
      }
      className={className}
    >
      <option value={UNSET}>{UNSET_LABEL}</option>
      {numberOptions(min, max).map((n) => (
        <option key={n} value={n}>
          {n}
          {unit}
        </option>
      ))}
    </select>
  );
}

/**
 * 部署を「会社 → 区分 → 本部 → 部」と辿って選ばせる。
 *
 * 階層の深さが枝によって違うので、選択欄の数は固定できない。
 * どこまで出すかは lib/departments.ts の departmentLevels が決めていて、
 * 選んだ先にまだ下があれば欄が1つ増える。
 */
export function DepartmentPicker({
  parts,
  fallback = "",
  onChange,
  controlClassName = INPUT_CLASS,
}: {
  parts: string[];
  /** 選択肢に無い部署が登録されている場合に、元の値を知らせるために使う */
  fallback?: string;
  onChange: (parts: string[]) => void;
  controlClassName?: string;
}) {
  const levels = departmentLevels(parts);
  const complete = isDepartmentComplete(parts);
  // 登録済みなのに選択肢から復元できなかった場合だけ知らせる
  const orphaned = parts.length === 0 && fallback !== "";

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">会社・部署</span>

      {levels.map((level, depth) => (
        <select
          key={depth}
          value={level.value}
          aria-label={level.label}
          onChange={(e) => {
            // 上の段を変えたら、下の段の選択は捨てる
            const next = parts.slice(0, depth);
            if (e.target.value) next[depth] = e.target.value;
            onChange(next);
          }}
          className={controlClassName}
        >
          <option value={UNSET}>{level.label}を選択</option>
          {level.options.map((node) => (
            <option key={node.label} value={node.label}>
              {node.label}
            </option>
          ))}
        </select>
      ))}

      {orphaned ? (
        <p className="text-xs text-[var(--accent-strong)]">
          現在の登録は「{fallback}」です。選択肢に無いので選び直してください。
        </p>
      ) : !complete ? (
        <p className="text-xs text-[var(--muted)]">
          いちばん下の階層まで選んでください。
        </p>
      ) : null}
    </div>
  );
}
