import { sha256Hex, djb2Hex } from '../shared/bytes';
import { pageContentBytes, loadPdf } from '../shared/pdf';
import { normalizeText, pageTextFromStreams } from '../shared/text';
import type {
  DuplicateKind,
  DuplicateReport,
  DuplicateSet,
  PageFingerprint,
} from './types';

export function averageHashFromGray(samples: number[]): string {
  if (!samples.length) return '0'.repeat(16);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  let bits = '';
  for (const value of samples) bits += value >= mean ? '1' : '0';
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, '0'), 2).toString(16);
  }
  return hex.padEnd(16, '0').slice(0, 16);
}

export function hammingHex(a: string, b: string): number {
  const len = Math.max(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    const x = parseInt(a[i] || '0', 16) ^ parseInt(b[i] || '0', 16);
    dist += x.toString(2).replace(/0/g, '').length;
  }
  return dist;
}

function entropy(bytes: Uint8Array): number {
  if (!bytes.length) return 0;
  const freq = new Array(256).fill(0);
  for (const b of bytes) freq[b] += 1;
  let h = 0;
  for (const c of freq) {
    if (!c) continue;
    const p = c / bytes.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export async function fingerprintPages(
  bytes: Uint8Array
): Promise<PageFingerprint[]> {
  const doc = await loadPdf(bytes);
  const out: PageFingerprint[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const content = pageContentBytes(doc, i);
    const text = normalizeText(pageTextFromStreams(doc, i));
    const gray = Array.from(content.subarray(0, 64)).map((b, idx) => {
      const next = content[idx + 64] ?? b;
      return (b + next) / 2;
    });
    while (gray.length < 64) gray.push(0);
    out.push({
      page: i + 1,
      contentHash: (await sha256Hex(content)) + ':' + djb2Hex(content),
      textFingerprint: text
        ? await sha256Hex(new TextEncoder().encode(text))
        : '',
      perceptualHash: averageHashFromGray(gray.slice(0, 64)),
      contentBytes: content.length,
      entropy: entropy(content),
    });
  }
  return out;
}

function quality(fp: PageFingerprint): number {
  return fp.contentBytes * 10 + fp.entropy * 100;
}

function classify(
  a: PageFingerprint,
  b: PageFingerprint,
  threshold: number
): DuplicateKind | null {
  if (a.contentHash === b.contentHash) return 'exact';
  if (a.textFingerprint && a.textFingerprint === b.textFingerprint)
    return 'text-equivalent';
  const dist = hammingHex(a.perceptualHash, b.perceptualHash);
  if (dist <= threshold) return 'probable-visual';
  if (dist <= threshold + 6) return 'uncertain';
  return null;
}

export function groupDuplicates(
  prints: PageFingerprint[],
  threshold = 8
): DuplicateReport {
  const used = new Set<number>();
  const sets: DuplicateSet[] = [];
  let n = 0;
  for (let i = 0; i < prints.length; i++) {
    if (used.has(prints[i].page)) continue;
    const members = [prints[i]];
    let kind: DuplicateKind = 'exact';
    for (let j = i + 1; j < prints.length; j++) {
      if (used.has(prints[j].page)) continue;
      const relation = classify(prints[i], prints[j], threshold);
      if (!relation) continue;
      members.push(prints[j]);
      used.add(prints[j].page);
      if (relation === 'uncertain') kind = 'uncertain';
      else if (relation === 'probable-visual' && kind === 'exact')
        kind = 'probable-visual';
      else if (relation === 'text-equivalent' && kind === 'exact')
        kind = 'text-equivalent';
      else if (kind === 'exact' && relation !== 'exact') kind = relation;
    }
    if (members.length < 2) continue;
    used.add(prints[i].page);
    n += 1;
    const scored = members.map((m) => ({
      page: m.page,
      kind,
      explanation:
        kind === 'exact'
          ? 'Identical page content stream hash.'
          : kind === 'text-equivalent'
            ? 'Normalized extractable text matches; layout may differ.'
            : kind === 'probable-visual'
              ? `Low-res perceptual hash within ${threshold} bits.`
              : 'Near the perceptual threshold; review before deleting.',
      qualityScore: quality(m),
    }));
    const best = scored.reduce((a, b) =>
      a.qualityScore >= b.qualityScore ? a : b
    );
    sets.push({
      id: `dup-${n}`,
      kind,
      pages: scored.map((m) => m.page),
      members: scored,
      keepPage: best.page,
      explanation: scored[0].explanation,
    });
  }
  return { sets, threshold, autoDeleted: false };
}

export function pagesToDelete(
  report: DuplicateReport,
  strategy: 'keep-first' | 'keep-best' | 'manual',
  manualKeep: Record<string, number> = {}
): number[] {
  if (strategy === 'manual' && Object.keys(manualKeep).length === 0) {
    return [];
  }
  const remove: number[] = [];
  for (const set of report.sets) {
    const keep =
      strategy === 'keep-first'
        ? Math.min(...set.pages)
        : strategy === 'keep-best'
          ? set.keepPage
          : (manualKeep[set.id] ?? set.keepPage);
    for (const page of set.pages) {
      if (page !== keep) remove.push(page);
    }
  }
  return [...new Set(remove)].sort((a, b) => a - b);
}
