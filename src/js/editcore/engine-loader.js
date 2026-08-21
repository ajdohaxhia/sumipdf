import createModule from 'bentopdf-pdfium';

const inBrowser = typeof window !== 'undefined';

const wasmUrl = inBrowser
  ? new URL('bentopdf-pdfium/editcore.wasm', import.meta.url).href
  : new URL(import.meta.resolve('bentopdf-pdfium/editcore.wasm')).pathname;

export const ENGINE_BUILD = 'bentopdf-pdfium';

export function createEngineModule(options) {
  return createModule({
    ...(options ?? {}),
    locateFile: (file, prefix) =>
      file.endsWith('.wasm') ? wasmUrl : `${prefix}${file}`,
  });
}
