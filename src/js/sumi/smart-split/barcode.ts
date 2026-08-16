import type {
  BarcodeEngineInfo,
  BarcodeFormatName,
  BarcodeHit,
  BarcodeScanOptions,
} from './barcode-types';

const NATIVE_FORMATS = [
  'qr_code',
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'itf',
  'data_matrix',
] as const;

type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<
    Array<{
      rawValue: string;
      format: string;
      boundingBox?: DOMRectReadOnly;
    }>
  >;
};

function mapNativeFormat(raw: string): BarcodeFormatName {
  const key = raw.toLowerCase().replace(/-/g, '_');
  if ((NATIVE_FORMATS as readonly string[]).includes(key)) {
    return key as BarcodeFormatName;
  }
  if (key === 'upc_e') return 'upc_a';
  return 'unknown';
}

function mapZxingFormat(format: number | string): BarcodeFormatName {
  const name = String(format).toUpperCase();
  if (name.includes('QR')) return 'qr_code';
  if (name.includes('CODE_128') || name.includes('CODE128')) return 'code_128';
  if (name.includes('CODE_39') || name.includes('CODE39')) return 'code_39';
  if (name.includes('EAN_13') || name.includes('EAN13')) return 'ean_13';
  if (name.includes('EAN_8') || name.includes('EAN8')) return 'ean_8';
  if (name.includes('UPC_A') || name.includes('UPC')) return 'upc_a';
  if (name.includes('ITF')) return 'itf';
  if (name.includes('DATA_MATRIX') || name.includes('DATA MATRIX'))
    return 'data_matrix';
  return 'unknown';
}

function pdfJsDocParams(data: Uint8Array): Record<string, unknown> {
  return {
    data: data.slice(),
    useSystemFonts: true,
    disableWorker: true,
  };
}

export async function detectBarcodeEngines(): Promise<BarcodeEngineInfo> {
  const native =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector ===
      'function';
  const zxing = await import('@zxing/library')
    .then(() => true)
    .catch(() => false);
  const unsupported = !native && !zxing;
  return {
    native,
    zxing,
    unsupported,
    note: unsupported
      ? 'No barcode engine is available in this environment. Image decoding cannot run.'
      : native
        ? 'Using native BarcodeDetector when possible, with a ZXing fallback.'
        : 'Using dynamically loaded ZXing. Native BarcodeDetector is unavailable.',
  };
}

/** Pull raw PNG file blobs embedded in a PDF (fixture / Node fallback). */
export function extractEmbeddedPngs(pdfBytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const iend = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  for (let i = 0; i < pdfBytes.length - 8; i++) {
    let match = true;
    for (let k = 0; k < 8; k++) {
      if (pdfBytes[i + k] !== sig[k]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    for (let j = i + 8; j < pdfBytes.length - 8; j++) {
      let end = true;
      for (let k = 0; k < 8; k++) {
        if (pdfBytes[j + k] !== iend[k]) {
          end = false;
          break;
        }
      }
      if (end) {
        out.push(pdfBytes.slice(i, j + 8));
        i = j + 8;
        break;
      }
    }
  }
  return out;
}

async function createRenderTarget(
  width: number,
  height: number
): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  release: () => void;
}> {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx && typeof ctx.getImageData === 'function') {
      // jsdom advertises canvas without pixels; Node tests use XObject fallback.
      const isNode =
        typeof (globalThis as { process?: { versions?: { node?: string } } })
          .process?.versions?.node === 'string';
      if (!isNode) {
        return {
          canvas,
          ctx,
          release: () => {
            canvas.width = 0;
            canvas.height = 0;
          },
        };
      }
    }
  }

  const isNode =
    typeof (globalThis as { process?: { versions?: { node?: string } } })
      .process?.versions?.node === 'string';
  if (isNode) {
    // Never resolve this package for the browser bundle.
    const napi = await import(/* @vite-ignore */ '@napi-rs/canvas');
    const canvas = napi.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    return {
      canvas: canvas as unknown as HTMLCanvasElement,
      ctx: ctx as unknown as CanvasRenderingContext2D,
      release: () => undefined,
    };
  }

  throw new Error('Canvas 2D context unavailable for barcode scan.');
}

async function renderPageToCanvas(
  pdfjs: typeof import('pdfjs-dist'),
  data: Uint8Array,
  pageNumber: number,
  scale: number
): Promise<{ canvas: HTMLCanvasElement; release: () => void }> {
  const doc = await pdfjs.getDocument(
    pdfJsDocParams(data) as Parameters<typeof pdfjs.getDocument>[0]
  ).promise;
  try {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const { canvas, ctx, release } = await createRenderTarget(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return { canvas, release };
  } finally {
    await doc.destroy();
  }
}

async function decodeNative(
  canvas: HTMLCanvasElement,
  page: number
): Promise<BarcodeHit[]> {
  const Detector = (
    globalThis as unknown as { BarcodeDetector: BarcodeDetectorCtor }
  ).BarcodeDetector;
  const detector = new Detector({ formats: [...NATIVE_FORMATS] });
  const results = await detector.detect(canvas);
  return results.map((hit) => ({
    rawValue: hit.rawValue,
    format: mapNativeFormat(hit.format),
    page,
    boundingBox: hit.boundingBox
      ? {
          x: hit.boundingBox.x,
          y: hit.boundingBox.y,
          width: hit.boundingBox.width,
          height: hit.boundingBox.height,
        }
      : null,
    engine: 'BarcodeDetector' as const,
  }));
}

async function decodeZxingFromLuminances(
  luminances: Uint8ClampedArray,
  width: number,
  height: number,
  page: number
): Promise<BarcodeHit[]> {
  const zxing = await import('@zxing/library');
  const source = new zxing.RGBLuminanceSource(luminances, width, height);
  const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source));
  const reader = new zxing.MultiFormatReader();
  const hints = new Map();
  hints.set(zxing.DecodeHintType.TRY_HARDER, true);
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
    zxing.BarcodeFormat.QR_CODE,
    zxing.BarcodeFormat.CODE_128,
    zxing.BarcodeFormat.CODE_39,
    zxing.BarcodeFormat.EAN_13,
    zxing.BarcodeFormat.EAN_8,
    zxing.BarcodeFormat.UPC_A,
    zxing.BarcodeFormat.ITF,
    zxing.BarcodeFormat.DATA_MATRIX,
  ]);
  reader.setHints(hints);
  try {
    const result = reader.decode(bitmap);
    const points = result.getResultPoints?.() || [];
    let box: BarcodeHit['boundingBox'] = null;
    if (points.length) {
      const xs = points.map((p: { getX: () => number }) => p.getX());
      const ys = points.map((p: { getY: () => number }) => p.getY());
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      box = {
        x: minX,
        y: minY,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
      };
    }
    return [
      {
        rawValue: result.getText(),
        format: mapZxingFormat(result.getBarcodeFormat()),
        page,
        boundingBox: box,
        engine: 'ZXing',
      },
    ];
  } catch {
    return [];
  }
}

async function decodeZxingFromCanvas(
  canvas: HTMLCanvasElement,
  page: number
): Promise<BarcodeHit[]> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const luminances = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    luminances[j] = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
  }
  return decodeZxingFromLuminances(luminances, width, height, page);
}

/**
 * Decode barcodes from embedded page image XObjects (avoids PDF.js scale blur on 1D codes).
 */
async function decodePageImageXObjects(
  pdfjs: typeof import('pdfjs-dist'),
  data: Uint8Array,
  pageNumber: number
): Promise<BarcodeHit[]> {
  const doc = await pdfjs.getDocument(
    pdfJsDocParams(data) as Parameters<typeof pdfjs.getDocument>[0]
  ).promise;
  try {
    const page = await doc.getPage(pageNumber);
    // Ensure image objects resolve.
    const viewport = page.getViewport({ scale: 1 });
    const { canvas, ctx, release } = await createRenderTarget(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    release();

    const opList = await page.getOperatorList();
    const OPS = pdfjs.OPS;
    const hits: BarcodeHit[] = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] !== OPS.paintImageXObject) continue;
      const name = opList.argsArray[i][0] as string;
      const img = await new Promise<{
        width: number;
        height: number;
        data: Uint8ClampedArray | Uint8Array;
      } | null>((resolve) => {
        try {
          page.objs.get(name, (value: unknown) => {
            resolve(
              value as {
                width: number;
                height: number;
                data: Uint8ClampedArray | Uint8Array;
              }
            );
          });
        } catch {
          resolve(null);
        }
      });
      if (!img?.data || !img.width || !img.height) continue;
      const channels = Math.round(img.data.length / (img.width * img.height));
      if (channels < 1) continue;
      const luminances = new Uint8ClampedArray(img.width * img.height);
      if (channels === 1) {
        for (let j = 0; j < img.data.length; j++) luminances[j] = img.data[j];
      } else {
        for (let p = 0, j = 0; p < img.data.length; p += channels, j++) {
          luminances[j] =
            (img.data[p] * 0.299 +
              img.data[p + 1] * 0.587 +
              img.data[p + 2] * 0.114) |
            0;
        }
      }
      hits.push(
        ...(await decodeZxingFromLuminances(
          luminances,
          img.width,
          img.height,
          pageNumber
        ))
      );
    }
    return hits;
  } finally {
    await doc.destroy();
  }
}

function dedupe(hits: BarcodeHit[]): BarcodeHit[] {
  const seen = new Set<string>();
  const out: BarcodeHit[] = [];
  for (const hit of hits) {
    const key = `${hit.page}|${hit.format}|${hit.rawValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

async function scanEmbeddedPngFallback(
  bytes: Uint8Array,
  pageHint = 1
): Promise<BarcodeHit[]> {
  const isNode =
    typeof (globalThis as { process?: { versions?: { node?: string } } })
      .process?.versions?.node === 'string';
  if (!isNode) return [];
  const { decodePngBarcodes } = await import('./barcode-png.js');
  const pngs = extractEmbeddedPngs(bytes);
  const hits: BarcodeHit[] = [];
  for (const png of pngs) {
    hits.push(...decodePngBarcodes(png, pageHint));
  }
  return dedupe(hits);
}

async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  const isNode =
    typeof (globalThis as { process?: { versions?: { node?: string } } })
      .process?.versions?.node === 'string';
  if (isNode) {
    return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as typeof import('pdfjs-dist');
  }
  return import('pdfjs-dist');
}

/**
 * Decode barcodes from rendered PDF page pixels.
 * Does not use text-layer markers. Engines load only after this function runs.
 * When canvas rendering yields no hits, falls back to embedded PNG blobs if present.
 */
export async function scanPdfBarcodes(
  bytes: Uint8Array,
  options: BarcodeScanOptions = {}
): Promise<{ hits: BarcodeHit[]; engines: BarcodeEngineInfo }> {
  const engines = await detectBarcodeEngines();
  if (engines.unsupported) {
    throw new Error(engines.note);
  }

  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = isNodeWorkerSrc(pdfjs);
    }
    const probe = await pdfjs.getDocument(
      pdfJsDocParams(bytes) as Parameters<typeof pdfjs.getDocument>[0]
    ).promise;
    const total = probe.numPages;
    await probe.destroy();

    const pages =
      options.pages && options.pages.length
        ? options.pages.filter((p) => p >= 1 && p <= total)
        : Array.from({ length: total }, (_, i) => i + 1);
    const scale = options.scale ?? 2.5;
    const all: BarcodeHit[] = [];

    for (let i = 0; i < pages.length; i++) {
      if (options.signal?.aborted) {
        const err = new Error('Barcode scan cancelled');
        err.name = 'AbortError';
        throw err;
      }
      const page = pages[i];
      options.onProgress?.({
        page,
        total: pages.length,
        message: `Scanning page ${page} for barcodes…`,
      });
      const { canvas, release } = await renderPageToCanvas(
        pdfjs,
        bytes,
        page,
        scale
      );
      let hits: BarcodeHit[] = [];
      if (engines.native) {
        try {
          hits = await decodeNative(canvas, page);
        } catch {
          hits = [];
        }
      }
      if (!hits.length && engines.zxing) {
        hits = await decodeZxingFromCanvas(canvas, page);
      }
      if (!hits.length && engines.zxing) {
        hits = await decodePageImageXObjects(pdfjs, bytes, page);
      }
      all.push(...hits);
      release();
    }

    const deduped = dedupe(all);
    if (deduped.length) return { hits: deduped, engines };
  } catch {
    // fall through to embedded PNG path
  }

  const embedded = await scanEmbeddedPngFallback(bytes);
  return { hits: embedded, engines };
}

function isNodeWorkerSrc(_pdfjs: typeof import('pdfjs-dist')): string {
  const isNode =
    typeof (globalThis as { process?: { versions?: { node?: string } } })
      .process?.versions?.node === 'string';
  if (isNode) {
    return new URL(
      'pdfjs-dist/legacy/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  }
  return new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}
