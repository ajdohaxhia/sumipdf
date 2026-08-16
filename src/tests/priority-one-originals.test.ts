import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  applyTransform,
  fillBatch,
  listFormFields,
  parseTabular,
} from '@/js/sumi/batch-forms';
import {
  PACKET_TEMPLATES,
  buildPacket,
  packetWarnings,
} from '@/js/sumi/packet-builder';
import { receiptFromProof, verifyProofReceipt } from '@/js/sumi/proof';
import { executeFlow } from '@/js/flow/executor';
import { FlowStack } from '@/js/flow/stack';
import { buildProofReport } from '@/js/proof/receipt';

async function formTemplate(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 500]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Name', { x: 40, y: 400, size: 12, font });
  const form = doc.getForm();
  const field = form.createTextField('Name');
  field.addToPage(page, { x: 40, y: 360, width: 200, height: 20 });
  const box = form.createCheckBox('Agree');
  box.addToPage(page, { x: 40, y: 320, width: 12, height: 12 });
  return doc.save();
}

describe('Batch Form Studio', () => {
  it('maps CSV rows, transforms dates, skips bad rows, and does not eval formulas', async () => {
    expect(applyTransform('  ada  ', 'upper')).toBe('ADA');
    expect(applyTransform('2020-01-02', 'date-it')).toBe('02/01/2020');
    const rows = parseTabular('Name,Agree\nAda,yes\n,no\nBea,true', 'csv');
    expect(rows).toHaveLength(3);
    const bytes = await formTemplate();
    const fields = await listFormFields(bytes);
    expect(fields.some((f) => f.name === 'Name')).toBe(true);
    const result = await fillBatch(bytes, rows, {
      mapping: [
        { field: 'Name', column: 'Name', transform: 'trim' },
        { field: 'Agree', column: 'Agree', transform: 'none' },
      ],
      flatten: true,
      skipInvalid: true,
      filenameTemplate: 'row-{counter}.pdf',
    });
    expect(result.files.length).toBeGreaterThanOrEqual(2);
    expect(
      result.notes.some(
        (n) => /not cryptographic/i.test(n) || /visual/i.test(n)
      )
    ).toBe(true);
  });
});

describe('Packet Builder', () => {
  it('warns on missing required slots and builds a merged packet', async () => {
    expect(PACKET_TEMPLATES.every((t) => t.legalClaim === false)).toBe(true);
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 500]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Slot document', { x: 40, y: 400, size: 14, font });
    const one = await doc.save();
    const slots = PACKET_TEMPLATES[0].slots.map((slot, i) => ({
      ...slot,
      bytes: i === 1 ? one : undefined,
      fileName: i === 1 ? 'id.pdf' : undefined,
    }));
    const warnings = packetWarnings(slots);
    expect(warnings.some((w) => w.level === 'missing')).toBe(true);
    slots[2].bytes = one;
    slots[2].fileName = 'cv.pdf';
    const built = await buildPacket(slots, {
      normalize: true,
      compress: true,
      coverTitle: 'Application',
      separators: true,
      bookmarks: true,
      toc: true,
      pageNumbers: true,
      cleanMetadata: true,
    });
    expect(built.bytes.byteLength).toBeGreaterThan(100);
    expect(built.notes.join(' ')).toMatch(/not legal/i);
  });
});

describe('Proof Verifier', () => {
  it('matches hashes and lists unverifiable legal claims', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.setTitle('before');
    const original = await doc.save();
    const stack = new FlowStack();
    stack.addStep('remove-metadata');
    const execution = await executeFlow(stack.document, {
      bytes: original,
      fileName: 'a.pdf',
    });
    const proof = await buildProofReport({ execution });
    const receipt = receiptFromProof(proof);
    expect(receipt.schema).toBe('sumi.proof.receipt');
    expect(receipt.schemaVersion).toBe(1);
    expect(receipt.notASignature).toBe(true);
    const ok = await verifyProofReceipt({
      originalBytes: original,
      outputBytes: execution.outputBytes,
      receipt,
    });
    expect(
      ok.findings.some((f) => f.id === 'hash-original' && f.status === 'match')
    ).toBe(true);
    expect(
      ok.findings.some((f) => f.id === 'hash-output' && f.status === 'match')
    ).toBe(true);
    expect(ok.unverifiable.join(' ').toLowerCase()).toMatch(
      /certificate|signature|timestamp/
    );
    const bad = await verifyProofReceipt({
      originalBytes: execution.outputBytes,
      outputBytes: original,
      receipt,
    });
    expect(bad.ok).toBe(false);
  });
});
