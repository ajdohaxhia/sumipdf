import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  collectPageSignals,
  planSplit,
  executeSplitPlan,
  decodePngBarcodes,
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
    'section A more',
    'section B more',
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
  it('sanitizes templates and splits by page count, headings, size, and captured values', async () => {
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
    const signals = await collectPageSignals(bytes, {
      barcodes: [
        { page: 4, value: 'ALPHA' },
        { page: 5, value: 'BETA' },
      ],
    });
    expect(signals).toHaveLength(6);
    expect(signals.some((s) => s.barcode === 'ALPHA')).toBe(true);

    const byCount = planSplit(signals, {
      rule: 'page-count',
      pageCount: 2,
      originalName: 'pack.pdf',
    });
    expect(byCount.groups).toHaveLength(3);

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
    expect(qr.groups.some((g) => g.barcode === 'ALPHA')).toBe(true);

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
  });

  it('decodes real QR and Code 128 PNG fixtures with ZXing (not text markers)', () => {
    const dir = resolve(__dirname, 'fixtures/barcodes');
    const qrPng = new Uint8Array(readFileSync(resolve(dir, 'qr.png')));
    const codePng = new Uint8Array(readFileSync(resolve(dir, 'code128.png')));
    const eanPng = new Uint8Array(readFileSync(resolve(dir, 'ean13.png')));

    const qr = decodePngBarcodes(qrPng);
    expect(qr.some((h) => h.rawValue === 'SUMI-QR-ALPHA')).toBe(true);
    expect(qr[0].format).toBe('qr_code');
    expect(qr[0].engine).toBe('ZXing');

    const code = decodePngBarcodes(codePng);
    expect(code.some((h) => h.rawValue === 'SUMI128TEST')).toBe(true);
    expect(code[0].format).toBe('code_128');

    const ean = decodePngBarcodes(eanPng);
    expect(ean.some((h) => h.rawValue.includes('5901234123457'))).toBe(true);
    expect(ean[0].format).toBe('ean_13');
  });

  it('decodes barcodes from real PDF fixture bytes via production scanner', async () => {
    const dir = resolve(__dirname, 'fixtures/barcodes');
    const qrPdf = new Uint8Array(readFileSync(resolve(dir, 'qr.pdf')));
    const codePdf = new Uint8Array(readFileSync(resolve(dir, 'code128.pdf')));
    const eanPdf = new Uint8Array(readFileSync(resolve(dir, 'ean13.pdf')));
    const nonePdf = new Uint8Array(readFileSync(resolve(dir, 'no-code.pdf')));

    const { scanPdfBarcodes } = await import('@/js/sumi/smart-split');

    const qr = await scanPdfBarcodes(qrPdf);
    expect(qr.hits.some((h) => h.rawValue === 'SUMI-QR-ALPHA')).toBe(true);

    const code = await scanPdfBarcodes(codePdf);
    expect(code.hits.some((h) => h.rawValue === 'SUMI128TEST')).toBe(true);

    const ean = await scanPdfBarcodes(eanPdf);
    expect(ean.hits.some((h) => h.rawValue.includes('5901234123457'))).toBe(
      true
    );

    const none = await scanPdfBarcodes(nonePdf);
    expect(none.hits).toHaveLength(0);
  });

  it('does not treat QR: text markers as decoded barcodes', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 400]);
    page.drawText('QR:SHOULD-NOT-DECODE', { x: 40, y: 200, size: 14, font });
    const bytes = await doc.save();
    const signals = await collectPageSignals(bytes);
    expect(signals[0].barcode).toBeUndefined();
  });
});
