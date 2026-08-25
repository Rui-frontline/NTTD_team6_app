import { MAX_RATING } from "@/lib/reviews";

/**
 * 星を5つ並べて描くだけの部品。表示専用で、押せない。
 *
 * 半端な値（3.4 など）は部分的に塗る。四捨五入して 3 にすると、
 * 3.4 と 2.6 が同じ見た目になり、平均を出す意味が薄れる。
 */
export function StarRating({
  value,
  size = 16,
}: {
  /** 0〜5。0 のときは全部が空の星になる */
  value: number;
  /** 星1つの一辺(px) */
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: size * 0.1 }}
      aria-hidden
    >
      {Array.from({ length: MAX_RATING }, (_, i) => {
        // この星をどれだけ塗るか。1つ目は value が 1 以上なら満タン
        const filled = Math.min(Math.max(value - i, 0), 1);
        return <StarIcon key={i} size={size} filled={filled} />;
      })}
    </span>
  );
}

/**
 * 星1つ。評価を入力する画面（ReviewPrompt）からも使う。
 *
 * 塗りの量は「空の星の上に、金色の星を幅で切り取って重ねる」で出している。
 * 半端な塗りを SVG の gradient でやると、同じページに複数出したときに
 * id がぶつかるため。
 */
export function StarIcon({ size, filled }: { size: number; filled: number }) {
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <StarShape size={size} color="var(--line)" />
      {filled > 0 ? (
        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${filled * 100}%` }}
        >
          <StarShape size={size} color="#f5a623" />
        </span>
      ) : null}
    </span>
  );
}

function StarShape({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className="block"
    >
      <path d="M12 2.5l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.56l-5.91 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
    </svg>
  );
}
