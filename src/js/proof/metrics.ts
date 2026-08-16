import { PDFDocument } from 'pdf-lib';
import { sha256Hex } from './hash';
import type { ProofMetrics } from './types';

function latin1(bytes: Uint8Array, limit = 1_500_000): string {
  return new TextDecoder('latin1').decode(
    bytes.subarray(0, Math.min(bytes.length, limit))
  );
}

function hexOfAscii(marker: string): string {
  return Array.from(marker)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

export async function collectMetrics(bytes: Uint8Array): Promise<ProofMetrics> {
  const raw = latin1(bytes);
  let pageCount: number;
  let title: string | null = null;
  let author: string | null = null;
  let formFieldCount = 0;
  let hasForm = false;
  try {
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });
    pageCount = doc.getPageCount();
    title = doc.getTitle() || null;
    author = doc.getAuthor() || null;
    try {
      const fields = doc.getForm().getFields();
      formFieldCount = fields.length;
      hasForm = fields.length > 0;
    } catch {
      hasForm = /\/AcroForm\b/.test(raw);
    }
  } catch {
    pageCount = 0;
  }
  return {
    byteLength: bytes.byteLength,
    pageCount,
    sha256: await sha256Hex(bytes),
    title,
    author,
    hasForm,
    formFieldCount,
    hasJavaScript: /\/JavaScript\b|\/JS[\s/]/.test(raw),
    hasAttachments: /\/EmbeddedFiles\b|\/FileAttachment\b/.test(raw),
    hasOcrLayer: /\/ActualText\b|Tesseract|tesseract/i.test(raw),
    encrypted: /\/Encrypt\b/.test(raw),
  };
}

/**
 * True when `marker` appears as extractable text: raw ASCII, hex-encoded ASCII
 * in the file body, or decoded page content streams (Flate + hex/`()` strings).
 */
export async function markerExtractable(
  bytes: Uint8Array,
  marker: string
): Promise<boolean> {
  if (!marker) return false;
  const raw = latin1(bytes, bytes.byteLength);
  if (raw.includes(marker)) return true;
  if (raw.toLowerCase().includes(hexOfAscii(marker).toLowerCase())) return true;
  try {
    const { loadPdf, pageContentBytes } = await import('../sumi/shared/pdf');
    const { stringsFromContentStream } = await import('../sumi/shared/text');
    const doc = await loadPdf(bytes);
    for (let i = 0; i < doc.getPageCount(); i++) {
      const parts = stringsFromContentStream(pageContentBytes(doc, i));
      if (parts.some((part) => part.includes(marker))) return true;
      if (parts.join('').includes(marker)) return true;
    }
  } catch {
    return false;
  }
  return false;
}
