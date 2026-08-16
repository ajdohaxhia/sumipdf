import { analyzePdfBytes } from './analyze';
import type { DocumentMap, InspectProgress } from './types';

export interface RunInspectOptions {
  fileName: string;
  signal?: AbortSignal;
  onProgress?: (progress: InspectProgress) => void;
}

function revokeLater(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* already revoked */
  }
}

/**
 * Run Inspect. Prefers a worker so the UI stays responsive.
 * Falls back to the main thread when workers are unavailable (tests, file://).
 * Always revokes object URLs created here. Never persists bytes.
 */
export async function runInspect(
  bytes: Uint8Array,
  options: RunInspectOptions
): Promise<DocumentMap> {
  const copy = bytes.slice();
  if (typeof Worker === 'undefined') {
    return analyzePdfBytes(copy, options);
  }

  return new Promise<DocumentMap>((resolve, reject) => {
    let worker: Worker | null = null;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', onAbort);
      try {
        worker?.terminate();
      } catch {
        /* ignore */
      }
      worker = null;
      fn();
    };
    const onAbort = () => {
      finish(() => {
        const error = new Error('Inspect cancelled');
        error.name = 'AbortError';
        reject(error);
      });
    };

    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      analyzePdfBytes(copy, options).then(resolve, reject);
      return;
    }

    options.signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: 'progress'; progress: InspectProgress }
        | { type: 'done'; map: DocumentMap }
        | { type: 'error'; message: string };
      if (data.type === 'progress') {
        options.onProgress?.(data.progress);
        return;
      }
      if (data.type === 'done') {
        finish(() => resolve(data.map));
        return;
      }
      finish(() => reject(new Error(data.message || 'Inspect failed')));
    };
    worker.onerror = (event) => {
      finish(() => {
        worker = null;
        analyzePdfBytes(copy, options).then(resolve, reject);
        void event;
      });
    };
    const buffer = copy.buffer.slice(
      copy.byteOffset,
      copy.byteOffset + copy.byteLength
    );
    worker.postMessage({ bytes: buffer, fileName: options.fileName }, [buffer]);
  })
    .catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return analyzePdfBytes(bytes.slice(), options);
    })
    .finally(() => {
      void revokeLater;
    });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
