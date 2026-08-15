import { WORKFLOW_VERSION, type SerializedWorkflow } from './types';

export interface WorkflowRecipe {
  id: string;
  name: string;
  summary: string;
  limitations?: string;
  workflow: SerializedWorkflow;
}

function node(
  id: string,
  type: string,
  x: number,
  y: number,
  controls: Record<string, unknown> = {}
) {
  return { id, type, position: { x, y }, controls };
}

function conn(id: string, source: string, target: string, sourceOutput = 'pdf', targetInput = 'pdf') {
  return { id, source, sourceOutput, target, targetInput };
}

export const WORKFLOW_RECIPES: WorkflowRecipe[] = [
  {
    id: 'email-ready',
    name: 'Email-ready PDF',
    summary: 'Compress, then strip metadata. Page size is not changed unless you add a normalize step.',
    workflow: {
      version: WORKFLOW_VERSION,
      nodes: [
        node('in', 'PDFInputNode', 80, 120),
        node('compress', 'CompressNode', 320, 120),
        node('sanitize', 'SanitizeNode', 560, 120),
        node('out', 'DownloadNode', 800, 120),
      ],
      connections: [
        conn('c1', 'in', 'compress'),
        conn('c2', 'compress', 'sanitize'),
        conn('c3', 'sanitize', 'out'),
      ],
    },
  },
  {
    id: 'private-sharing',
    name: 'Private sharing',
    summary: 'Sanitize hidden data and flatten form fields. This is not a legal discovery hold or a security certification.',
    limitations: 'JavaScript and attachments are removed when the engine can see them. Rasterized secrets in images remain.',
    workflow: {
      version: WORKFLOW_VERSION,
      nodes: [
        node('in', 'PDFInputNode', 80, 120),
        node('sanitize', 'SanitizeNode', 320, 120),
        node('flatten', 'FlattenNode', 560, 120),
        node('out', 'DownloadNode', 800, 120),
      ],
      connections: [
        conn('c1', 'in', 'sanitize'),
        conn('c2', 'sanitize', 'flatten'),
        conn('c3', 'flatten', 'out'),
      ],
    },
  },
  {
    id: 'scan-cleanup',
    name: 'Scan cleanup',
    summary: 'Deskew, OCR, then compress. OCR quality depends on scan resolution and language packs.',
    workflow: {
      version: WORKFLOW_VERSION,
      nodes: [
        node('in', 'PDFInputNode', 80, 120),
        node('deskew', 'DeskewNode', 300, 120),
        node('ocr', 'OCRNode', 520, 120),
        node('compress', 'CompressNode', 740, 120),
        node('out', 'DownloadNode', 960, 120),
      ],
      connections: [
        conn('c1', 'in', 'deskew'),
        conn('c2', 'deskew', 'ocr'),
        conn('c3', 'ocr', 'compress'),
        conn('c4', 'compress', 'out'),
      ],
    },
  },
  {
    id: 'print-booklet',
    name: 'Print booklet',
    summary: 'Normalize page size, impose booklet order, then number pages if you keep that node enabled.',
    workflow: {
      version: WORKFLOW_VERSION,
      nodes: [
        node('in', 'PDFInputNode', 80, 120),
        node('size', 'FixPageSizeNode', 300, 120),
        node('booklet', 'BookletNode', 520, 120),
        node('numbers', 'PageNumbersNode', 740, 120),
        node('out', 'DownloadNode', 960, 120),
      ],
      connections: [
        conn('c1', 'in', 'size'),
        conn('c2', 'size', 'booklet'),
        conn('c3', 'booklet', 'numbers'),
        conn('c4', 'numbers', 'out'),
      ],
    },
  },
  {
    id: 'sign-protect',
    name: 'Sign and protect',
    summary: 'Apply a certificate signature if you provide one at run time, flatten, then encrypt. Passwords are never stored in the recipe.',
    limitations: 'A drawn visual signature (Sign tool) is not a cryptographic digital signature. This recipe uses DigitalSignNode.',
    workflow: {
      version: WORKFLOW_VERSION,
      nodes: [
        node('in', 'PDFInputNode', 80, 120),
        node('sign', 'DigitalSignNode', 320, 120),
        node('flatten', 'FlattenNode', 560, 120),
        node('encrypt', 'EncryptNode', 800, 120),
        node('out', 'DownloadNode', 1040, 120),
      ],
      connections: [
        conn('c1', 'in', 'sign'),
        conn('c2', 'sign', 'flatten'),
        conn('c3', 'flatten', 'encrypt'),
        conn('c4', 'encrypt', 'out'),
      ],
    },
  },
  {
    id: 'archive-prep',
    name: 'Archive preparation',
    summary: 'Sanitize, OCR when needed, convert to PDF/A when Ghostscript WASM is available.',
    limitations: 'PDF/A conversion is best-effort. It is not a claim of ISO archival compliance.',
    workflow: {
      version: WORKFLOW_VERSION,
      nodes: [
        node('in', 'PDFInputNode', 80, 120),
        node('sanitize', 'SanitizeNode', 300, 120),
        node('ocr', 'OCRNode', 520, 120),
        node('pdfa', 'PdfToPdfANode', 740, 120),
        node('out', 'DownloadNode', 960, 120),
      ],
      connections: [
        conn('c1', 'in', 'sanitize'),
        conn('c2', 'sanitize', 'ocr'),
        conn('c3', 'ocr', 'pdfa'),
        conn('c4', 'pdfa', 'out'),
      ],
    },
  },
];

export function recipeById(id: string): WorkflowRecipe | undefined {
  return WORKFLOW_RECIPES.find((recipe) => recipe.id === id);
}
