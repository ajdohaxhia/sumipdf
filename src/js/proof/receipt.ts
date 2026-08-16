import { collectMetrics } from './metrics';
import { proveRedactionVersusCover } from './redaction';
import { PROOF_DISCLAIMER, type ProofChange, type ProofReport } from './types';
import type { FlowExecution } from '../flow/types';
import { flowOpName } from '../flow/catalog';

function change(
  label: string,
  before: string,
  after: string
): ProofChange | null {
  if (before === after) return null;
  return { label, before, after };
}

export async function buildProofReport(options: {
  execution: FlowExecution;
  pdfaAttempted?: boolean;
  redactionMarkers?: string[];
}): Promise<ProofReport> {
  const { execution } = options;
  const before = await collectMetrics(execution.originalBytes);
  const after = await collectMetrics(execution.outputBytes);
  const ops = execution.steps.map((s) => s.op);
  const changes = [
    change('Bytes', String(before.byteLength), String(after.byteLength)),
    change('Pages', String(before.pageCount), String(after.pageCount)),
    change('SHA-256', before.sha256, after.sha256),
    change('Title', before.title || '—', after.title || '—'),
    change('Author', before.author || '—', after.author || '—'),
    change(
      'Form fields',
      String(before.formFieldCount),
      String(after.formFieldCount)
    ),
    change(
      'JavaScript heuristic',
      before.hasJavaScript ? 'present' : 'not found',
      after.hasJavaScript ? 'present' : 'not found'
    ),
    change(
      'Attachments heuristic',
      before.hasAttachments ? 'present' : 'not found',
      after.hasAttachments ? 'present' : 'not found'
    ),
    change(
      'OCR layer heuristic',
      before.hasOcrLayer ? 'present' : 'not found',
      after.hasOcrLayer ? 'present' : 'not found'
    ),
  ].filter((item): item is ProofChange => Boolean(item));

  const warnings: string[] = [];
  if (execution.cancelled)
    warnings.push('The flow was cancelled. Output may be partial.');
  if (execution.failedStepId) {
    const failed = execution.steps.find(
      (s) => s.stepId === execution.failedStepId
    );
    warnings.push(
      `Stopped at ${failed ? flowOpName(failed.op) : 'a step'}: ${failed?.message || 'error'}`
    );
  }
  for (const step of execution.steps) {
    warnings.push(...step.notes);
  }
  if (ops.includes('pdfa')) {
    warnings.push(
      'PDF/A was requested. Sumi does not certify ISO 19005 compliance.'
    );
  }
  if (before.sha256 === after.sha256) {
    warnings.push(
      'SHA-256 is unchanged. The bytes appear identical to the original.'
    );
  }

  const redaction = await proveRedactionVersusCover({
    afterBytes: execution.outputBytes,
    markers: options.redactionMarkers,
    claimedRedaction: ops.includes('redact'),
    visualCoverUsed: ops.includes('cover'),
  });
  if (redaction.extractableMarkers.length) {
    warnings.push(redaction.note);
  }

  return {
    schema: 'sumi.proof.receipt',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    product: 'Sumi PDF',
    notACertificate: true,
    disclaimer: PROOF_DISCLAIMER,
    originalName: execution.originalName,
    outputName: execution.outputName,
    before,
    after,
    changes,
    warnings: [...new Set(warnings)],
    redaction,
    pdfa: {
      attempted: Boolean(options.pdfaAttempted || ops.includes('pdfa')),
      honestLimit:
        'PDF/A conversion, when it runs, is a best-effort Ghostscript WASM pass. It is not an archival certification.',
    },
    flowStepNames: execution.steps.map((s) => flowOpName(s.op)),
    failedStep: execution.failedStepId,
  };
}

export function proofReportToText(report: ProofReport): string {
  const lines = [
    'Sumi Proof Receipt',
    report.disclaimer,
    '',
    `Generated: ${report.generatedAt}`,
    `Original: ${report.originalName}`,
    `Output: ${report.outputName}`,
    '',
    'Before',
    `  bytes: ${report.before.byteLength}`,
    `  pages: ${report.before.pageCount}`,
    `  SHA-256: ${report.before.sha256}`,
    '',
    'After',
    `  bytes: ${report.after.byteLength}`,
    `  pages: ${report.after.pageCount}`,
    `  SHA-256: ${report.after.sha256}`,
    '',
    'Changes',
    ...(report.changes.length
      ? report.changes.map((c) => `  ${c.label}: ${c.before} → ${c.after}`)
      : ['  none detected']),
    '',
    'Flow',
    `  ${report.flowStepNames.join(' → ') || '(no steps)'}`,
    '',
    'Redaction vs cover',
    `  ${report.redaction.note}`,
    '',
    'PDF/A',
    `  ${report.pdfa.honestLimit}`,
    '',
    'Warnings',
    ...(report.warnings.length
      ? report.warnings.map((w) => `  - ${w}`)
      : ['  none']),
    '',
    'notACertificate: true',
  ];
  return lines.join('\n');
}

export function proofReportToJson(report: ProofReport): string {
  return JSON.stringify(report, null, 2);
}
