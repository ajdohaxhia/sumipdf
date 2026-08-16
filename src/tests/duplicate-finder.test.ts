import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  averageHashFromGray,
  fingerprintPages,
  groupDuplicates,
  hammingHex,
  pagesToDelete,
} from '@/js/sumi/duplicate-finder';
import { executeFlow } from '@/js/flow/executor';
import { FlowStack } from '@/js/flow/stack';

async function dupPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  page.drawText('Same text', { x: 40, y: 200, size: 14, font });
  const [copy] = await doc.copyPages(doc, [0]);
  doc.addPage(copy);
  const other = doc.addPage([300, 400]);
  other.drawText('Same text', { x: 80, y: 120, size: 18, font });
  const unique = doc.addPage([300, 400]);
  unique.drawText('Different', { x: 40, y: 200, size: 14, font });
  return doc.save();
}

describe('Duplicate Page Finder', () => {
  it('classifies exact and text-equivalent pages and never auto-deletes', async () => {
    const bytes = await dupPdf();
    const prints = await fingerprintPages(bytes);
    const report = groupDuplicates(prints, 8);
    expect(report.autoDeleted).toBe(false);
    expect(report.sets.length).toBeGreaterThan(0);
    expect(
      report.sets.some(
        (s) => s.kind === 'exact' || s.kind === 'text-equivalent'
      )
    ).toBe(true);
    expect(pagesToDelete(report, 'manual')).toEqual([]);
    const keepFirst = pagesToDelete(report, 'keep-first');
    expect(keepFirst.length).toBeGreaterThan(0);
    const keepBest = pagesToDelete(report, 'keep-best');
    expect(keepBest.length).toBeGreaterThan(0);

    const stack = new FlowStack();
    stack.addStep('delete-duplicates');
    const blocked = await executeFlow(stack.document, {
      bytes,
      fileName: 'dup.pdf',
    });
    expect(blocked.failedStepId).toBeTruthy();
    expect(blocked.steps[0].message.toLowerCase()).toMatch(
      /explicit page list|never/
    );

    const ok = new FlowStack();
    ok.addStep('delete-duplicates', { pages: keepFirst.join(',') });
    const result = await executeFlow(ok.document, {
      bytes,
      fileName: 'dup.pdf',
    });
    expect(result.failedStepId).toBeNull();
  });

  it('measures perceptual hamming distance on synthetic hashes', () => {
    const a = averageHashFromGray(Array.from({ length: 64 }, (_, i) => i));
    // Mean-invariant affine shifts keep the same aHash; fully invert instead.
    const b = averageHashFromGray(Array.from({ length: 64 }, (_, i) => 63 - i));
    expect(a).toHaveLength(16);
    expect(hammingHex(a, a)).toBe(0);
    expect(hammingHex(a, b)).toBeGreaterThan(0);
  });
});
