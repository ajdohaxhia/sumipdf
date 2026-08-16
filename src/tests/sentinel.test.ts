import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { scanSentinel, neverMalwareFree } from '@/js/sumi/sentinel';
import { makeSafeCopy } from '@/js/sumi/sentinel/safe-copy';
import { executeFlow } from '@/js/flow/executor';
import { FlowStack } from '@/js/flow/stack';
import { buildProofReport } from '@/js/proof/receipt';

async function withActions(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 500]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Visible', { x: 40, y: 400, size: 14, font });
  doc.setTitle('Sentinel fixture');
  doc.catalog.set(
    PDFName.of('OpenAction'),
    doc.context.obj({
      Type: 'Action',
      S: 'JavaScript',
      JS: 'app.alert("must-not-run")',
    })
  );
  doc.catalog.set(
    PDFName.of('AA'),
    doc.context.obj({
      WC: doc.context.obj({ S: 'JavaScript', JS: 'this.dirty = true' }),
    })
  );
  const launch = doc.context.obj({
    Type: 'Action',
    S: 'Launch',
    F: 'cmd.exe',
  });
  const uri = doc.context.obj({
    Type: 'Action',
    S: 'URI',
    URI: 'https://example.invalid/hook',
  });
  page.node.set(
    PDFName.of('Annots'),
    doc.context.obj([
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        A: uri,
        Rect: [0, 0, 10, 10],
      }),
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        A: launch,
        Rect: [10, 10, 20, 20],
      }),
    ])
  );
  return doc.save();
}

describe('Sentinel', () => {
  it('records JS, OpenAction, Launch, and URI without executing JavaScript', async () => {
    const bytes = await withActions();
    const report = await scanSentinel(bytes, 'risk.pdf');
    expect(report.executedJavascript).toBe(false);
    expect(report.malwareFreeClaim).toBe(false);
    expect(neverMalwareFree(report)).toBe(true);
    expect(report.findings.some((f) => f.category === 'javascript')).toBe(true);
    expect(report.findings.some((f) => f.category === 'open-action')).toBe(
      true
    );
    expect(report.findings.some((f) => f.category === 'launch')).toBe(true);
    expect(report.findings.some((f) => f.category === 'uri')).toBe(true);
    expect(report.findings.some((f) => f.severity === 'High risk')).toBe(true);
    expect(report.limitations.join(' ').toLowerCase()).toMatch(
      /does not claim a file is malware-free/
    );
    expect(JSON.stringify(report.findings).toLowerCase()).not.toMatch(
      /\bis malware-free\b/
    );
    for (const finding of report.findings) {
      expect(finding.explanation.length).toBeGreaterThan(8);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(typeof finding.canRemove).toBe('boolean');
      expect(finding.impact.length).toBeGreaterThan(8);
    }
  });

  it('Safe Copy is a Flow, then Sentinel can rerun and Proof records hashes', async () => {
    const bytes = await withActions();
    const stack = new FlowStack();
    stack.addStep('sentinel-safe-copy');
    const execution = await executeFlow(stack.document, {
      bytes,
      fileName: 'risk.pdf',
    });
    expect(execution.failedStepId).toBeNull();
    const copy = await makeSafeCopy(bytes);
    const after = await scanSentinel(copy.bytes, 'safe.pdf');
    expect(after.findings.some((f) => f.category === 'javascript')).toBe(false);
    expect(after.findings.some((f) => f.category === 'open-action')).toBe(
      false
    );
    const proof = await buildProofReport({ execution });
    expect(proof.schema).toBe('sumi.proof.receipt');
    expect(proof.notACertificate).toBe(true);
    expect(proof.before.sha256).not.toBe(proof.after.sha256);
  });
});
