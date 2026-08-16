import { PDFDocument } from 'pdf-lib';
import { latin1 } from './bytes';
import { pageContentBytes } from './pdf';

const PAREN = /\((?:\\.|[^\\)])*\)/g;

function unescapePdfString(inner: string): string {
  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, oct: string) =>
      String.fromCharCode(parseInt(oct, 8))
    );
}

export function stringsFromContentStream(bytes: Uint8Array): string[] {
  const raw = latin1(bytes);
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(PAREN.source, 'g');
  while ((match = re.exec(raw))) {
    const decoded = unescapePdfString(match[0].slice(1, -1));
    if (decoded) out.push(decoded);
  }
  const hex = raw.matchAll(/<([0-9A-Fa-f]{4,})>/g);
  for (const hit of hex) {
    const hexStr = hit[1];
    if (hexStr.length % 2 !== 0) continue;
    let text = '';
    for (let i = 0; i < hexStr.length; i += 2) {
      text += String.fromCharCode(parseInt(hexStr.slice(i, i + 2), 16));
    }
    if (/[\x20-\x7e]{3,}/.test(text)) out.push(text);
  }
  return out;
}

export function pageTextFromStreams(
  doc: PDFDocument,
  pageIndex: number
): string {
  return stringsFromContentStream(pageContentBytes(doc, pageIndex)).join(' ');
}

export function documentTextFromStreams(doc: PDFDocument): string[] {
  const pages: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    pages.push(pageTextFromStreams(doc, i));
  }
  return pages;
}

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

export function headingLike(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  if (/[.!?]{2,}/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 12) return false;
  const titled = words.filter((w) => /^[A-Z0-9]/.test(w)).length;
  return titled >= Math.ceil(words.length * 0.6);
}
