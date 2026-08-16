/**
 * Cancellable custom-regex scan worker for Privacy Finder.
 * Main thread validates complexity first; this worker only executes approved patterns.
 */
import { matchCustomRegex, validateCustomRegex } from './regex-safe';

export type RegexWorkerRequest = {
  id: string;
  text: string;
  pattern: string;
};

export type RegexWorkerResponse =
  | {
      id: string;
      ok: true;
      hits: Array<{ value: string; start: number; end: number }>;
    }
  | { id: string; ok: false; reason: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RegexWorkerRequest>) => void) | null;
  postMessage: (message: RegexWorkerResponse) => void;
};

workerScope.onmessage = (event: MessageEvent<RegexWorkerRequest>) => {
  const { id, text, pattern } = event.data;
  const validated = validateCustomRegex(pattern);
  if (validated.ok === false) {
    workerScope.postMessage({ id, ok: false, reason: validated.reason });
    return;
  }
  try {
    const hits = matchCustomRegex(text, pattern);
    workerScope.postMessage({ id, ok: true, hits });
  } catch (error) {
    workerScope.postMessage({
      id,
      ok: false,
      reason: error instanceof Error ? error.message : 'Regex scan failed',
    });
  }
};
