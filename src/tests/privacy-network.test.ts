import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizePdf, defaultSanitizeOptions } from '@/js/utils/sanitize';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const MARKER = 'SUMI_PRIVACY_NET_MARKER_7f3a';

async function syntheticPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(MARKER, { x: 40, y: 100, size: 14, font });
  doc.setTitle(MARKER);
  return doc.save();
}

describe('privacy: document bytes stay local', () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    calls.length = 0;
  });

  it('sanitize does not send the marker over fetch', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes(MARKER)) {
        throw new Error('document marker leaked in URL');
      }
      return originalFetch(input);
    }) as typeof fetch;

    const bytes = await syntheticPdf();
    const result = await sanitizePdf(bytes, {
      ...defaultSanitizeOptions,
      removeFonts: false,
    });
    const body = JSON.stringify(calls);
    expect(body).not.toContain(MARKER);
    expect(result.report.engine).toBe('pdf-lib');
    const out = new TextDecoder('latin1').decode(result.bytes);
    expect(out.includes('/Title')).toBe(true);
  });
});
