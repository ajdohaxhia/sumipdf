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
  { id: 'convert-to', name: 'Convert to PDF', i18nKey: 'tools:categories.convertToPdf' },
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
};

const ENGINE_OVERRIDE: Record<string, EngineId> = {
  'ocr-pdf': 'tesseract',
  'compress-pdf': 'pymupdf',
  'pdf-to-pdfa': 'ghostscript',
  'font-to-outline': 'ghostscript',
  'deskew-pdf': 'pymupdf',
  'edit-pdf': 'embedpdf',
  'word-to-pdf': 'libreoffice',
  'excel-to-pdf': 'libreoffice',
  'powerpoint-to-pdf': 'libreoffice',
  'odt-to-pdf': 'libreoffice',
  'merge-pdf': 'cpdf',
  'split-pdf': 'qpdf',
  'digital-sign-pdf': 'pdf-lib',
  'redact-pdf': 'pymupdf',
};

const RELATED: Record<string, string[]> = {
  'merge-pdf': ['split-pdf', 'organize-pdf', 'pdf-workflow'],
  'compress-pdf': ['linearize-pdf', 'sanitize-pdf', 'pdf-to-pdfa'],
  'organize-pdf': ['merge-pdf', 'split-pdf', 'rotate-pdf'],
  'sign-pdf': ['digital-sign-pdf', 'flatten-pdf', 'encrypt-pdf'],
  'sanitize-pdf': ['remove-metadata', 'flatten-pdf', 'redact-pdf'],
  'redact-pdf': ['sanitize-pdf', 'remove-metadata', 'flatten-pdf'],
};

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
        accept: ['application/pdf'],
        minFiles: 1,
        maxFiles: null,
        outputType: 'application/pdf',
        batch: true,
        workflowEligible: true,
        offlineAfterCache: engine !== 'libreoffice' && engine !== 'tesseract',
        engine,
        intensity:
          engine === 'libreoffice' || engine === 'pymupdf' || engine === 'tesseract'
            ? 'high'
            : engine === 'none'
              ? 'low'
              : 'medium',
        related: RELATED[tool.id] ?? [],
        featured: FEATURED_IDS.has(tool.id),
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
    const hay = `${tool.name} ${tool.subtitle} ${tool.id} ${tool.tags.join(' ')}`.toLowerCase();
    return hay.includes(term);
  });
}

export function getToolIdFromHref(href: string): string {
  const match = href.match(/\/([^/]+)\.html$/);
  return match?.[1] ?? href;
}
