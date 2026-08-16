import { loadPdf } from '../shared/pdf';
import { documentTextFromStreams } from '../shared/text';
import { findPatterns } from './patterns';
import { groupHits } from './group';
import type {
  PrivacyHit,
  PrivacyScanOptions,
  PrivacyScanResult,
} from './types';

function contextAround(text: string, start: number, end: number): string {
  return text
    .slice(Math.max(0, start - 24), Math.min(text.length, end + 24))
    .trim();
}

export async function scanPrivacy(
  bytes: Uint8Array,
  options: PrivacyScanOptions = {}
): Promise<PrivacyScanResult> {
  const doc = await loadPdf(bytes);
  const pages = documentTextFromStreams(doc);
  const excluded = new Set(
    (options.excludedValues || []).map((v) => v.toLowerCase())
  );
  const hits: PrivacyHit[] = [];
  const emptyTextPages: number[] = [];
  let id = 0;

  for (let i = 0; i < pages.length; i++) {
    const text = pages[i];
    if (!text.trim()) emptyTextPages.push(i + 1);
    const matches = findPatterns(text, options.customTerms);
    for (const match of matches) {
      if (excluded.has(match.value.toLowerCase())) continue;
      id += 1;
      hits.push({
        id: `hit-${id}`,
        kind: match.kind,
        value: match.value,
        page: i + 1,
        confidence: match.confidence,
        start: match.start,
        end: match.end,
        context: contextAround(text, match.start, match.end),
        checksumOk: match.checksumOk,
      });
    }
  }

  const usedOcr = Boolean(options.includeOcr && emptyTextPages.length > 0);
  const limitations = [
    'Text-layer scan first. OCR runs only when you ask and a page has little extractable text.',
    'No name or address guessing. Custom terms are literal strings you typed.',
    'Checksummed IBAN, card, Codice Fiscale, and Italian VAT values still need a human review.',
  ];
  if (usedOcr) {
    limitations.push(
      'OCR was requested for pages with little text. Quality depends on resolution.'
    );
  }

  return {
    hits,
    groups: groupHits(hits),
    usedOcr: false,
    textLayerPages: pages.filter((p) => p.trim()).length,
    emptyTextPages,
    limitations,
  };
}
