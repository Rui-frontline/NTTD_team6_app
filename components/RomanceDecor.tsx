"use client";

import { useSession } from "@/lib/session";

/**
 * 恋愛モードのときだけ背景に浮かべる飾り。
 *
 * デザイン案（pictures/）の恋愛モードには、ハートやキラキラが
 * 散らしてある。レイアウトにも操作にも影響させたくないので、
 * 画面全体を覆う1枚のレイヤーとして本文の後ろに敷いている。
 *
 * 守っていること:
 * - pointer-events-none … これが無いと、見えない飾りがクリックを吸う
 * - aria-hidden          … 読み上げに「ハート」が延々と並ぶのを防ぐ
 * - overflow-hidden      … はみ出して横スクロールバーが出るのを防ぐ
 * - z-0                  … 本文より後ろ。文字の上に重ならない
 */
export function RomanceDecor() {
  const { mode } = useSession();

  if (mode !== "romance") return null;

  return (
    <>
      {/* ハートとキラキラは本文の後ろ。文字の上に重ならないようにする */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {HEARTS.map((item, i) => (
          <Heart key={`heart-${i}`} {...item} />
        ))}
        {SPARKLES.map((item, i) => (
          <Sparkle key={`sparkle-${i}`} {...item} />
        ))}
      </div>

      {/*
        マスキングテープだけは本文より前に出す。
        紙の四隅を留めているように見せたいので、後ろに敷くと
        サイドバーやヘッダーに隠れて意味が無くなるため。
        画面の隅にだけ置き、操作の邪魔にならないようにしている。
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      >
        {TAPES.map((item, i) => (
          <Tape key={`tape-${i}`} {...item} />
        ))}
      </div>
    </>
  );
}

type Item = {
  /** 画面に対する位置。数値そのものに意味は無く、散らばって見えればよい */
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
  color: string;
};

/**
 * 中央は本文が乗るので、左右の端寄りに散らしている。
 *
 * 左上（top 35% / left 35% より内側）には置かない。
 * どの画面もそこに PageHeading の見出しがあり、飾りが後ろに透けると
 * 文字が読みにくくなるため。ここだけは空けておくこと。
 *
 * 左端は 15% より内側にしない。それより左だとサイドバーの裏に回って
 * 見えなくなる（サイドバーは不透明で、飾りより手前に描かれる）。
 */
const HEARTS: Item[] = [
  { top: "46%", left: "16%", size: 30, rotate: -14, opacity: 0.5, color: "#f2a7bc" },
  { top: "63%", left: "15%", size: 38, rotate: -8, opacity: 0.35, color: "#f2a7bc" },
  { top: "78%", left: "17%", size: 20, rotate: 10, opacity: 0.4, color: "#f7c4d0" },
  { top: "91%", left: "15%", size: 22, rotate: 18, opacity: 0.45, color: "#f7c4d0" },
  { top: "10%", left: "92%", size: 26, rotate: 12, opacity: 0.45, color: "#f2a7bc" },
  { top: "27%", left: "95%", size: 18, rotate: -16, opacity: 0.4, color: "#f7c4d0" },
  { top: "50%", left: "91%", size: 40, rotate: 8, opacity: 0.35, color: "#f2a7bc" },
  { top: "72%", left: "94%", size: 24, rotate: -10, opacity: 0.45, color: "#f7c4d0" },
  { top: "90%", left: "88%", size: 32, rotate: 14, opacity: 0.35, color: "#f2a7bc" },
  { top: "95%", left: "40%", size: 22, rotate: 9, opacity: 0.3, color: "#f2a7bc" },
  { top: "93%", left: "62%", size: 18, rotate: -12, opacity: 0.3, color: "#f7c4d0" },
];

const SPARKLES: Item[] = [
  { top: "55%", left: "19%", size: 12, rotate: 20, opacity: 0.45, color: "#f9d2dc" },
  { top: "70%", left: "16%", size: 16, rotate: 0, opacity: 0.5, color: "#f6b7c8" },
  { top: "17%", left: "89%", size: 14, rotate: -10, opacity: 0.5, color: "#f6b7c8" },
  { top: "40%", left: "96%", size: 11, rotate: 15, opacity: 0.45, color: "#f9d2dc" },
  { top: "80%", left: "90%", size: 15, rotate: -6, opacity: 0.4, color: "#f6b7c8" },
  { top: "86%", left: "50%", size: 12, rotate: 12, opacity: 0.35, color: "#f9d2dc" },
];

type TapeItem = {
  /** 隅に貼るので、使う辺だけ指定する */
  style: React.CSSProperties;
  rotate: number;
  color: string;
};

/**
 * 画面の隅に斜めに貼るテープ。
 * 隅からはみ出す前提の位置なので、親の overflow-hidden で切られて
 * ちぎれた端のように見える。
 *
 * 四隅すべてに貼ると飾りが主張しすぎるので、左上の1枚だけにしている。
 */
const TAPES: TapeItem[] = [
  { style: { top: "-14px", left: "-20px" }, rotate: 38, color: "#f4b8c6" },
];

function Tape({ style, rotate, color }: TapeItem) {
  return (
    <span
      className="absolute block h-6 w-32 opacity-70 mix-blend-multiply"
      style={{
        ...style,
        background: color,
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
}

function itemStyle({ top, left, size, rotate, opacity }: Item) {
  return {
    top,
    left,
    width: `${size}px`,
    height: `${size}px`,
    transform: `rotate(${rotate}deg)`,
    opacity,
  };
}

function Heart(item: Item) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute"
      style={itemStyle(item)}
      fill="none"
      stroke={item.color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />
    </svg>
  );
}

function Sparkle(item: Item) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute"
      style={itemStyle(item)}
      fill={item.color}
    >
      <path d="M12 2.5c.6 3.9 1.6 5.5 4.8 6.5-3.2 1-4.2 2.6-4.8 6.5-.6-3.9-1.6-5.5-4.8-6.5 3.2-1 4.2-2.6 4.8-6.5Z" />
    </svg>
  );
}
