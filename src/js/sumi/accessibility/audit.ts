import { PDFDict, PDFName, PDFString } from 'pdf-lib';
import { catalogHas, loadPdf, lookupDict } from '../shared/pdf';
import { documentTextFromStreams } from '../shared/text';
import type { A11yFix, A11yFinding, A11yReport } from './types';

export async function auditAccessibility(
  bytes: Uint8Array
): Promise<A11yReport> {
  const doc = await loadPdf(bytes);
  const findings: A11yFinding[] = [];
  const title = doc.getTitle();
  if (!title) {
    findings.push({
      id: 'title',
      level: 'fixable',
      title: 'No document title',
      detail: 'Catalog title is empty. A short title is a safe fix.',
      fix: 'set-title',
    });
  } else {
    findings.push({
      id: 'title',
      level: 'info',
      title: 'Title present',
      detail: title,
      fix: null,
    });
  }
  const hasLang = catalogHas(doc, 'Lang');
  findings.push({
    id: 'lang',
    level: hasLang ? 'info' : 'fixable',
    title: hasLang ? 'Catalog language present' : 'No catalog language',
    detail: hasLang
      ? 'Lang is set. This is not a WCAG pass.'
      : 'Setting Lang is a safe, reversible catalog edit.',
    fix: hasLang ? null : 'set-lang',
  });
  const tagged = catalogHas(doc, 'StructTreeRoot');
  findings.push({
    id: 'tagged',
    level: tagged ? 'info' : 'warning',
    title: tagged ? 'Structure tree present' : 'Not tagged',
    detail: tagged
      ? 'Tags exist. Sumi does not certify PDF/UA.'
      : 'No /StructTreeRoot. Sumi will not auto-tag.',
    fix: null,
  });
  const outlines = doc.catalog.lookup(PDFName.of('Outlines'));
  findings.push({
    id: 'bookmarks',
    level: outlines instanceof PDFDict ? 'info' : 'warning',
    title: outlines instanceof PDFDict ? 'Bookmarks present' : 'No bookmarks',
    detail: 'Bookmarks help navigation. They are not a reading-order proof.',
    fix: null,
  });
  let headingHint = false;
  try {
    const root = lookupDict(doc, doc.catalog.get(PDFName.of('StructTreeRoot')));
    const raw = root ? JSON.stringify(String(root)) : '';
    headingHint = /\/H[1-6]\b/.test(raw);
  } catch {
    /* structure walk failed; leave headingHint false */
  }
  findings.push({
    id: 'headings',
    level: headingHint ? 'info' : 'warning',
    title: headingHint ? 'Heading tags were seen' : 'No heading tags found',
    detail: 'Structure walk is best-effort. Not a heading outline audit.',
    fix: null,
  });
  try {
    const fields = doc.getForm().getFields();
    const unlabeled = fields.filter((f) => !f.getName()).length;
    findings.push({
      id: 'fields',
      level: unlabeled ? 'warning' : fields.length ? 'info' : 'info',
      title: fields.length
        ? `${fields.length} form field(s)`
        : 'No form fields',
      detail: unlabeled
        ? 'Some fields lack a name. Tooltips (/TU) are not fully enumerated.'
        : 'Field names were readable. This is not a label quality score.',
      fix: null,
    });
  } catch {
    findings.push({
      id: 'fields',
      level: 'info',
      title: 'No AcroForm',
      detail: 'Nothing to label.',
      fix: null,
    });
  }
  findings.push({
    id: 'alt',
    level: 'warning',
    title: 'Figure alternate text',
    detail: 'Alt text on Figure tags is not fully enumerated in this pass.',
    fix: null,
  });
  findings.push({
    id: 'order',
    level: 'warning',
    title: 'Reading order',
    detail:
      'Reading order is not-verifiable without a tagged content walk in a screen reader.',
    fix: null,
  });
  const texts = documentTextFromStreams(doc);
  const textPages = texts.filter((t) => t.trim()).length;
  const imageOnly = doc.getPageCount() - textPages;
  findings.push({
    id: 'text-vs-image',
    level: imageOnly ? 'warning' : 'info',
    title: imageOnly
      ? `${imageOnly} page(s) have little extractable text`
      : 'Extractable text on most pages',
    detail:
      'Heuristic from content streams. Scans need OCR, which is optional and local.',
    fix: null,
  });
  findings.push({
    id: 'contrast',
    level: 'warning',
    title: 'Contrast estimate skipped',
    detail:
      'Contrast needs a raster preview. This audit does not invent a WCAG ratio.',
    fix: null,
  });
  findings.push({
    id: 'tables',
    level: 'info',
    title: 'Tables',
    detail:
      'Table structure is not certified. Use Inspect if you only need an indicator.',
    fix: null,
  });

  return {
    findings,
    pdfUaClaim: false,
    wcagClaim: false,
    limitations: [
      'This is not a PDF/UA or WCAG certification.',
      'Safe fixes are title and language only. Sumi does not auto-tag.',
    ],
  };
}

export async function applySafeA11yFixes(
  bytes: Uint8Array,
  fix: A11yFix
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  if (fix.title) doc.setTitle(fix.title);
  if (fix.lang) {
    doc.catalog.set(PDFName.of('Lang'), PDFString.of(fix.lang));
  }
  return new Uint8Array(await doc.save());
}
