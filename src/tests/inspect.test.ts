import { describe, expect, it } from 'vitest';
import { PDFName, PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { analyzePdfBytes } from '@/js/inspect/analyze';

async function makePdf(options?: {
  pages?: number;
  blankLast?: boolean;
  duplicate?: boolean;
  title?: string;
  author?: string;
  js?: boolean;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const count = options?.pages ?? 2;
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([400, 500]);
    const isBlank = Boolean(options?.blankLast && i === count - 1);
    if (!isBlank) {
      page.drawText(`Page ${i + 1} SUMIINSPECT`, {
        x: 40,
        y: 240,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
  if (options?.duplicate) {
    const [copied] = await doc.copyPages(doc, [0]);
    doc.addPage(copied);
  }
  if (options?.title) doc.setTitle(options.title);
  if (options?.author) doc.setAuthor(options.author);
  if (options?.js) {
    doc.setSubject('probe JavaScript OpenAction');
    doc.catalog.set(
      PDFName.of('OpenAction'),
      doc.context.obj({
        Type: 'Action',
        S: 'JavaScript',
        JS: 'app.alert("must-not-run")',
      })
    );
  }
  return doc.save();
}

describe('Sumi Inspect heuristics', () => {
  it('reports size, pages, dimensions, and metadata with hedged findings', async () => {
    const bytes = await makePdf({
      pages: 2,
      title: 'Quarterly pack',
      author: 'Ada Example',
    });
    const map = await analyzePdfBytes(bytes, { fileName: 'pack.pdf' });
    expect(map.engine).toBe('pdf-lib');
    expect(map.facts.pageCount).toBe(2);
    expect(map.facts.byteLength).toBe(bytes.byteLength);
    expect(map.facts.metadata.title).toBe('Quarterly pack');
    expect(map.facts.metadata.author).toBe('Ada Example');
    expect(map.pages[0].widthPt).toBeGreaterThan(0);
    expect(map.pages[0].orientation).toBe('portrait');
    const meta = map.findings.find((f) => f.id === 'metadata');
    expect(meta?.recommendedOp).toBe('remove-metadata');
    expect(meta?.hedge.toLowerCase()).toContain('metadata');
    expect(map.findings.some((f) => f.id === 'size-pages')).toBe(true);
  });

  it('flags mixed page sizes and apparent blank pages', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 500]);
    doc.addPage([600, 400]);
    doc.addPage([400, 500]);
    const bytes = await doc.save();
    const map = await analyzePdfBytes(bytes, { fileName: 'mixed.pdf' });
    expect(map.facts.mixedPageSize).toBe(true);
    expect(map.findings.some((f) => f.id === 'mixed-size')).toBe(true);
    expect(map.findings.some((f) => f.id === 'blank-pages')).toBe(true);
    expect(map.pages.every((p) => p.probableBlank)).toBe(true);
  });

  it('marks probable duplicates via content hash', async () => {
    const bytes = await makePdf({ pages: 1, duplicate: true });
    const map = await analyzePdfBytes(bytes, { fileName: 'dup.pdf' });
    const dup = map.findings.find((f) => f.id === 'probable-duplicates');
    expect(dup).toBeTruthy();
    expect(dup?.hedge.toLowerCase()).toContain('probable');
    expect(dup?.recommendedOp).toBe('delete-pages');
  });

  it('detects javascript/open-action markers without executing them', async () => {
    const bytes = await makePdf({ pages: 1, js: true });
    const map = await analyzePdfBytes(bytes, { fileName: 'js.pdf' });
    expect(map.facts.hasJavaScript || map.facts.hasOpenAction).toBe(true);
    const active = map.findings.find((f) => f.id === 'active-content');
    expect(active?.recommendedOp).toBe('sanitize');
    expect(active?.hedge.toLowerCase()).toContain('heuristic');
  });

  it('never claims to have modified the document', async () => {
    const bytes = await makePdf({ pages: 1, title: 'x' });
    const map = await analyzePdfBytes(bytes, { fileName: 'x.pdf' });
    expect(map.limitations.some((line) => /modified/i.test(line))).toBe(true);
  });
});
