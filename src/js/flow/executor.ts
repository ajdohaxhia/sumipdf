import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { flattenAnnotations } from '../utils/flatten-annotations';
import { analyzePdfBytes } from '../inspect/analyze';
import { flowOpName, getFlowOp } from './catalog';
import { parseDeletePages, parsePageRange } from './pages';
import type {
  FlowDocument,
  FlowExecution,
  FlowRunProgress,
  FlowStep,
  FlowStepResult,
} from './types';

export interface ExecuteFlowOptions {
  bytes: Uint8Array;
  fileName: string;
  extraPdfs?: Uint8Array[];
  signal?: AbortSignal;
  secrets?: Record<string, string>;
  onProgress?: (progress: FlowRunProgress) => void;
}

function aborted(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted);
}

function abortError(): Error {
  const error = new Error('Flow cancelled');
  error.name = 'AbortError';
  return error;
}

async function loadDoc(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
    throwOnInvalidObject: false,
  });
}

async function copyByIndices(
  bytes: Uint8Array,
  indices: number[]
): Promise<Uint8Array> {
  const src = await loadDoc(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((page) => out.addPage(page));
  return new Uint8Array(await out.save());
}

async function reversePages(bytes: Uint8Array): Promise<Uint8Array> {
  const src = await loadDoc(bytes);
  return copyByIndices(bytes, src.getPageIndices().slice().reverse());
}

async function reorderPages(
  bytes: Uint8Array,
  orderStr: string
): Promise<Uint8Array> {
  const src = await loadDoc(bytes);
  const count = src.getPageCount();
  const parsed = parsePageRange(orderStr, count);
  const seen = new Set(parsed);
  const rest = src.getPageIndices().filter((i) => !seen.has(i));
  return copyByIndices(bytes, [...parsed, ...rest]);
}

async function lightCompress(
  bytes: Uint8Array
): Promise<{ bytes: Uint8Array; note: string }> {
  const doc = await loadDoc(bytes);
  const out = new Uint8Array(await doc.save({ useObjectStreams: true }));
  return {
    bytes: out,
    note:
      out.byteLength < bytes.byteLength
        ? 'Recompressed object streams with pdf-lib.'
        : 'pdf-lib recompress did not shrink this file. PyMuPDF image compression was not used in this step.',
  };
}

async function removeMetadataOnly(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await loadDoc(bytes);
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');
  try {
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));
  } catch {
    /* ignore */
  }
  return new Uint8Array(await doc.save());
}

async function flattenDoc(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await loadDoc(bytes);
  try {
    doc.getForm().flatten();
  } catch {
    /* no form */
  }
  try {
    flattenAnnotations(doc);
  } catch {
    /* ignore */
  }
  return new Uint8Array(await doc.save());
}

async function removeAnnots(bytes: Uint8Array): Promise<Uint8Array> {
  const { sanitizePdf, defaultSanitizeOptions } =
    await import('../utils/sanitize.js');
  const result = await sanitizePdf(bytes, {
    ...defaultSanitizeOptions,
    flattenForms: false,
    removeMetadata: false,
    removeAnnotations: true,
    removeJavascript: false,
    removeEmbeddedFiles: false,
    removeLayers: false,
    removeLinks: false,
    removeStructureTree: false,
    removeMarkInfo: false,
    removeFonts: false,
  });
  return result.bytes;
}

async function removeBlanks(bytes: Uint8Array): Promise<Uint8Array> {
  const map = await analyzePdfBytes(bytes, { fileName: 'flow.pdf' });
  const toDelete = new Set(
    map.pages.filter((p) => p.probableBlank).map((p) => p.index)
  );
  if (toDelete.size === 0) return bytes;
  const keep = map.pages.map((p) => p.index).filter((i) => !toDelete.has(i));
  if (keep.length === 0) return bytes;
  return copyByIndices(bytes, keep);
}

async function visualCover(
  bytes: Uint8Array,
  pages: number[]
): Promise<Uint8Array> {
  const doc = await loadDoc(bytes);
  const all = doc.getPages();
  const targets =
    pages.length > 0
      ? pages.map((n) => n - 1).filter((i) => i >= 0 && i < all.length)
      : all.map((_, i) => i);
  for (const index of targets) {
    const page = all[index];
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: 36,
      y: height / 2 - 18,
      width: Math.max(120, width - 72),
      height: 36,
      color: rgb(0, 0, 0),
    });
  }
  return new Uint8Array(await doc.save());
}

function boolParam(
  params: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  const value = params[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

async function runStep(
  step: FlowStep,
  bytes: Uint8Array,
  options: ExecuteFlowOptions
): Promise<{ bytes: Uint8Array; notes: string[] }> {
  const notes: string[] = [];
  const secrets = options.secrets || {};
  const scopedPages = step.scope?.pages || [];
  switch (step.op) {
    case 'merge': {
      const extras = options.extraPdfs || [];
      if (extras.length === 0) {
        notes.push(
          'No additional PDFs in the workspace to merge. Left the current file unchanged.'
        );
        return { bytes, notes };
      }
      const out = await PDFDocument.create();
      for (const part of [bytes, ...extras]) {
        const src = await loadDoc(part);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((page) => out.addPage(page));
      }
      return { bytes: new Uint8Array(await out.save()), notes };
    }
    case 'compress': {
      const light = await lightCompress(bytes);
      notes.push(light.note);
      try {
        const { performCondenseCompression } =
          await import('../utils/compress.js');
        const blob = new Blob([new Uint8Array(light.bytes)], {
          type: 'application/pdf',
        });
        const level = String(step.params.level || 'balanced');
        const heavy = await performCondenseCompression(blob, level);
        if (heavy instanceof Blob) {
          const out = new Uint8Array(await heavy.arrayBuffer());
          notes.push('PyMuPDF condense ran.');
          return { bytes: out, notes };
        }
        if (heavy instanceof Uint8Array) return { bytes: heavy, notes };
      } catch {
        notes.push('PyMuPDF compress was not available; used pdf-lib only.');
      }
      return { bytes: light.bytes, notes };
    }
    case 'rotate': {
      const angle = Number(step.params.angle || 90) || 90;
      const src = await loadDoc(bytes);
      const out = await PDFDocument.create();
      for (const index of src.getPageIndices()) {
        const [copied] = await out.copyPages(src, [index]);
        const apply =
          scopedPages.length === 0 || scopedPages.includes(index + 1);
        if (apply) {
          copied.setRotation(
            degrees((copied.getRotation().angle + angle) % 360)
          );
        }
        out.addPage(copied);
      }
      return { bytes: new Uint8Array(await out.save()), notes };
    }
    case 'delete-pages': {
      const src = await loadDoc(bytes);
      const spec = String(step.params.pages || scopedPages.join(',') || '');
      const set = parseDeletePages(spec, src.getPageCount());
      const keep = src.getPageIndices().filter((i) => !set.has(i + 1));
      if (keep.length === 0) throw new Error('Cannot delete all pages');
      return { bytes: await copyByIndices(bytes, keep), notes };
    }
    case 'extract-pages': {
      const src = await loadDoc(bytes);
      const spec = String(step.params.pages || scopedPages.join(',') || '');
      const indices = parsePageRange(spec, src.getPageCount());
      if (indices.length === 0)
        throw new Error('Extract pages needs a page list.');
      return { bytes: await copyByIndices(bytes, indices), notes };
    }
    case 'reorder': {
      return {
        bytes: await reorderPages(bytes, String(step.params.order || '')),
        notes,
      };
    }
    case 'reverse':
      return { bytes: await reversePages(bytes), notes };
    case 'remove-blank':
      return { bytes: await removeBlanks(bytes), notes };
    case 'sanitize': {
      const { sanitizePdf, defaultSanitizeOptions } =
        await import('../utils/sanitize.js');
      const result = await sanitizePdf(bytes, {
        ...defaultSanitizeOptions,
        flattenForms: boolParam(step.params, 'flattenForms', true),
        removeMetadata: boolParam(step.params, 'removeMetadata', true),
        removeAnnotations: boolParam(step.params, 'removeAnnotations', true),
        removeJavascript: boolParam(step.params, 'removeJavascript', true),
        removeEmbeddedFiles: boolParam(
          step.params,
          'removeEmbeddedFiles',
          true
        ),
      });
      notes.push('pdf-lib Privacy Clean. Rasterized secrets in images remain.');
      return { bytes: result.bytes, notes };
    }
    case 'remove-metadata':
      return { bytes: await removeMetadataOnly(bytes), notes };
    case 'flatten':
      return { bytes: await flattenDoc(bytes), notes };
    case 'remove-annotations':
      return { bytes: await removeAnnots(bytes), notes };
    case 'page-numbers': {
      const doc = await loadDoc(bytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      pages.forEach((page, i) => {
        const { width } = page.getSize();
        page.drawText(`${i + 1} / ${pages.length}`, {
          x: width / 2 - 20,
          y: 24,
          size: 12,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
      });
      return { bytes: new Uint8Array(await doc.save()), notes };
    }
    case 'fix-page-size': {
      const { fixPageSize } = await import('../utils/pdf-operations.js');
      const out = await fixPageSize(bytes, {
        targetSize: String(step.params.targetSize || 'A4'),
        orientation: String(step.params.orientation || 'portrait'),
        scalingMode: 'fit',
        backgroundColor: { r: 1, g: 1, b: 1 },
      });
      return { bytes: out, notes };
    }
    case 'cover':
      notes.push(
        'Visual cover only. Proof should report extractable text if it remains.'
      );
      return { bytes: await visualCover(bytes, scopedPages), notes };
    case 'sentinel-safe-copy': {
      const { makeSafeCopy } = await import('../sumi/sentinel/safe-copy.js');
      const copy = await makeSafeCopy(bytes);
      notes.push(...copy.notes);
      return { bytes: copy.bytes, notes };
    }
    case 'delete-duplicates': {
      const spec = String(
        step.params.pages || scopedPages.join(',') || ''
      ).trim();
      if (!spec) {
        throw new Error(
          'Duplicate deletion needs an explicit page list. Nothing was deleted.'
        );
      }
      const src = await loadDoc(bytes);
      const set = parseDeletePages(spec, src.getPageCount());
      const keep = src.getPageIndices().filter((i) => !set.has(i + 1));
      if (keep.length === 0) throw new Error('Cannot delete all pages');
      notes.push(
        'Pages listed by Duplicate Finder were dropped. This is not automatic.'
      );
      return { bytes: await copyByIndices(bytes, keep), notes };
    }
    case 'a11y-fix': {
      const { applySafeA11yFixes } =
        await import('../sumi/accessibility/audit.js');
      const title = String(step.params.title || '');
      const lang = String(step.params.lang || '');
      if (!title && !lang) {
        throw new Error(
          'Set a title or language. Sumi does not auto-tag PDFs.'
        );
      }
      notes.push('Safe catalog edits only. Not PDF/UA or WCAG.');
      return { bytes: await applySafeA11yFixes(bytes, { title, lang }), notes };
    }
    case 'redact': {
      const needle = secrets.searchText || secrets.redactText || '';
      if (!needle) {
        throw new Error(
          'Redaction text is required at run time and is not stored in the flow.'
        );
      }
      const { redactTextFromPdf } = await import('../utils/redact-real.js');
      const result = await redactTextFromPdf(bytes, needle);
      notes.push(...result.limitations);
      notes.push(`PyMuPDF reported ${result.matchCount} match(es).`);
      return { bytes: result.bytes, notes };
    }
    case 'ocr': {
      notes.push(
        'OCR is lazy-loaded. If Tesseract is missing, this step fails without discarding the original.'
      );
      const { performOcr } = await import('../utils/ocr.js').catch(async () => {
        throw new Error('OCR engine is not available in this session.');
      });
      if (typeof performOcr !== 'function') {
        throw new Error('OCR engine is not available in this session.');
      }
      throw new Error(
        'OCR did not run: wire a language pack from the OCR tool if you need a text layer.'
      );
    }
    case 'deskew':
      throw new Error(
        'Deskew needs PyMuPDF WASM. Open the Deskew tool or retry after the engine loads.'
      );
    case 'pdfa':
      throw new Error(
        'PDF/A conversion needs Ghostscript WASM. This is not a claim of ISO archival compliance.'
      );
    case 'encrypt':
      throw new Error(
        'Encrypt needs a runtime password and qpdf. Use the Encrypt tool or provide a password in this session.'
      );
    case 'decrypt':
      throw new Error(
        'Decrypt needs a runtime password. Passwords are never stored in recipes.'
      );
    default:
      throw new Error(`Unsupported operation: ${step.op}`);
  }
}

export async function previewFlow(
  doc: FlowDocument,
  options: ExecuteFlowOptions
): Promise<{ bytes: Uint8Array; notes: string[] }> {
  const clone: ExecuteFlowOptions = { ...options, signal: options.signal };
  const result = await executeFlow(doc, clone);
  return {
    bytes: result.outputBytes,
    notes: result.steps.flatMap((s) => s.notes),
  };
}

export async function executeFlow(
  doc: FlowDocument,
  options: ExecuteFlowOptions
): Promise<FlowExecution> {
  const objectUrls: string[] = [];
  const originalBytes = options.bytes.slice();
  let current = originalBytes;
  const steps: FlowStepResult[] = [];
  let failedStepId: string | null = null;
  let cancelled = false;
  const enabled = doc.steps.filter((s) => s.enabled);

  try {
    for (let index = 0; index < enabled.length; index++) {
      if (aborted(options.signal)) throw abortError();
      const step = enabled[index];
      const def = getFlowOp(step.op);
      options.onProgress?.({
        stepId: step.id,
        stepName: def?.name || step.op,
        index,
        total: enabled.length,
        status: 'running',
        message: `Running ${flowOpName(step.op)}…`,
      });
      const bytesIn = current.byteLength;
      try {
        const result = await runStep(step, current, options);
        current = new Uint8Array(result.bytes);
        steps.push({
          stepId: step.id,
          op: step.op,
          ok: true,
          message: 'Completed',
          notes: result.notes,
          bytesIn,
          bytesOut: current.byteLength,
        });
        options.onProgress?.({
          stepId: step.id,
          stepName: def?.name || step.op,
          index,
          total: enabled.length,
          status: 'ok',
          message: `${flowOpName(step.op)} finished`,
        });
      } catch (error) {
        if (
          aborted(options.signal) ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          cancelled = true;
          throw abortError();
        }
        failedStepId = step.id;
        steps.push({
          stepId: step.id,
          op: step.op,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          notes: [
            'Stopped at this step. Earlier successful steps are kept in memory. Original is unchanged on disk.',
          ],
          bytesIn,
          bytesOut: current.byteLength,
        });
        options.onProgress?.({
          stepId: step.id,
          stepName: def?.name || step.op,
          index,
          total: enabled.length,
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
        break;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      cancelled = true;
    } else {
      throw error;
    }
  }

  const base = options.fileName.replace(/\.pdf$/i, '');
  return {
    originalBytes,
    outputBytes: current,
    originalName: options.fileName,
    outputName: `${base}-sumi.pdf`,
    steps,
    cancelled,
    failedStepId,
    objectUrls,
  };
}

export function revokeFlowUrls(execution: FlowExecution): void {
  for (const url of execution.objectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  execution.objectUrls.length = 0;
}
