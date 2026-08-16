import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { scanSentinel } from '@/js/sumi/sentinel';
import { scanPrivacy } from '@/js/sumi/privacy-finder';

const MARKER = 'SUMI_ORIGINAL_NET_MARKER_k7';

describe('originals do not leak document bytes over fetch', () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  afterEach(() => {
    globalThis.fetch = originalFetch;
    calls.length = 0;
  });

  it('Sentinel and Privacy Finder stay local', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes(MARKER))
        throw new Error('document marker leaked in URL');
      return originalFetch(input);
    }) as typeof fetch;

    const doc = await PDFDocument.create();
    const page = doc.addPage([240, 240]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(`${MARKER} ada@example.com`, {
      x: 20,
      y: 100,
      size: 10,
      font,
    });
    doc.catalog.set(
      PDFName.of('OpenAction'),
      doc.context.obj({ S: 'JavaScript', JS: 'void 0' })
    );
    const bytes = await doc.save();
    await scanSentinel(bytes, 'local.pdf');
    await scanPrivacy(bytes);
    expect(JSON.stringify(calls)).not.toContain(MARKER);
  });
});
