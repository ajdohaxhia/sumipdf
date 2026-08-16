/// <reference lib="webworker" />
import { analyzePdfBytes } from './analyze';
import type { InspectProgress } from './types';

self.onmessage = async (event: MessageEvent) => {
  const data = event.data as { bytes: ArrayBuffer; fileName: string };
  try {
    const bytes = new Uint8Array(data.bytes);
    const map = await analyzePdfBytes(bytes, {
      fileName: data.fileName,
      onProgress: (progress: InspectProgress) => {
        self.postMessage({ type: 'progress', progress });
      },
    });
    self.postMessage({ type: 'done', map });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ type: 'error', message });
  }
};
