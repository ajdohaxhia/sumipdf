import { PDFArray, PDFDict, PDFName, PDFNumber } from 'pdf-lib';
import { loadPdf, nameOf, pageContentBytes, streamBytes } from '../shared/pdf';
import { latin1 } from '../shared/bytes';
import type { PreflightIssue, PreflightReport } from './types';

function box(page: { node: PDFDict }, key: string): number[] | null {
  const value = page.node.lookup(PDFName.of(key));
  if (value instanceof PDFArray && value.size() >= 4) {
    const nums = [];
    for (let i = 0; i < 4; i++) {
      const n = value.get(i);
      nums.push(n instanceof PDFNumber ? n.asNumber() : 0);
    }
    return nums;
  }
  return null;
}

export async function runPreflight(
  bytes: Uint8Array
): Promise<PreflightReport> {
  const doc = await loadPdf(bytes);
  const issues: PreflightIssue[] = [];
  const sizes = new Set<string>();
  const orients = new Set<string>();
  const colorSpaces = new Set<string>();
  let annots = 0;
  let thin = 0;
  let lowDpi = 0;

  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    sizes.add(`${Math.round(width)}x${Math.round(height)}`);
    orients.add(
      width > height ? 'landscape' : width < height ? 'portrait' : 'square'
    );
    const media = box(page, 'MediaBox');
    const trim = box(page, 'TrimBox');
    const bleed = box(page, 'BleedBox');
    if (media && !trim) {
      issues.push({
        id: `no-trim-${i + 1}`,
        level: 'info',
        title: `Page ${i + 1} has no TrimBox`,
        detail: 'MediaBox is present. Trim is not-verifiable beyond that.',
        pages: [i + 1],
        repairOp: null,
      });
    }
    if (bleed && trim) {
      const bleedAmt = Math.min(
        trim[0] - bleed[0],
        trim[1] - bleed[1],
        bleed[2] - trim[2],
        bleed[3] - trim[3]
      );
      if (bleedAmt < 0) {
        issues.push({
          id: `bleed-inside-${i + 1}`,
          level: 'warning',
          title: `Page ${i + 1} BleedBox sits inside TrimBox`,
          detail:
            'Bleed appears inverted. Sumi will not rewrite boxes automatically.',
          pages: [i + 1],
          repairOp: null,
        });
      }
    } else if (!bleed) {
      issues.push({
        id: `no-bleed-${i + 1}`,
        level: 'not-verifiable',
        title: `Page ${i + 1} has no BleedBox`,
        detail: 'Missing bleed is common for office PDFs. Not an ISO fail.',
        pages: [i + 1],
        repairOp: null,
      });
    }
    const annotArr = page.node.Annots();
    if (annotArr instanceof PDFArray) annots += annotArr.size();
    const resources = page.node.Resources();
    if (resources instanceof PDFDict) {
      const xobj = resources.lookup(PDFName.of('XObject'));
      if (xobj instanceof PDFDict) {
        for (const key of xobj.keys()) {
          const obj = doc.context.lookup(xobj.get(key));
          const dict =
            obj instanceof PDFDict ? obj : (obj as { dict?: PDFDict })?.dict;
          if (!(dict instanceof PDFDict)) continue;
          if (nameOf(dict, 'Subtype') !== 'Image') continue;
          const w = dict.lookup(PDFName.of('Width'));
          const h = dict.lookup(PDFName.of('Height'));
          const iw = w instanceof PDFNumber ? w.asNumber() : 0;
          const _ih = h instanceof PDFNumber ? h.asNumber() : 0;
          void _ih;
          if (iw > 0 && width > 0) {
            const dpi = (iw / width) * 72;
            if (dpi < 120) {
              lowDpi += 1;
              issues.push({
                id: `dpi-${i + 1}-${key.toString()}`,
                level: 'warning',
                title: `Image on page ${i + 1} is about ${Math.round(dpi)} ppi`,
                detail:
                  'Estimated from pixel width / display width. Not a RIP measurement.',
                pages: [i + 1],
                repairOp: null,
              });
            }
          }
          const cs = dict.lookup(PDFName.of('ColorSpace'));
          if (cs instanceof PDFName) colorSpaces.add(cs.decodeText());
          if (dict.has(PDFName.of('SMask'))) {
            issues.push({
              id: `smask-${i + 1}`,
              level: 'info',
              title: `Transparency (SMask) on page ${i + 1}`,
              detail: 'Soft masks can flatten unpredictably in some RIPs.',
              pages: [i + 1],
              repairOp: null,
            });
          }
        }
      }
      const font = resources.lookup(PDFName.of('Font'));
      if (font instanceof PDFDict) {
        for (const key of font.keys()) {
          const obj = doc.context.lookup(font.get(key));
          if (!(obj instanceof PDFDict)) continue;
          const desc = obj.lookup(PDFName.of('FontDescriptor'));
          const descDict = desc instanceof PDFDict ? desc : undefined;
          const embedded = Boolean(
            descDict &&
            (descDict.has(PDFName.of('FontFile')) ||
              descDict.has(PDFName.of('FontFile2')) ||
              descDict.has(PDFName.of('FontFile3')))
          );
          if (!embedded) {
            issues.push({
              id: `font-${i + 1}-${key.toString()}`,
              level: 'warning',
              title: `Font ${key.decodeText()} on page ${i + 1} may not be embedded`,
              detail:
                'No FontFile* on the descriptor. Substitution risk when printing.',
              pages: [i + 1],
              repairOp: null,
            });
          }
        }
      }
      const gs = resources.lookup(PDFName.of('ExtGState'));
      if (gs instanceof PDFDict) {
        for (const key of gs.keys()) {
          const obj = doc.context.lookup(gs.get(key));
          if (
            obj instanceof PDFDict &&
            (obj.has(PDFName.of('OP')) || obj.has(PDFName.of('op')))
          ) {
            issues.push({
              id: `op-${i + 1}`,
              level: 'not-verifiable',
              title: `Overprint flag on page ${i + 1}`,
              detail:
                'Overprint is recorded, not simulated. Preview in a RIP if it matters.',
              pages: [i + 1],
              repairOp: null,
            });
          }
        }
      }
    }
    const stream = latin1(pageContentBytes(doc, i), 200_000);
    const widths = [...stream.matchAll(/(\d+(?:\.\d+)?)\s+w\b/g)].map((m) =>
      Number(m[1])
    );
    if (widths.some((w) => w > 0 && w < 0.25)) {
      thin += 1;
      issues.push({
        id: `thin-${i + 1}`,
        level: 'warning',
        title: `Thin strokes on page ${i + 1}`,
        detail:
          'A content-stream `w` operator is under 0.25 pt. Hairlines may vanish.',
        pages: [i + 1],
        repairOp: null,
      });
    }
    if (pageContentBytes(doc, i).length < 48) {
      issues.push({
        id: `blank-${i + 1}`,
        level: 'info',
        title: `Page ${i + 1} appears blank`,
        detail:
          'Almost empty content stream. Hidden white text can still exist.',
        pages: [i + 1],
        repairOp: 'remove-blank',
      });
    }
  }

  if (sizes.size > 1) {
    issues.push({
      id: 'mixed-size',
      level: 'warning',
      title: 'Mixed page sizes',
      detail: [...sizes].join(', '),
      pages: [],
      repairOp: 'fix-page-size',
    });
  }
  if (orients.size > 1) {
    issues.push({
      id: 'mixed-orientation',
      level: 'info',
      title: 'Mixed orientation',
      detail: [...orients].join(', '),
      pages: [],
      repairOp: null,
    });
  }
  if (annots) {
    issues.push({
      id: 'annots',
      level: 'info',
      title: `${annots} annotation(s)`,
      detail: 'Comments and markup may print depending on the driver.',
      pages: [],
      repairOp: 'flatten',
    });
  }
  if (colorSpaces.size) {
    issues.push({
      id: 'colors',
      level: 'info',
      title: 'Color spaces seen on images',
      detail: [...colorSpaces].join(', ') || 'unknown',
      pages: [],
      repairOp: null,
    });
  }

  void thin;
  void lowDpi;
  void streamBytes;

  return {
    issues,
    isoClaim: false,
    limitations: [
      'This is not an ISO 15930/19593 or GWG preflight certificate.',
      'DPI, overprint, and “outside trim” are estimates or not-verifiable.',
      'Safe repairs are optional Flow steps (normalize size, flatten, remove blank).',
    ],
  };
}
