"use client";

import { useSession } from "@/lib/session";
import styles from "./RomanceDecor.module.css";

/**
 * 恋愛モード専用の水彩・手描き装飾。
 * 装飾は本文とは別の固定レイヤーに置き、左右端と四隅だけを使う。
 */
export function RomanceDecor() {
  const { mode } = useSession();

  if (mode !== "romance") return null;

  return (
    <>
      <div aria-hidden className={styles.backdrop}>
        <span className={`${styles.wash} ${styles.washTop}`} />
        <span className={`${styles.wash} ${styles.washLeft}`} />
        <span className={`${styles.wash} ${styles.washBottom}`} />

        <Heart className={styles.heartLeft} color="#ff6f91" />
        <Heart className={styles.heartRight} color="#ff4f7b" />
        <Heart className={styles.heartBottom} color="#ff91ab" />
        <Star className={styles.starLeft} color="#ff91ab" />
        <Star className={styles.starRight} color="#ff6f91" />
        <Sparkle className={styles.sparkleTop} color="#ff4f7b" />
        <Sparkle className={styles.sparkleBottom} color="#ff91ab" />
        <Flower className={styles.flowerLeft} color="#ff6f91" />
        <Flower className={styles.flowerRight} color="#ff91ab" />
        <Arrow className={styles.arrowRight} color="#ff6f91" />
        <Wave className={styles.waveLeft} color="#ff91ab" />
      </div>

      {/* テープは紙を留めるように四隅へ置き、本文領域には入れない。 */}
      <div aria-hidden className={styles.tapeLayer}>
        <span className={`${styles.tape} ${styles.tapeTop}`} />
        <span className={`${styles.tape} ${styles.tapeBottom}`} />
      </div>
    </>
  );
}

type DoodleProps = {
  className: string;
  color: string;
};

function Heart({ className, color }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 58" className={`${styles.doodle} ${className}`} style={{ color }} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 51C25 44 8 35 8 20 8 9 23 6 32 18 42 5 57 10 56 21 55 35 40 45 32 51Z" />
      <path className={styles.sketchLine} d="M31 48C24 41 12 34 11 22 10 15 19 10 27 16" />
    </svg>
  );
}

function Star({ className, color }: DoodleProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${styles.doodle} ${className}`} style={{ color }} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="m24 5 4.6 13.7L43 20l-11.2 8.8L35 43 24 34.8 13 43l3.2-14.2L5 20l14.4-1.3L24 5Z" />
    </svg>
  );
}

function Sparkle({ className, color }: DoodleProps) {
  return (
    <svg viewBox="0 0 52 52" className={`${styles.doodle} ${className}`} style={{ color }} fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M26 5c1.8 12.4 5.5 16.2 18 18-12.5 1.8-16.2 5.6-18 18-1.8-12.4-5.5-16.2-18-18 12.5-1.8 16.2-5.6 18-18Z" />
      <path d="M43 7v7M39.5 10.5h7M10 37v6M7 40h6" />
    </svg>
  );
}

function Flower({ className, color }: DoodleProps) {
  return (
    <svg viewBox="0 0 72 72" className={`${styles.doodle} ${className}`} style={{ color }} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M36 30C27 13 12 17 17 29c-15-1-15 15-1 16-5 13 11 18 19 6 9 12 24 5 18-7 14-3 12-19-2-17 3-14-13-17-15 3Z" />
      <circle cx="35" cy="38" r="6" />
      <path className={styles.sketchLine} d="M37 45c1 9-1 14-5 21M34 57c-5-5-9-4-11-2M34 59c6-4 10-2 12 1" />
    </svg>
  );
}

function Arrow({ className, color }: DoodleProps) {
  return (
    <svg viewBox="0 0 130 74" className={`${styles.doodle} ${className}`} style={{ color }} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 57c22 8 48 4 61-10 9-9 7-20-2-24-8-4-18 2-14 10 5 10 30 9 59-7" />
      <path d="m98 17 16 8-12 13" />
      <path className={styles.sketchLine} d="M10 61c24 7 47 2 60-11" />
    </svg>
  );
}

function Wave({ className, color }: DoodleProps) {
  return (
    <svg viewBox="0 0 150 42" className={`${styles.doodle} ${className}`} style={{ color }} fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M4 21c12-17 23 17 35 0s23 17 35 0 23 17 35 0 23 17 37 0" />
      <path className={styles.sketchLine} d="M7 27c12-13 21 13 32 0s22 13 34 0" />
    </svg>
  );
}
