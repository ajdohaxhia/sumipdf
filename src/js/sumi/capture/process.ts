export interface CapturePage {
  id: string;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  mode: 'color' | 'gray' | 'mono';
  imageBytes: Uint8Array;
  mimeType: string;
}

export interface Quad {
  x: number;
  y: number;
}

export function rotateIndex(
  current: 0 | 90 | 180 | 270,
  delta = 90
): 0 | 90 | 180 | 270 {
  return ((current + delta) % 360) as 0 | 90 | 180 | 270;
}

export function orderPages(
  pages: CapturePage[],
  from: number,
  to: number
): CapturePage[] {
  const next = pages.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Bilinear sample of a source image into a rectangle. Corners are in source pixel space. */
export function perspectiveWarp(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  corners: [Quad, Quad, Quad, Quad],
  destW: number,
  destH: number
): Uint8ClampedArray {
  const [tl, tr, br, bl] = corners;
  const out = new Uint8ClampedArray(destW * destH * 4);
  for (let y = 0; y < destH; y++) {
    const v = destH === 1 ? 0 : y / (destH - 1);
    for (let x = 0; x < destW; x++) {
      const u = destW === 1 ? 0 : x / (destW - 1);
      const topX = tl.x + (tr.x - tl.x) * u;
      const topY = tl.y + (tr.y - tl.y) * u;
      const botX = bl.x + (br.x - bl.x) * u;
      const botY = bl.y + (br.y - bl.y) * u;
      const sx = topX + (botX - topX) * v;
      const sy = topY + (botY - topY) * v;
      const ix = Math.max(0, Math.min(srcW - 1, Math.round(sx)));
      const iy = Math.max(0, Math.min(srcH - 1, Math.round(sy)));
      const si = (iy * srcW + ix) * 4;
      const di = (y * destW + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3] ?? 255;
    }
  }
  return out;
}

export function toGray(data: Uint8ClampedArray): Uint8ClampedArray {
  const out = data.slice();
  for (let i = 0; i < out.length; i += 4) {
    const g = Math.round(
      out[i] * 0.299 + out[i + 1] * 0.587 + out[i + 2] * 0.114
    );
    out[i] = out[i + 1] = out[i + 2] = g;
  }
  return out;
}

export function toMono(
  data: Uint8ClampedArray,
  threshold = 160
): Uint8ClampedArray {
  const gray = toGray(data);
  for (let i = 0; i < gray.length; i += 4) {
    const v = gray[i] >= threshold ? 255 : 0;
    gray[i] = gray[i + 1] = gray[i + 2] = v;
  }
  return gray;
}

export async function imagesToPdf(
  pages: Array<{
    png?: Uint8Array;
    bytes?: Uint8Array;
    mimeType?: string;
    width?: number;
    height?: number;
  }>
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  for (const page of pages) {
    const bytes = page.bytes || page.png;
    if (!bytes) throw new Error('Capture page has no image bytes.');
    const image = /jpe?g/i.test(page.mimeType || '')
      ? await doc.embedJpg(bytes)
      : await doc.embedPng(bytes);
    const pdfPage = doc.addPage([image.width, image.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }
  return new Uint8Array(await doc.save());
}

export function cameraConstraints(): MediaStreamConstraints {
  return { video: { facingMode: { ideal: 'environment' } }, audio: false };
}
