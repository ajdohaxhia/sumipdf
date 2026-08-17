import { createHash } from 'node:crypto';
import { Blob as NodeBlob } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@matbee/libreoffice-converter/browser', () => ({
  WorkerBrowserConverter: class {},
}));

import { loadLibreOfficeAssetUrls } from '../js/utils/libreoffice-loader';

const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

function manifestFor(wasm: Uint8Array, data: Uint8Array) {
  const sources: Array<[string, Uint8Array]> = [
    ['soffice.wasm.gz', wasm],
    ['soffice.data.gz', data],
  ];
  return {
    version: 1,
    assets: sources.map(([filename, bytes]) => {
      const sha256 = hash(bytes);
      return {
        filename,
        size: bytes.byteLength,
        sha256,
        encoding: 'gzip',
        parts: [
          {
            name: `${filename}.${sha256.slice(0, 16)}.part-000`,
            size: bytes.byteLength,
            sha256,
          },
        ],
      };
    }),
  };
}

type TestResponseBody = string | Uint8Array;

function response(body: TestResponseBody, init?: { status?: number }) {
  return new Response(
    typeof body === 'string' ? body : Uint8Array.from(body).buffer,
    init
  );
}

describe('LibreOffice production shard loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('DecompressionStream', globalThis.DecompressionStream);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (blob) => `blob:test-${(blob as Blob).type}-${(blob as Blob).size}`
    );
  });

  it('uses the manifest and same-origin chunks under a non-root BASE_URL', async () => {
    const wasm = gzipSync('wasm payload');
    const data = gzipSync('data payload');
    const manifest = manifestFor(wasm, data);
    const bodies = new Map<string, TestResponseBody>([
      ['/sub/libreoffice-wasm/assets-manifest.json', JSON.stringify(manifest)],
      ...manifest.assets.map(
        (asset) =>
          [
            `/sub/libreoffice-wasm/${asset.parts[0].name}`,
            asset.filename.includes('wasm') ? wasm : data,
          ] as [string, TestResponseBody]
      ),
    ]);
    const fetchMock = vi.fn(async (url: string) =>
      bodies.has(url)
        ? response(bodies.get(url)!)
        : response('', { status: 404 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadLibreOfficeAssetUrls('/sub/libreoffice-wasm/');
    expect(result.sharded).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/sub/libreoffice-wasm/assets-manifest.json',
      { cache: 'no-cache' }
    );
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('soffice.wasm.gz')
      )
    ).toBe(false);
  });

  it('falls back to original gzip files only when the manifest is absent', async () => {
    const wasm = gzipSync('wasm');
    const data = gzipSync('data');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('assets-manifest.json'))
        return response('', { status: 404 });
      return response(url.includes('wasm') ? wasm : data);
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await loadLibreOfficeAssetUrls('/dev/libreoffice-wasm/');
    expect(result.sharded).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      '/dev/libreoffice-wasm/soffice.wasm.gz'
    );
  });

  it('fails closed for missing, reordered, or corrupt parts', async () => {
    const wasm = gzipSync('wasm payload');
    const data = gzipSync('data payload');
    const malformed = manifestFor(wasm, data);
    malformed.assets[0].parts[0].name =
      malformed.assets[0].parts[0].name.replace('part-000', 'part-001');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(JSON.stringify(malformed)))
    );
    await expect(
      loadLibreOfficeAssetUrls('/libreoffice-wasm/')
    ).rejects.toThrow(/reordered/);

    const valid = manifestFor(wasm, data);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('assets-manifest.json'))
          return response(JSON.stringify(valid));
        return response('corrupt');
      })
    );
    await expect(
      loadLibreOfficeAssetUrls('/libreoffice-wasm/')
    ).rejects.toThrow(/size mismatch|hash mismatch/);
  });
});
