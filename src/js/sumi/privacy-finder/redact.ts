import { PDFName, rgb } from 'pdf-lib';
import { loadPdf, pageContentBytes } from '../shared/pdf';
import { markerExtractable } from '../../proof/metrics';
import type { PrivacyHit } from './types';

export type RedactionMode = 'true' | 'cover';

export interface PrivacyRedactRequest {
  hits: PrivacyHit[];
  mode: RedactionMode;
}

export interface PrivacyRedactResult {
  bytes: Uint8Array;
  mode: RedactionMode;
  markers: string[];
  stillExtractable: string[];
  notes: string[];
}

function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function scrubDecodedStream(decoded: string, needle: string): string {
  if (!needle) return decoded;
  let out = decoded.split(needle).join(' '.repeat(needle.length));
  const hex = Array.from(needle)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  const blankHex = '20'.repeat(needle.length);
  out = out.replace(new RegExp(hex, 'gi'), blankHex);
  return out;
}

/** Local fallback when PyMuPDF is unavailable: rewrite decoded page streams. */
async function scrubMarkersInStreams(
  bytes: Uint8Array,
  markers: string[]
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  for (let i = 0; i < doc.getPageCount(); i++) {
    let decoded = new TextDecoder('latin1').decode(pageContentBytes(doc, i));
    if (!decoded.trim()) continue;
    for (const marker of markers) {
      decoded = scrubDecodedStream(decoded, marker);
    }
    const stream = doc.context.stream(latin1Bytes(decoded), {});
    doc
      .getPage(i)
      .node.set(PDFName.of('Contents'), doc.context.register(stream));
  }
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

export async function coverHits(
  bytes: Uint8Array,
  hits: PrivacyHit[]
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const pagesTouched = new Set(hits.map((h) => h.page));
  for (const pageNo of pagesTouched) {
    const page = doc.getPage(pageNo - 1);
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: 36,
      y: height / 2 - 14,
      width: Math.max(80, width - 72),
      height: 28,
      color: rgb(0, 0, 0),
    });
  }
  return new Uint8Array(await doc.save());
}

export async function stripExtractableHits(
  bytes: Uint8Array,
  hits: PrivacyHit[]
): Promise<Uint8Array> {
  const unique = [...new Set(hits.map((h) => h.value).filter(Boolean))];
  try {
    const { redactTextFromPdf } = await import('../../utils/redact-real.js');
    let current = bytes.slice();
    for (const value of unique) {
      const result = await redactTextFromPdf(current, value);
      current = new Uint8Array(result.bytes);
    }
    return current;
  } catch {
    return scrubMarkersInStreams(bytes, unique);
  }
}

export async function applyPrivacyRedaction(
  bytes: Uint8Array,
  request: PrivacyRedactRequest
): Promise<PrivacyRedactResult> {
  if (request.hits.length === 0) {
    throw new Error(
      'Select at least one finding. Privacy Finder never auto-redacts all hits.'
    );
  }
  const markers = [...new Set(request.hits.map((h) => h.value))];
  if (request.mode === 'cover') {
    const out = await coverHits(bytes, request.hits);
    const still: string[] = [];
    for (const marker of markers) {
      if (await markerExtractable(out, marker)) still.push(marker);
    }
    return {
      bytes: out,
      mode: 'cover',
      markers,
      stillExtractable: still,
      notes: [
        'Visual cover only. This is not redaction.',
        still.length
          ? 'Listed markers are still extractable from the file bytes.'
          : 'Cover drew rectangles; extractability still depends on what the stream stored.',
      ],
    };
  }
  const out = await stripExtractableHits(bytes, request.hits);
  const still: string[] = [];
  for (const marker of markers) {
    if (await markerExtractable(out, marker)) still.push(marker);
  }
  return {
    bytes: out,
    mode: 'true',
    markers,
    stillExtractable: still,
    notes: still.length
      ? [
          'True redaction was requested, but at least one marker is still extractable.',
          'Images of the same words can survive. PyMuPDF is used when the engine loads.',
        ]
      : [
          'Requested markers were not found in the output bytes.',
          'Images of the same words, attachments, and other encodings can still remain.',
        ],
  };
}
