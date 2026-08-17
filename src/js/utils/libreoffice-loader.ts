/**
 * LibreOffice WASM Converter Wrapper
 *
 * Uses @matbee/libreoffice-converter package for document conversion.
 * Handles progress tracking and provides simpler API.
 */

import { WorkerBrowserConverter } from '@matbee/libreoffice-converter/browser';
import type { InputFormat } from '@matbee/libreoffice-converter/browser';

const LIBREOFFICE_LOCAL_PATH = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}libreoffice-wasm/`;

const MANIFEST_VERSION = 1;
const MAX_PART_SIZE = 20 * 1024 * 1024;
const EXPECTED_ASSETS = new Set(['soffice.wasm.gz', 'soffice.data.gz']);

interface AssetPart {
  name: string;
  size: number;
  sha256: string;
}

interface ShardedAsset {
  filename: string;
  size: number;
  sha256: string;
  encoding: 'gzip';
  parts: AssetPart[];
}

interface AssetsManifest {
  version: number;
  assets: ShardedAsset[];
}

export interface LoadProgress {
  phase: 'loading' | 'initializing' | 'converting' | 'complete' | 'ready';
  percent: number;
  message: string;
}

export type ProgressCallback = (progress: LoadProgress) => void;

// Singleton for converter instance
let converterInstance: LibreOfficeConverter | null = null;

const GZIP_MAGIC_FIRST = 0x1f;
const GZIP_MAGIC_SECOND = 0x8b;

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validateManifest(value: unknown): AssetsManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('LibreOffice asset manifest must be an object');
  }
  const manifest = value as Partial<AssetsManifest>;
  if (
    manifest.version !== MANIFEST_VERSION ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error(`Unsupported LibreOffice asset manifest version`);
  }
  if (manifest.assets.length !== EXPECTED_ASSETS.size) {
    throw new Error('LibreOffice asset manifest is incomplete');
  }

  const filenames = new Set<string>();
  for (const asset of manifest.assets) {
    if (
      !asset ||
      !EXPECTED_ASSETS.has(asset.filename) ||
      filenames.has(asset.filename) ||
      asset.encoding !== 'gzip' ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      !isSha256(asset.sha256) ||
      !Array.isArray(asset.parts) ||
      asset.parts.length === 0
    ) {
      throw new Error('LibreOffice asset manifest contains an invalid asset');
    }
    filenames.add(asset.filename);
    const partNames = new Set<string>();
    let declaredSize = 0;
    const prefix = `${asset.filename}.${asset.sha256.slice(0, 16)}.part-`;
    asset.parts.forEach((part, index) => {
      const expectedName = `${prefix}${String(index).padStart(3, '0')}`;
      if (
        !part ||
        part.name !== expectedName ||
        part.name.includes('/') ||
        part.name.includes('\\') ||
        partNames.has(part.name) ||
        !Number.isSafeInteger(part.size) ||
        part.size <= 0 ||
        part.size > MAX_PART_SIZE ||
        !isSha256(part.sha256)
      ) {
        throw new Error(
          `Invalid or reordered LibreOffice shard at index ${index}`
        );
      }
      partNames.add(part.name);
      declaredSize += part.size;
    });
    if (declaredSize !== asset.size) {
      throw new Error(`LibreOffice shard sizes do not match ${asset.filename}`);
    }
  }
  return manifest as AssetsManifest;
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await blob.arrayBuffer()
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchManifest(basePath: string): Promise<AssetsManifest | null> {
  const response = await fetch(`${basePath}assets-manifest.json`, {
    cache: 'no-cache',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Failed to fetch LibreOffice asset manifest: HTTP ${response.status}`
    );
  }
  try {
    return validateManifest(await response.json());
  } catch (error) {
    throw new Error(
      `Invalid LibreOffice asset manifest: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async function reconstructAsset(
  basePath: string,
  asset: ShardedAsset
): Promise<Blob> {
  const blobs: Blob[] = [];
  for (const part of asset.parts) {
    const response = await fetch(`${basePath}${part.name}`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch LibreOffice shard ${part.name}: HTTP ${response.status}`
      );
    }
    const blob = await response.blob();
    if (blob.size !== part.size) {
      throw new Error(`LibreOffice shard size mismatch: ${part.name}`);
    }
    if ((await sha256(blob)) !== part.sha256) {
      throw new Error(`LibreOffice shard hash mismatch: ${part.name}`);
    }
    blobs.push(blob);
  }
  const compressed = new Blob(blobs, { type: 'application/gzip' });
  if (
    compressed.size !== asset.size ||
    (await sha256(compressed)) !== asset.sha256
  ) {
    throw new Error(
      `Reconstructed LibreOffice asset is corrupt: ${asset.filename}`
    );
  }
  return compressed;
}

async function blobAsDecompressedUrl(
  blob: Blob,
  mimeType: string
): Promise<string> {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (head[0] === GZIP_MAGIC_FIRST && head[1] === GZIP_MAGIC_SECOND) {
    blob = await new Response(
      blob.stream().pipeThrough(new DecompressionStream('gzip'))
    ).blob();
  }
  return URL.createObjectURL(new Blob([blob], { type: mimeType }));
}

async function fetchAsDecompressedUrl(
  url: string,
  mimeType: string
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return blobAsDecompressedUrl(await response.blob(), mimeType);
}

export async function loadLibreOfficeAssetUrls(basePath: string): Promise<{
  sofficeWasmUrl: string;
  sofficeDataUrl: string;
  sharded: boolean;
}> {
  const normalizedBasePath = `${basePath.replace(/\/+$/, '')}/`;
  const manifest = await fetchManifest(normalizedBasePath);
  if (!manifest) {
    const [sofficeWasmUrl, sofficeDataUrl] = await Promise.all([
      fetchAsDecompressedUrl(
        `${normalizedBasePath}soffice.wasm.gz`,
        'application/wasm'
      ),
      fetchAsDecompressedUrl(
        `${normalizedBasePath}soffice.data.gz`,
        'application/octet-stream'
      ),
    ]);
    return { sofficeWasmUrl, sofficeDataUrl, sharded: false };
  }

  const asset = (filename: string): ShardedAsset => {
    const match = manifest.assets.find((item) => item.filename === filename);
    if (!match) throw new Error(`LibreOffice manifest is missing ${filename}`);
    return match;
  };
  const [wasmBlob, dataBlob] = await Promise.all([
    reconstructAsset(normalizedBasePath, asset('soffice.wasm.gz')),
    reconstructAsset(normalizedBasePath, asset('soffice.data.gz')),
  ]);
  const [sofficeWasmUrl, sofficeDataUrl] = await Promise.all([
    blobAsDecompressedUrl(wasmBlob, 'application/wasm'),
    blobAsDecompressedUrl(dataBlob, 'application/octet-stream'),
  ]);
  return { sofficeWasmUrl, sofficeDataUrl, sharded: true };
}

export class LibreOfficeConverter {
  private converter: WorkerBrowserConverter | null = null;
  private initialized = false;
  private initializing = false;
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || LIBREOFFICE_LOCAL_PATH;
  }

  async initialize(onProgress?: ProgressCallback): Promise<void> {
    if (this.initialized) return;

    if (this.initializing) {
      while (this.initializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return;
    }

    this.initializing = true;
    let progressCallback = onProgress; // Store original callback

    try {
      progressCallback?.({
        phase: 'loading',
        percent: 0,
        message: 'Loading conversion engine...',
      });

      const { sofficeWasmUrl, sofficeDataUrl } = await loadLibreOfficeAssetUrls(
        this.basePath
      );

      this.converter = new WorkerBrowserConverter({
        sofficeJs: `${this.basePath}soffice.js`,
        sofficeWasm: sofficeWasmUrl,
        sofficeData: sofficeDataUrl,
        sofficeWorkerJs: `${this.basePath}soffice.worker.js`,
        browserWorkerJs: `${this.basePath}browser.worker.global.js`,
        verbose: false,
        onProgress: (info: {
          phase: string;
          percent: number;
          message: string;
        }) => {
          if (progressCallback && !this.initialized) {
            const simplifiedMessage = `Loading conversion engine (${Math.round(info.percent)}%)...`;
            progressCallback({
              phase: info.phase as LoadProgress['phase'],
              percent: info.percent,
              message: simplifiedMessage,
            });
          }
        },
        onReady: () => {
          console.log('[LibreOffice] Ready!');
        },
        onError: (error: Error) => {
          console.error('[LibreOffice] Error:', error);
        },
      });

      await this.converter.initialize();
      this.initialized = true;

      // Call completion message
      progressCallback?.({
        phase: 'ready',
        percent: 100,
        message: 'Conversion engine ready!',
      });

      // Null out the callback to prevent any late-firing progress updates
      progressCallback = undefined;
    } finally {
      this.initializing = false;
    }
  }

  isReady(): boolean {
    return this.initialized && this.converter !== null;
  }

  async convertToPdf(file: File): Promise<Blob> {
    if (!this.converter) {
      throw new Error('Converter not initialized');
    }

    console.log(`[LibreOffice] Converting ${file.name} to PDF...`);
    console.log(
      `[LibreOffice] File type: ${file.type}, Size: ${file.size} bytes`
    );

    try {
      console.log(`[LibreOffice] Reading file as ArrayBuffer...`);
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log(`[LibreOffice] File loaded, ${uint8Array.length} bytes`);

      console.log(`[LibreOffice] Calling converter.convert() with buffer...`);
      const startTime = Date.now();

      // Detect input format - critical for CSV to apply import filters
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      console.log(`[LibreOffice] Detected format from extension: ${ext}`);

      const result = await this.converter.convert(
        uint8Array,
        {
          outputFormat: 'pdf',
          inputFormat: ext as InputFormat,
        },
        file.name
      );

      const duration = Date.now() - startTime;
      console.log(
        `[LibreOffice] Conversion complete! Duration: ${duration}ms, Size: ${result.data.length} bytes`
      );

      // Create a copy to avoid SharedArrayBuffer type issues
      const data = new Uint8Array(result.data);
      return new Blob([data], { type: result.mimeType });
    } catch (error) {
      console.error(`[LibreOffice] Conversion FAILED for ${file.name}:`, error);
      console.error(`[LibreOffice] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async wordToPdf(file: File): Promise<Blob> {
    return this.convertToPdf(file);
  }

  async pptToPdf(file: File): Promise<Blob> {
    return this.convertToPdf(file);
  }

  async excelToPdf(file: File): Promise<Blob> {
    return this.convertToPdf(file);
  }

  async destroy(): Promise<void> {
    if (this.converter) {
      await this.converter.destroy();
    }
    this.converter = null;
    this.initialized = false;
  }
}

export function getLibreOfficeConverter(
  basePath?: string
): LibreOfficeConverter {
  if (!converterInstance) {
    converterInstance = new LibreOfficeConverter(basePath);
  }
  return converterInstance;
}
