import { stripSecretsFromParams } from './privacy';
import type { SerializedFlowRecipe } from './types';
import { emptyFlow, createStep } from './stack';
import type { FlowDocument } from './types';

export interface SumiRecipe extends SerializedFlowRecipe {
  preflightOps: string[];
}

function recipe(
  id: string,
  name: string,
  summary: string,
  steps: Array<{
    op: string;
    params?: Record<string, unknown>;
    notes?: string;
  }>,
  limitations?: string
): SumiRecipe {
  return {
    version: 1,
    id,
    name,
    summary,
    limitations,
    preflightOps: steps.map((s) => s.op),
    steps: steps.map((s) => ({
      op: s.op,
      enabled: true,
      params: stripSecretsFromParams(s.params || {}),
      notes: s.notes,
    })),
  };
}

export const SUMI_RECIPES: SumiRecipe[] = [
  recipe(
    'email-ready',
    'Email ready',
    'Compress, then strip hidden data. Page size is unchanged unless you add a normalize step.',
    [{ op: 'compress', params: { level: 'balanced' } }, { op: 'sanitize' }]
  ),
  recipe(
    'safe-to-share',
    'Safe to share',
    'Sanitize hidden data and flatten fields. This is not a legal discovery hold.',
    [{ op: 'sanitize' }, { op: 'flatten' }, { op: 'remove-annotations' }],
    'JavaScript and attachments are removed when pdf-lib can see them. Rasterized secrets in images remain.'
  ),
  recipe(
    'scanned-rescue',
    'Scanned rescue',
    'Deskew, OCR, then compress. OCR quality depends on scan resolution and language packs.',
    [
      { op: 'deskew' },
      { op: 'ocr', params: { language: 'eng' } },
      { op: 'compress', params: { level: 'balanced' } },
    ],
    'Deskew and OCR need WASM engines. If they are missing, the flow stops at that step and keeps the original.'
  ),
  recipe(
    'archive-copy',
    'Archive copy',
    'Sanitize, OCR when needed, then attempt PDF/A.',
    [
      { op: 'sanitize' },
      { op: 'ocr', params: { language: 'eng' } },
      { op: 'pdfa' },
    ],
    'PDF/A conversion is best-effort. It is not a claim of ISO archival compliance.'
  ),
  recipe(
    'application-packet',
    'Application packet',
    'Normalize size, number pages, flatten, and strip metadata for a packet you can send.',
    [
      {
        op: 'fix-page-size',
        params: { targetSize: 'A4', orientation: 'portrait' },
      },
      { op: 'page-numbers', params: { position: 'bottom-center' } },
      { op: 'flatten' },
      { op: 'remove-metadata' },
    ]
  ),
  recipe(
    'print-ready',
    'Print ready',
    'Normalize page size and add page numbers. Booklet imposition stays in the classic Print booklet recipe.',
    [
      {
        op: 'fix-page-size',
        params: { targetSize: 'A4', orientation: 'portrait' },
      },
      { op: 'page-numbers', params: { position: 'bottom-center' } },
    ]
  ),
  recipe(
    'merge-flow',
    'Merge',
    'Combine the PDFs currently in the workspace, in tray order.',
    [{ op: 'merge' }]
  ),
  recipe(
    'compress-flow',
    'Compress',
    'Attempt size reduction. Keep the original; not every file shrinks.',
    [{ op: 'compress', params: { level: 'balanced' } }]
  ),
  recipe(
    'organize-flow',
    'Organize',
    'Start with reverse/delete/rotate disabled until you choose pages in Inspect.',
    [
      {
        op: 'remove-blank',
        notes: 'Optional. Enable after Inspect highlights empty pages.',
      },
      {
        op: 'rotate',
        params: { angle: 90 },
        notes: 'Scoped to pages you select.',
      },
    ]
  ),
  recipe(
    'sign-flow',
    'Sign (prepare)',
    'Flatten so a visual signature can sit on page content. This is not a digital certificate.',
    [
      {
        op: 'flatten',
        notes:
          'Open the Sign tool for a drawn mark, or Digital Sign for a certificate.',
      },
    ],
    'A drawn signature is not a cryptographic digital signature.'
  ),
  recipe(
    'sentinel-safe-copy',
    'Sentinel Safe Copy',
    'Sanitize active content this engine can see. Re-run Sentinel and keep a Proof receipt. Not malware-free.',
    [{ op: 'sentinel-safe-copy' }],
    'Does not execute PDF JavaScript. Rasterized secrets and unparsed XFA can remain.'
  ),
];

export function recipeById(id: string): SumiRecipe | undefined {
  return SUMI_RECIPES.find((recipe) => recipe.id === id);
}

export function recipeToFlow(recipe: SumiRecipe): FlowDocument {
  const doc = emptyFlow(recipe.name);
  for (const step of recipe.steps) {
    const created = createStep(step.op, step.params, step.notes);
    created.enabled = step.enabled;
    doc.steps.push(created);
  }
  return doc;
}
