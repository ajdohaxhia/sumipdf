import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sha256Hex } from '@/js/proof/hash';
import { collectMetrics, markerExtractable } from '@/js/proof/metrics';
import { proveRedactionVersusCover } from '@/js/proof/redaction';
import { buildProofReport, proofReportToText } from '@/js/proof/receipt';
import { executeFlow } from '@/js/flow/executor';
import { FlowStack } from '@/js/flow/stack';

const MARKER = 'SUMIPROOFMARKER4419';

async function markedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([240, 240]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(MARKER, { x: 24, y: 120, size: 12, font, color: rgb(0, 0, 0) });
  doc.setTitle('Before title');
  return doc.save();
}

describe('Sumi Proof', () => {
  it('hashes before and after and records byte changes', async () => {
    const bytes = await markedPdf();
    const stack = new FlowStack();
    stack.addStep('remove-metadata');
    const execution = await executeFlow(stack.document, {
      bytes,
      fileName: 'marked.pdf',
    });
    const report = await buildProofReport({ execution });
    expect(report.notACertificate).toBe(true);
    expect(report.before.sha256).toBe(await sha256Hex(bytes));
    expect(report.after.sha256).toHaveLength(64);
    expect(report.before.sha256).not.toBe(report.after.sha256);
    expect(proofReportToText(report)).toContain('not a legal certificate');
    const metrics = await collectMetrics(execution.outputBytes);
    expect(metrics.pageCount).toBe(1);
  });

  it('reports visual cover as extractable, unlike a missing marker after real removal intent', async () => {
    const bytes = await markedPdf();
    expect(await markerExtractable(bytes, MARKER)).toBe(true);
    const stack = new FlowStack();
    stack.addStep('cover');
    const execution = await executeFlow(stack.document, {
      bytes,
      fileName: 'cover.pdf',
    });
    const proof = await proveRedactionVersusCover({
      afterBytes: execution.outputBytes,
      markers: [MARKER],
      claimedRedaction: false,
      visualCoverUsed: true,
    });
    expect(proof.extractableMarkers).toContain(MARKER);
    expect(proof.note.toLowerCase()).toContain('not redaction');
  });
});
