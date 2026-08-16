import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFString,
} from 'pdf-lib';
import { loadPdf, pageContentBytes } from '../shared/pdf';
import { headingLike, pageTextFromStreams } from '../shared/text';
import type { PageSignal } from './types';

function destPageIndex(doc: PDFDocument, dest: unknown): number | null {
  try {
    if (dest instanceof PDFArray && dest.size() > 0) {
      const ref = dest.get(0);
      const pages = doc.getPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].ref === ref) return i;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function outlineTitle(dict: PDFDict): string {
  const title = dict.get(PDFName.of('Title'));
  if (title instanceof PDFString || title instanceof PDFHexString) {
    try {
      return title.decodeText();
    } catch {
      return String(title);
    }
  }
  return 'bookmark';
}

function walkOutline(
  doc: PDFDocument,
  dict: PDFDict | undefined,
  out: Array<{ page: number; title: string }>
): void {
  let current = dict;
  while (current) {
    const dest =
      current.get(PDFName.of('Dest')) ||
      (() => {
        const a = current?.get(PDFName.of('A'));
        const action = a ? doc.context.lookup(a) : undefined;
        if (action instanceof PDFDict) return action.get(PDFName.of('D'));
        return undefined;
      })();
    const index = destPageIndex(
      doc,
      dest instanceof PDFArray ? dest : doc.context.lookup(dest)
    );
    if (index !== null)
      out.push({ page: index + 1, title: outlineTitle(current) });
    const first = current.get(PDFName.of('First'));
    if (first)
      walkOutline(
        doc,
        doc.context.lookup(first) instanceof PDFDict
          ? (doc.context.lookup(first) as PDFDict)
          : undefined,
        out
      );
    const next = current.get(PDFName.of('Next'));
    current =
      next && doc.context.lookup(next) instanceof PDFDict
        ? (doc.context.lookup(next) as PDFDict)
        : undefined;
  }
}

export function readBookmarks(
  doc: PDFDocument
): Array<{ page: number; title: string }> {
  const outlines = doc.catalog.lookup(PDFName.of('Outlines'));
  if (!(outlines instanceof PDFDict)) return [];
  const first = outlines.lookup(PDFName.of('First'));
  const out: Array<{ page: number; title: string }> = [];
  if (first instanceof PDFDict) walkOutline(doc, first, out);
  return out;
}

export async function collectPageSignals(
  bytes: Uint8Array,
  extras?: {
    bookmarks?: Array<{ page: number; title: string }>;
    barcodes?: Array<{ page: number; value: string }>;
    capture?: { regex: string; name?: string };
  }
): Promise<PageSignal[]> {
  const doc = await loadPdf(bytes);
  const bookmarks = extras?.bookmarks?.length
    ? extras.bookmarks
    : readBookmarks(doc);
  const barcodeByPage = new Map(
    (extras?.barcodes || []).map((b) => [b.page, b.value])
  );
  const captureRe = extras?.capture?.regex
    ? new RegExp(extras.capture.regex)
    : null;
  const signals: PageSignal[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const text = pageTextFromStreams(doc, i);
    const contentLen = pageContentBytes(doc, i).length;
    const firstLine =
      text
        .split(/\n/)
        .map((l) => l.trim())
        .find(Boolean) || text.slice(0, 80);
    const bm = bookmarks.find((b) => b.page === i + 1);
    let captured: string | undefined;
    if (captureRe) {
      const match = text.match(captureRe);
      captured = match?.[1] || match?.[0];
    }
    const barcode = barcodeByPage.get(i + 1);
    // Production path never invents barcodes from text markers like "QR:…".
    // Those markers remain test-only helpers outside this function.
    signals.push({
      page: i + 1,
      width,
      height,
      orientation:
        Math.abs(width - height) < 1
          ? 'square'
          : width > height
            ? 'landscape'
            : 'portrait',
      probableBlank: contentLen < 48 && !text.trim(),
      text,
      heading: headingLike(firstLine) ? firstLine : undefined,
      bookmark: bm?.title,
      barcode,
      captured,
    });
  }
  return signals;
}
