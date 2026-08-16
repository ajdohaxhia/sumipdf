import { matchCustomRegex, validateCustomRegex } from './regex-safe';

export async function runCustomRegexInWorker(
  text: string,
  pattern: string,
  signal?: AbortSignal
): Promise<Array<{ value: string; start: number; end: number }>> {
  const validated = validateCustomRegex(pattern);
  if (validated.ok === false) throw new Error(validated.reason);

  if (typeof Worker === 'undefined') {
    return matchCustomRegex(text, pattern, signal);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./regex-worker.ts', import.meta.url), {
      type: 'module',
    });
    const id = `rx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const onAbort = () => {
      worker.terminate();
      const err = new Error('Regex scan cancelled');
      err.name = 'AbortError';
      reject(err);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (event: MessageEvent) => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      const data = event.data as {
        id: string;
        ok: boolean;
        hits?: Array<{ value: string; start: number; end: number }>;
        reason?: string;
      };
      if (!data.ok) reject(new Error(data.reason || 'Regex scan failed'));
      else resolve(data.hits || []);
    };
    worker.onerror = (error) => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      reject(error);
    };
    worker.postMessage({ id, text, pattern });
  });
}
