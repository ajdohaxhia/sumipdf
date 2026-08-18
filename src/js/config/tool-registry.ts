import { categories as sourceCategories } from './tools';

export type ToolCategoryId =
  | 'organize'
  | 'edit'
  | 'convert-to'
  | 'convert-from'
  | 'scan-ocr'
  | 'compress'
  | 'protect'
  | 'sign-validate'
  | 'print'
  | 'automate';

export type EngineId =
  | 'pdf-lib'
  | 'pdfjs'
  | 'qpdf'
  | 'pymupdf'
  | 'ghostscript'
  | 'cpdf'
  | 'libreoffice'
  | 'tesseract'
  | 'embedpdf'
  | 'none';

export type Intensity = 'low' | 'medium' | 'high';

/** Internal attribution. Do not render as a UI badge. */
export type ToolOrigin = 'upstream' | 'sumi' | 'hybrid';

export interface ToolDefinition {
  id: string;
  href: string;
  name: string;
  icon: string;
  subtitle: string;
  category: ToolCategoryId;
  tags: string[];
  accept: string[];
  minFiles: number;
  maxFiles: number | null;
  outputType: string;
  batch: boolean;
  workflowEligible: boolean;
  offlineAfterCache: boolean;
  engine: EngineId;
  intensity: Intensity;
  related: string[];
  origin: ToolOrigin;
  experimental?: boolean;
  featured?: boolean;
}

export const CATEGORY_META: {
  id: ToolCategoryId;
  name: string;
  i18nKey: string;
}[] = [
  { id: 'organize', name: 'Organize', i18nKey: 'tools:categories.organize' },
  { id: 'edit', name: 'Edit', i18nKey: 'tools:categories.edit' },
  {
    id: 'convert-to',
    name: 'Convert to PDF',
    i18nKey: 'tools:categories.convertToPdf',
  },
  {
    id: 'convert-from',
    name: 'Convert from PDF',
    i18nKey: 'tools:categories.convertFromPdf',
  },
  { id: 'scan-ocr', name: 'Scan & OCR', i18nKey: 'tools:categories.scanOcr' },
  {
    id: 'compress',
    name: 'Compress & optimize',
    i18nKey: 'tools:categories.compressOptimize',
  },
  {
    id: 'protect',
    name: 'Protect & sanitize',
    i18nKey: 'tools:categories.protectSanitize',
  },
  {
    id: 'sign-validate',
    name: 'Sign & validate',
    i18nKey: 'tools:categories.signValidate',
  },
  {
    id: 'print',
    name: 'Print & prepare',
    i18nKey: 'tools:categories.printPrepare',
  },
  { id: 'automate', name: 'Automate', i18nKey: 'tools:categories.automate' },
];

const FEATURED_IDS = new Set([
  'merge-pdf',
  'compress-pdf',
  'organize-pdf',
  'sign-pdf',
]);

const LEGACY_CATEGORY: Record<string, ToolCategoryId> = {
  'Edit & Annotate': 'edit',
  'Convert to PDF': 'convert-to',
  'Convert from PDF': 'convert-from',
  'Organize & Manage': 'organize',
  'Optimize & Repair': 'compress',
  'Secure PDF': 'protect',
};

const CATEGORY_OVERRIDE: Record<string, ToolCategoryId> = {
  'pdf-workflow': 'automate',
  'ocr-pdf': 'scan-ocr',
  'deskew-pdf': 'scan-ocr',
  'scanner-effect': 'scan-ocr',
  'sign-pdf': 'sign-validate',
  'digital-sign-pdf': 'sign-validate',
  'validate-signature-pdf': 'sign-validate',
  'timestamp-pdf': 'sign-validate',
  'sanitize-pdf': 'protect',
  'remove-metadata': 'protect',
  'encrypt-pdf': 'protect',
  'decrypt-pdf': 'protect',
  'flatten-pdf': 'protect',
  'change-permissions': 'protect',
  'remove-restrictions': 'protect',
  'redact-pdf': 'protect',
  'pdf-booklet': 'print',
  'n-up-pdf': 'print',
  'posterize-pdf': 'print',
  'fix-page-size': 'print',
  'page-dimensions': 'print',
  'page-numbers': 'print',
  'header-footer': 'print',
  'bates-numbering': 'print',
  'compress-pdf': 'compress',
  'linearize-pdf': 'compress',
  'repair-pdf': 'compress',
  'pdf-to-pdfa': 'compress',
  'font-to-outline': 'compress',
  'rasterize-pdf': 'compress',
  'compare-pdfs': 'edit',
  sentinel: 'protect',
  'privacy-finder': 'protect',
  'smart-split': 'organize',
  'duplicate-finder': 'organize',
  'batch-forms': 'edit',
  'packet-builder': 'organize',
  'proof-verifier': 'sign-validate',
  capture: 'scan-ocr',
  'print-preflight': 'print',
  'accessibility-audit': 'print',
  'watch-folder': 'automate',
};

const ENGINE_OVERRIDE: Record<string, EngineId> = {
  'ocr-pdf': 'tesseract',
  'compress-pdf': 'pymupdf',
  'pdf-to-pdfa': 'ghostscript',
  'font-to-outline': 'ghostscript',
  'deskew-pdf': 'pymupdf',
  'edit-pdf': 'embedpdf',
  'edit-pdf-text': 'embedpdf',
  'word-to-pdf': 'libreoffice',
  'excel-to-pdf': 'libreoffice',
  'powerpoint-to-pdf': 'libreoffice',
  'odt-to-pdf': 'libreoffice',
  'merge-pdf': 'cpdf',
  'split-pdf': 'qpdf',
  'digital-sign-pdf': 'pdf-lib',
  'redact-pdf': 'pymupdf',
  sentinel: 'pdf-lib',
  'privacy-finder': 'pdf-lib',
  'smart-split': 'pdf-lib',
  'duplicate-finder': 'pdf-lib',
  'batch-forms': 'pdf-lib',
  'packet-builder': 'pdf-lib',
  'proof-verifier': 'none',
  capture: 'pdf-lib',
  'print-preflight': 'pdf-lib',
  'accessibility-audit': 'pdf-lib',
  'watch-folder': 'none',
};

const ORIGIN_OVERRIDE: Record<string, ToolOrigin> = {
  sentinel: 'sumi',
  'privacy-finder': 'sumi',
  'smart-split': 'hybrid',
  'duplicate-finder': 'sumi',
  'batch-forms': 'sumi',
  'packet-builder': 'sumi',
  'proof-verifier': 'sumi',
  capture: 'hybrid',
  'print-preflight': 'sumi',
  'accessibility-audit': 'sumi',
  'watch-folder': 'sumi',
  'compare-pdfs': 'hybrid',
  workspace: 'sumi',
  inspect: 'sumi',
  flow: 'sumi',
  proof: 'sumi',
  recipes: 'sumi',
};

const EXPERIMENTAL_IDS = new Set(['watch-folder']);

const RELATED: Record<string, string[]> = {
  'merge-pdf': ['split-pdf', 'organize-pdf', 'pdf-workflow'],
  'edit-pdf': ['edit-pdf-text', 'sign-pdf', 'redact-pdf'],
  'edit-pdf-text': ['edit-pdf', 'sign-pdf', 'form-filler'],
  'compress-pdf': ['linearize-pdf', 'sanitize-pdf', 'pdf-to-pdfa'],
  'organize-pdf': ['merge-pdf', 'split-pdf', 'rotate-pdf'],
  'sign-pdf': ['digital-sign-pdf', 'flatten-pdf', 'encrypt-pdf'],
  'sanitize-pdf': ['remove-metadata', 'flatten-pdf', 'redact-pdf'],
  'redact-pdf': ['sanitize-pdf', 'remove-metadata', 'flatten-pdf'],
};

type ToolCapabilities = Pick<
  ToolDefinition,
  | 'accept'
  | 'minFiles'
  | 'maxFiles'
  | 'outputType'
  | 'batch'
  | 'workflowEligible'
>;

const WORKFLOW_TOOL_IDS = new Set([
  'merge-pdf',
  'compress-pdf',
  'rotate-pdf',
  'delete-pages',
  'extract-pages',
  'reverse-pages',
  'remove-blank-pages',
  'sanitize-pdf',
  'remove-metadata',
  'flatten-pdf',
  'remove-annotations',
  'page-numbers',
  'fix-page-size',
  'encrypt-pdf',
  'decrypt-pdf',
  'ocr-pdf',
  'deskew-pdf',
  'pdf-to-pdfa',
  'redact-pdf',
  'sentinel',
  'duplicate-finder',
  'accessibility-audit',
]);

const CAPABILITY_OVERRIDE: Record<string, Partial<ToolCapabilities>> = {
  'merge-pdf': { minFiles: 2, maxFiles: null, batch: true },
  'alternate-merge': { minFiles: 2, maxFiles: null, batch: true },
  'compare-pdfs': { minFiles: 2, maxFiles: 2 },
  'images-to-pdf': {
    accept: ['image/*'],
    minFiles: 1,
    maxFiles: null,
    batch: true,
  },
  'pdf-to-zip': { outputType: 'application/zip' },
  sentinel: { outputType: 'application/json' },
  'privacy-finder': { outputType: 'application/pdf' },
  'smart-split': { outputType: 'application/zip' },
  'duplicate-finder': { outputType: 'application/json' },
  'batch-forms': {
    accept: [
      'application/pdf',
      'text/csv',
      'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    minFiles: 2,
    maxFiles: 2,
    outputType: 'application/zip',
    batch: true,
  },
  'packet-builder': {
    minFiles: 1,
    maxFiles: 12,
    outputType: 'application/pdf',
    batch: true,
  },
  'proof-verifier': {
    accept: ['application/pdf', 'application/json'],
    minFiles: 3,
    maxFiles: 3,
    outputType: 'application/json',
  },
  capture: {
    accept: ['image/png', 'image/jpeg', 'image/webp'],
    minFiles: 1,
    maxFiles: 50,
    outputType: 'application/pdf',
    batch: true,
  },
  'print-preflight': { outputType: 'application/json' },
  'accessibility-audit': { outputType: 'application/pdf' },
  'watch-folder': {
    accept: [],
    minFiles: 0,
    maxFiles: 0,
    outputType: 'none',
  },
};

const TO_PDF_INPUTS: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  svg: ['image/svg+xml'],
  bmp: ['image/bmp'],
  heic: ['image/heic', 'image/heif'],
  tiff: ['image/tiff'],
  txt: ['text/plain'],
  text: ['text/plain'],
  json: ['application/json'],
  csv: ['text/csv'],
  markdown: ['text/markdown', 'text/plain'],
  email: ['message/rfc822', '.eml', '.msg'],
  word: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  excel: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  powerpoint: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
};

const FROM_PDF_OUTPUTS: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  json: 'application/json',
  text: 'text/plain',
  markdown: 'text/markdown',
  zip: 'application/zip',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function capabilitiesFor(id: string): ToolCapabilities {
  const base: ToolCapabilities = {
    accept: ['application/pdf'],
    minFiles: 1,
    maxFiles: 1,
    outputType: 'application/pdf',
    batch: false,
    workflowEligible: WORKFLOW_TOOL_IDS.has(id),
  };
  const toPdf = id.match(/^([a-z0-9]+)-to-pdf$/);
  if (toPdf && TO_PDF_INPUTS[toPdf[1]]) {
    base.accept = TO_PDF_INPUTS[toPdf[1]];
  }
  const fromPdf = id.match(/^pdf-to-([a-z0-9]+)$/);
  if (fromPdf && FROM_PDF_OUTPUTS[fromPdf[1]]) {
    base.outputType = FROM_PDF_OUTPUTS[fromPdf[1]];
  }
  return { ...base, ...(CAPABILITY_OVERRIDE[id] || {}) };
}

function tagsFor(id: string, name: string, subtitle: string): string[] {
  const blob = `${id} ${name} ${subtitle}`.toLowerCase();
  const tags = new Set<string>(id.split('-'));
  for (const word of blob.split(/[^a-z0-9]+/)) {
    if (word.length > 2) tags.add(word);
  }
  return [...tags];
}

let cached: ToolDefinition[] | null = null;

export function getAllTools(): ToolDefinition[] {
  if (cached) return cached;
  const seen = new Set<string>();
  const tools: ToolDefinition[] = [];

  for (const category of sourceCategories) {
    if (category.name === 'Popular Tools') continue;
    for (const tool of category.tools) {
      if (seen.has(tool.id)) continue;
      seen.add(tool.id);
      const engine = ENGINE_OVERRIDE[tool.id] ?? 'pdf-lib';
      const capabilities = capabilitiesFor(tool.id);
      tools.push({
        id: tool.id,
        href: tool.href,
        name: tool.name,
        icon: tool.icon,
        subtitle: tool.subtitle,
        category:
          CATEGORY_OVERRIDE[tool.id] ??
          LEGACY_CATEGORY[category.name] ??
          'edit',
        tags: tagsFor(tool.id, tool.name, tool.subtitle),
        ...capabilities,
        offlineAfterCache: engine !== 'libreoffice' && engine !== 'tesseract',
        engine,
        intensity:
          engine === 'libreoffice' ||
          engine === 'pymupdf' ||
          engine === 'tesseract'
            ? 'high'
            : engine === 'none'
              ? 'low'
              : 'medium',
        related: RELATED[tool.id] ?? [],
        origin: ORIGIN_OVERRIDE[tool.id] ?? 'upstream',
        featured: FEATURED_IDS.has(tool.id),
        experimental: EXPERIMENTAL_IDS.has(tool.id) || undefined,
      });
    }
  }

  cached = tools;
  return tools;
}

export function getToolById(id: string): ToolDefinition | undefined {
  return getAllTools().find((tool) => tool.id === id);
}

export function getFeaturedTools(): ToolDefinition[] {
  return getAllTools().filter((tool) => tool.featured);
}

export function getToolsByCategory(): {
  id: ToolCategoryId;
  name: string;
  i18nKey: string;
  tools: ToolDefinition[];
}[] {
  const all = getAllTools();
  return CATEGORY_META.map((meta) => ({
    ...meta,
    tools: all.filter((tool) => tool.category === meta.id),
  })).filter((group) => group.tools.length > 0);
}

export function searchTools(query: string): ToolDefinition[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return getAllTools().filter((tool) => {
    const hay =
      `${tool.name} ${tool.subtitle} ${tool.id} ${tool.tags.join(' ')}`.toLowerCase();
    return hay.includes(term);
  });
}

export function getToolIdFromHref(href: string): string {
  const clean = href.split(/[?#]/, 1)[0].replace(/\/$/, '');
  const filename = clean.slice(clean.lastIndexOf('/') + 1);
  return filename.replace(/\.html$/i, '') || href;
}

export function getToolOrigin(id: string): ToolOrigin {
  return getToolById(id)?.origin ?? ORIGIN_OVERRIDE[id] ?? 'upstream';
}
