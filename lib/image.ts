// 写真をトークに載せるための変換。
//
// 選んだ写真は canvas で縮小して JPEG にし、Supabase Storage に上げる。
// メッセージ本文（messages.body）に入れるのは、その URL だけ。
//
// 以前は data URL を本文にそのまま入れていたが、一覧（5秒）と会話（3秒）の
// ポーリングが本文を毎回取り直すため、写真が溜まるほど転送量が増え続けていた。
// URL ならブラウザがキャッシュするので、2回目以降の取得は発生しない。

import { MESSAGE_IMAGE_BUCKET, uploadMessageImage } from "@/lib/repository";

/** 長辺の上限。投影して見るぶんにはこれで十分 */
const MAX_EDGE = 1280;

/**
 * 保存するファイルサイズの上限。
 * 毎回取り直されることはなくなったので、以前より余裕を持たせている。
 */
const MAX_IMAGE_BYTES = 500 * 1024;

/** 変換にかける前に弾くサイズ。巨大な写真で固まらせないための保険 */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** 上限に収まるまで、この順に画質を落として試す */
const QUALITY_STEPS = [0.82, 0.72, 0.6, 0.5, 0.4];

/**
 * メッセージ本文が写真かどうか。
 * 本文が画像を指していれば写真として描く、というのがこの機能の唯一の約束事。
 */
export function isImageBody(body: string): boolean {
  // Storage に上げるようになる前に送られた写真は本文が data URL なので、
  // そちらも引き続き写真として扱う（既存のトークが壊れないように）。
  if (body.startsWith("data:image/")) return true;
  return (
    body.startsWith("http") &&
    body.includes(`/object/public/${MESSAGE_IMAGE_BUCKET}/`)
  );
}

/**
 * 選ばれた写真を縮小して Storage に上げ、そのまま本文にできる URL を返す。
 *
 * 失敗したときは画面にそのまま出せる日本語のメッセージを投げる。
 */
export async function fileToMessageImage(
  matchId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください。");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("写真が大きすぎます。20MB以下のものを選んでください。");
  }

  const blob = await shrinkToJpeg(file);
  return uploadMessageImage(matchId, blob);
}

/** 縮小して、上限に収まる JPEG にする */
async function shrinkToJpeg(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const { width, height } = fitInto(
    image.naturalWidth,
    image.naturalHeight,
    MAX_EDGE,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("写真を変換できませんでした。");

  // 透過PNGをJPEGにすると透明部分が黒くなるので、先に白で塗りつぶしておく
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
  }

  throw new Error(
    "写真を十分に小さくできませんでした。別の写真を選んでください。",
  );
}

/** canvas.toBlob をそのまま await できる形にする */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

/**
 * File を画像として読み込む。
 *
 * createImageBitmap ではなく img 要素を使っているのは、
 * スマホの写真に入っている向き情報（EXIF）をブラウザが自動で反映してくれるため。
 * これが無いと、縦で撮った写真が横倒しで送られる。
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "この写真は読み込めませんでした。JPEG または PNG を選んでください。",
        ),
      );
    image.src = url;
  }).finally(() => {
    // 読み込みが終わればデコード済みの中身は image 側に残るので、ここで解放してよい
    URL.revokeObjectURL(url);
  });
}

/** 縦横比を保ったまま、長辺が maxEdge に収まる大きさを返す */
function fitInto(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest === 0) throw new Error("写真を読み込めませんでした。");
  if (longest <= maxEdge) return { width, height };

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
