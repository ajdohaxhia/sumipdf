export type BarcodeFormatName =
  | 'qr_code'
  | 'code_128'
  | 'code_39'
  | 'ean_13'
  | 'ean_8'
  | 'upc_a'
  | 'itf'
  | 'data_matrix'
  | 'unknown';

export interface BarcodeHit {
  rawValue: string;
  format: BarcodeFormatName;
  page: number;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  engine: 'BarcodeDetector' | 'ZXing';
}

export interface BarcodeScanProgress {
  page: number;
  total: number;
  message: string;
}

export interface BarcodeScanOptions {
  pages?: number[];
  scale?: number;
  signal?: AbortSignal;
  onProgress?: (progress: BarcodeScanProgress) => void;
}

export interface BarcodeEngineInfo {
  native: boolean;
  zxing: boolean;
  unsupported: boolean;
  note: string;
}
