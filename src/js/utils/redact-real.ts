import { loadPyMuPDF } from './pymupdf-loader.js';

export interface RedactionResult {
  bytes: Uint8Array;
  matchCount: number;
  engine: 'pymupdf';
  limitations: string[];
}

export async function redactTextFromPdf(
  pdfBytes: Uint8Array,
  searchText: string
): Promise<RedactionResult> {
  const needle = searchText.replace(/\\/g, '').replace(/\p{Cc}/gu, '').trim();
  if (!needle) {
    throw new Error('Enter the exact text to permanently remove.');
  }

  const pymupdf = await loadPyMuPDF();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const doc = await pymupdf.open(blob);
  let matchCount = 0;

  try {
    for (const page of doc.pages()) {
      const rects = page.searchFor(needle);
      for (const rect of rects) {
        page.addRedaction(rect, '', { r: 0, g: 0, b: 0 });
        matchCount += 1;
      }
      if (rects.length > 0) {
        page.applyRedactions();
      }
    }
    const bytes = new Uint8Array(doc.save());
    return {
      bytes,
      matchCount,
      engine: 'pymupdf',
      limitations: [
        'Rasterized words drawn as images are not removed.',
        'OCR text layers that do not match the search string remain.',
        'Attachments and other embedded files are not searched.',
      ],
    };
  } finally {
    doc.close();
  }
}
