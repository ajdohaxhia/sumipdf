import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { analyzePdfBytes } from '@/js/inspect/analyze';
import { executeFlow } from '@/js/flow/executor';
import { FlowStack } from '@/js/flow/stack';

const MARKER = 'SUMI_LOCAL_ONLY_MARKER_9c2';

describe('inspect/flow do not leak document bytes over fetch', () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  afterEach(() => {
    globalThis.fetch = originalFetch;
    calls.length = 0;
  });

  it('analyze and reverse stay local', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes(MARKER))
        throw new Error('document marker leaked in URL');
      return originalFetch(input);
    }) as typeof fetch;

    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(MARKER, { x: 20, y: 100, size: 12, font });
    const bytes = await doc.save();
    await analyzePdfBytes(bytes, { fileName: 'local.pdf' });
    const stack = new FlowStack();
    stack.addStep('reverse');
    await executeFlow(stack.document, { bytes, fileName: 'local.pdf' });
    expect(JSON.stringify(calls)).not.toContain(MARKER);
  });
});
