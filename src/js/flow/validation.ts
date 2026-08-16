import { getFlowOp } from './catalog';
import { assertRecipePrivacy } from './privacy';
import type { FlowDocument, FlowIssue } from './types';

const AFTER_ENCRYPT = new Set([
  'compress',
  'ocr',
  'deskew',
  'rotate',
  'delete-pages',
  'extract-pages',
  'reorder',
  'reverse',
  'remove-blank',
  'sanitize',
  'flatten',
  'redact',
  'page-numbers',
  'fix-page-size',
  'pdfa',
  'remove-metadata',
  'remove-annotations',
  'cover',
  'merge',
  'sentinel-safe-copy',
  'delete-duplicates',
  'a11y-fix',
]);

export function validateFlow(doc: FlowDocument): FlowIssue[] {
  const issues: FlowIssue[] = [];
  if (!doc || !Array.isArray(doc.steps)) {
    return [{ level: 'error', message: 'Flow is not valid JSON.' }];
  }

  const enabled = doc.steps.filter((s) => s.enabled);
  if (enabled.length === 0) {
    issues.push({
      level: 'warning',
      message: 'No enabled steps. Execute will keep the original file.',
    });
  }

  const ids = new Set<string>();
  for (const step of doc.steps) {
    if (ids.has(step.id)) {
      issues.push({
        level: 'error',
        stepId: step.id,
        message: 'Duplicate step id.',
      });
    }
    ids.add(step.id);
    const def = getFlowOp(step.op);
    if (!def) {
      issues.push({
        level: 'error',
        stepId: step.id,
        message: `Unknown operation: ${step.op}`,
      });
      continue;
    }
    if (step.op === 'delete-pages') {
      const pages = String(
        step.params.pages || step.scope?.pages?.join(',') || ''
      ).trim();
      if (!pages) {
        issues.push({
          level: 'warning',
          stepId: step.id,
          message: 'Delete pages has no page list yet.',
        });
      }
    }
    if (step.op === 'extract-pages') {
      const pages = String(
        step.params.pages || step.scope?.pages?.join(',') || ''
      ).trim();
      if (!pages) {
        issues.push({
          level: 'error',
          stepId: step.id,
          message: 'Extract pages needs a page list.',
        });
      }
    }
    if (step.op === 'encrypt') {
      issues.push({
        level: 'warning',
        stepId: step.id,
        message:
          'Encrypt should be last. The password is requested at run time and is not saved.',
      });
    }
    if (step.op === 'delete-duplicates') {
      const pages = String(
        step.params.pages || step.scope?.pages?.join(',') || ''
      ).trim();
      if (!pages) {
        issues.push({
          level: 'error',
          stepId: step.id,
          message:
            'Delete duplicates needs an explicit page list. It never auto-deletes.',
        });
      }
    }
    if (step.op === 'sentinel-safe-copy') {
      issues.push({
        level: 'warning',
        stepId: step.id,
        message:
          'Safe Copy is not a malware scan. Re-run Sentinel and download a Proof receipt after it finishes.',
      });
    }
    if (step.op === 'a11y-fix') {
      issues.push({
        level: 'warning',
        stepId: step.id,
        message:
          'Title and language fixes are not PDF/UA or WCAG certification.',
      });
    }
    if (step.op === 'cover') {
      issues.push({
        level: 'warning',
        stepId: step.id,
        message:
          'Visual cover is not redaction. Text under a black rectangle usually remains extractable.',
      });
    }
    if (step.op === 'pdfa') {
      issues.push({
        level: 'warning',
        stepId: step.id,
        message:
          'PDF/A conversion is best-effort when Ghostscript WASM loads. It is not an ISO compliance claim.',
      });
    }
    if (step.op === 'redact') {
      issues.push({
        level: 'warning',
        stepId: step.id,
        message:
          'Redaction text is asked at run time. Rasterized words in images are not removed.',
      });
    }
  }

  const encryptIndex = enabled.findIndex((s) => s.op === 'encrypt');
  if (encryptIndex >= 0) {
    const later = enabled.slice(encryptIndex + 1);
    for (const step of later) {
      if (AFTER_ENCRYPT.has(step.op)) {
        issues.push({
          level: 'error',
          stepId: step.id,
          message: `${getFlowOp(step.op)?.name || step.op} cannot run after Encrypt.`,
        });
      }
    }
  }

  const decryptIndex = enabled.findIndex((s) => s.op === 'decrypt');
  if (decryptIndex > 0) {
    issues.push({
      level: 'warning',
      stepId: enabled[decryptIndex].id,
      message: 'Decrypt usually needs to run before other edits.',
    });
  }

  const hasOcr = enabled.some((s) => s.op === 'ocr');
  const hasRedact = enabled.some((s) => s.op === 'redact');
  if (hasRedact && hasOcr) {
    const ocrAt = enabled.findIndex((s) => s.op === 'ocr');
    const redactAt = enabled.findIndex((s) => s.op === 'redact');
    if (redactAt < ocrAt) {
      issues.push({
        level: 'warning',
        message: 'OCR after redaction can recreate text you meant to remove.',
      });
    }
  }

  try {
    const json = JSON.stringify(doc);
    for (const error of assertRecipePrivacy(json)) {
      issues.push({ level: 'error', message: error });
    }
  } catch (error) {
    issues.push({
      level: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return issues;
}

export function flowHasBlockingErrors(doc: FlowDocument): boolean {
  return validateFlow(doc).some((issue) => issue.level === 'error');
}
