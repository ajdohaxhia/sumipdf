import {
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
  BarcodeFormat,
} from '@zxing/library';
import { PNG } from 'pngjs';
import type { BarcodeFormatName, BarcodeHit } from './barcode-types';

const FORMAT_MAP: Array<[BarcodeFormat, BarcodeFormatName]> = [
  [BarcodeFormat.QR_CODE, 'qr_code'],
  [BarcodeFormat.CODE_128, 'code_128'],
  [BarcodeFormat.CODE_39, 'code_39'],
  [BarcodeFormat.EAN_13, 'ean_13'],
  [BarcodeFormat.EAN_8, 'ean_8'],
  [BarcodeFormat.UPC_A, 'upc_a'],
  [BarcodeFormat.ITF, 'itf'],
  [BarcodeFormat.DATA_MATRIX, 'data_matrix'],
];

function mapFormat(format: BarcodeFormat): BarcodeFormatName {
  for (const [key, name] of FORMAT_MAP) {
    if (key === format) return name;
  }
  return 'unknown';
}

/** Composite transparent PNG modules onto white, then build luminance. */
function luminancesFromPng(png: PNG): Uint8ClampedArray {
  const out = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) {
    const a = png.data[i + 3] / 255;
    const r = png.data[i] * a + 255 * (1 - a);
    const g = png.data[i + 1] * a + 255 * (1 - a);
    const b = png.data[i + 2] * a + 255 * (1 - a);
    out[j] = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
  }
  return out;
}

/** Decode barcodes from PNG bytes without DOM (fixture / Node tests). */
export function decodePngBarcodes(
  pngBytes: Uint8Array,
  page = 1
): BarcodeHit[] {
  const png = PNG.sync.read(Buffer.from(pngBytes));
  const luminances = luminancesFromPng(png);
  const source = new RGBLuminanceSource(luminances, png.width, png.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    FORMAT_MAP.map(([fmt]) => fmt)
  );
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  try {
    const result = reader.decode(bitmap);
    return [
      {
        rawValue: result.getText(),
        format: mapFormat(result.getBarcodeFormat()),
        page,
        boundingBox: null,
        engine: 'ZXing',
      },
    ];
  } catch {
    return [];
  }
}
