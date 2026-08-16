import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  collectPageSignals,
  planSplit,
  executeSplitPlan,
} from '@/js/sumi/smart-split';
import {
  applyNameTemplate,
  sanitizeFilename,
} from '@/js/sumi/shared/filenames';

async function sixPagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const texts = [
    'Chapter One intro',
    'body',
    'Chapter Two intro',
    'QR:ALPHA more',
    'QR:BETA more',
    'Invoice INV-99 footer',
  ];
  const sizes: Array<[number, number]> = [
    [400, 500],
    [400, 500],
    [400, 500],
    [600, 400],
    [600, 400],
    [400, 500],
  ];
  texts.forEach((text, i) => {
    const page = doc.addPage(sizes[i]);
    page.drawText(text, { x: 40, y: 240, size: 14, font });
  });
  return doc.save();
}

describe('Smart Split', () => {
  it('sanitizes templates and splits by page count, headings, size, QR, and captured values', async () => {
    expect(sanitizeFilename('a<>:"/\\|?*.pdf')).toBe('a_________.pdf');
    expect(
      applyNameTemplate('{original}-{counter}-{barcode}-{match:inv}.pdf', {
        counter: 3,
        original: 'pack',
        barcode: 'ALPHA',
        match: { inv: 'INV-99' },
      })
    ).toBe('pack-03-ALPHA-INV-99.pdf');

    const bytes = await sixPagePdf();
    const signals = await collectPageSignals(bytes);
    expect(signals).toHaveLength(6);

    const byCount = planSplit(signals, {
      rule: 'page-count',
      pageCount: 2,
      originalName: 'pack.pdf',
    });
    expect(byCount.groups).toHaveLength(3);
    expect(byCount.groups[0].pages).toEqual([1, 2]);

    const headings = planSplit(signals, {
      rule: 'headings',
      originalName: 'pack.pdf',
    });
    expect(headings.groups[0].pages[0]).toBe(1);

    const sizes = planSplit(signals, {
      rule: 'page-size',
      originalName: 'pack.pdf',
    });
    expect(sizes.groups.length).toBeGreaterThan(1);

    const qr = planSplit(signals, { rule: 'qr', originalName: 'pack.pdf' });
    expect(
      qr.groups.some((g) => g.barcode === 'ALPHA' || g.pages.includes(4))
    ).toBe(true);

    const captured = planSplit(signals, {
      rule: 'captured-value',
      regex: 'INV-(\\d+)',
      captureName: 'inv',
      template: '{original}-{match:inv}-{counter}.pdf',
      originalName: 'pack.pdf',
    });
    expect(captured.groups.length).toBeGreaterThan(0);

    const zip = await executeSplitPlan(bytes, byCount);
    expect(zip.files).toHaveLength(3);
    expect(zip.zip.byteLength).toBeGreaterThan(100);
    expect(new Set(zip.files.map((f) => f.name)).size).toBe(zip.files.length);
  });
});
