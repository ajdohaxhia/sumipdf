import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import { mergePdfs } from '../../utils/pdf-operations';
import type { PacketSlot } from './types';

export interface TocSection {
  title: string;
  /** 1-based page index in the packet *before* TOC insertion */
  startPageBeforeToc: number;
  pageCount: number;
}

export interface TocBuildResult {
  bytes: Uint8Array;
  tocPageCount: number;
  sections: Array<{
    title: string;
    /** 1-based final page after TOC insertion */
    startPage: number;
  }>;
  notes: string[];
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const LINE_H = 18;
const TITLE_SIZE = 18;
const ENTRY_SIZE = 11;

function linesPerTocPage(): number {
  const usable = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM - 40;
  return Math.max(1, Math.floor(usable / LINE_H));
}

export function planTocPageCount(sectionCount: number): number {
  const capacity = linesPerTocPage();
  return Math.max(1, Math.ceil(sectionCount / capacity));
}

async function drawTocPages(
  sections: Array<{ title: string; startPage: number }>,
  tocPageCount: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const capacity = linesPerTocPage();

  for (let p = 0; p < tocPageCount; p++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN_TOP;
    if (p === 0) {
      page.drawText('Table of Contents', {
        x: MARGIN_X,
        y,
        size: TITLE_SIZE,
        font: bold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 36;
    } else {
      page.drawText(`Table of Contents (continued)`, {
        x: MARGIN_X,
        y,
        size: 12,
        font: bold,
      });
      y -= 28;
    }

    const slice = sections.slice(p * capacity, (p + 1) * capacity);
    for (const section of slice) {
      const title = section.title.slice(0, 60);
      const pageLabel = String(section.startPage);
      page.drawText(title, {
        x: MARGIN_X,
        y,
        size: ENTRY_SIZE,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });
      page.drawText(pageLabel, {
        x: PAGE_W - MARGIN_X - 24,
        y,
        size: ENTRY_SIZE,
        font,
      });

      // Clickable link to the destination page (GoTo).
      const link = doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [MARGIN_X, y - 2, PAGE_W - MARGIN_X, y + ENTRY_SIZE + 2],
          Border: [0, 0, 0],
          A: {
            Type: 'Action',
            S: 'GoTo',
            D: [section.startPage - 1, 'XYZ', null, null, null],
          },
        })
      );
      const annots = page.node.lookup(PDFName.of('Annots'));
      if (annots instanceof PDFArray) {
        annots.push(link);
      } else {
        page.node.set(PDFName.of('Annots'), doc.context.obj([link]));
      }
      y -= LINE_H;
    }
  }

  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

/**
 * Fix GoTo destinations that used placeholder page indices to real page refs
 * after the final document is assembled.
 */
async function rewriteLinkDestinations(
  bytes: Uint8Array,
  tocPageCount: number,
  sections: Array<{ title: string; startPage: number }>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, {
    updateMetadata: false,
    ignoreEncryption: true,
  });
  const pages = doc.getPages();
  const capacity = linesPerTocPage();

  for (let tocIdx = 0; tocIdx < tocPageCount; tocIdx++) {
    const page = pages[tocIdx];
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) continue;
    const slice = sections.slice(tocIdx * capacity, (tocIdx + 1) * capacity);
    for (let i = 0; i < annots.size() && i < slice.length; i++) {
      const annotRef = annots.get(i);
      const annot = doc.context.lookup(annotRef);
      if (!(annot instanceof PDFDict)) continue;
      const action = annot.lookup(PDFName.of('A'));
      if (!(action instanceof PDFDict)) continue;
      const destPage = pages[slice[i].startPage - 1];
      if (!destPage) continue;
      action.set(
        PDFName.of('D'),
        doc.context.obj([destPage.ref, 'XYZ', null, null, null])
      );
    }
  }

  // Build outline bookmarks for sections.
  if (sections.length) {
    const kids: ReturnType<typeof doc.context.register>[] = [];
    let prev: ReturnType<typeof doc.context.register> | null = null;
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const destPage = pages[section.startPage - 1];
      if (!destPage) continue;
      const itemRef = doc.context.register(
        doc.context.obj({
          Title: PDFString.of(section.title.slice(0, 120)),
          Parent: undefined,
          Dest: [destPage.ref, 'XYZ', null, null, null],
        })
      );
      kids.push(itemRef);
      if (prev) {
        const prevDict = doc.context.lookup(prev);
        if (prevDict instanceof PDFDict)
          prevDict.set(PDFName.of('Next'), itemRef);
        const cur = doc.context.lookup(itemRef);
        if (cur instanceof PDFDict) cur.set(PDFName.of('Prev'), prev);
      }
      prev = itemRef;
    }
    if (kids.length) {
      const outlinesRef = doc.context.register(
        doc.context.obj({
          Type: 'Outlines',
          First: kids[0],
          Last: kids[kids.length - 1],
          Count: PDFNumber.of(kids.length),
        })
      );
      for (const kid of kids) {
        const dict = doc.context.lookup(kid);
        if (dict instanceof PDFDict)
          dict.set(PDFName.of('Parent'), outlinesRef);
      }
      doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
    }
  }

  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

/**
 * Insert real TOC pages after an optional cover, with page numbers and bookmarks.
 * `bodyBytes` is the packet without TOC (cover + separators + content already merged).
 * `sections` describe where each filled slot starts in that body.
 */
export async function insertTableOfContents(
  bodyBytes: Uint8Array,
  sections: TocSection[],
  options: { afterCoverPages?: number } = {}
): Promise<TocBuildResult> {
  const afterCover = options.afterCoverPages ?? 0;
  const tocPageCount = planTocPageCount(sections.length);
  const adjusted = sections.map((s) => ({
    title: s.title,
    startPage: s.startPageBeforeToc + tocPageCount,
  }));

  const tocBytes = await drawTocPages(adjusted, tocPageCount);
  const body = await PDFDocument.load(bodyBytes, {
    updateMetadata: false,
    ignoreEncryption: true,
  });
  const out = await PDFDocument.create();

  // cover pages stay first
  if (afterCover > 0) {
    const coverPages = await out.copyPages(
      body,
      Array.from({ length: afterCover }, (_, i) => i)
    );
    coverPages.forEach((p) => out.addPage(p));
  }

  const tocDoc = await PDFDocument.load(tocBytes);
  const tocPages = await out.copyPages(tocDoc, tocDoc.getPageIndices());
  tocPages.forEach((p) => out.addPage(p));

  const rest = await out.copyPages(
    body,
    body.getPageIndices().filter((i) => i >= afterCover)
  );
  rest.forEach((p) => out.addPage(p));

  let merged = new Uint8Array(await out.save({ useObjectStreams: false }));
  merged = new Uint8Array(
    await rewriteLinkDestinations(merged, tocPageCount, adjusted)
  );

  return {
    bytes: merged,
    tocPageCount,
    sections: adjusted,
    notes: [
      `Inserted ${tocPageCount} table of contents page(s) with section titles and page numbers.`,
      'TOC links and outline bookmarks point at final packet pages.',
    ],
  };
}

export function sectionsFromSlots(
  slots: PacketSlot[],
  options: { cover: boolean; separators: boolean }
): { sections: TocSection[]; coverPages: number } {
  const filled = slots.filter((s) => s.bytes && s.bytes.byteLength > 0);
  const sections: TocSection[] = [];
  let cursor = 1;
  const coverPages = options.cover ? 1 : 0;
  cursor += coverPages;
  for (const slot of filled) {
    if (options.separators) cursor += 1; // separator page before content
    const start = cursor;
    // page count unknown until merge; caller should refine with measured counts
    sections.push({
      title: slot.label,
      startPageBeforeToc: start,
      pageCount: 1,
    });
    cursor += 1; // placeholder; refined after measuring
  }
  return { sections, coverPages };
}

export async function measureSlotPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  return doc.getPageCount();
}

export async function mergeBodyWithMeasuredSections(
  slots: PacketSlot[],
  options: {
    coverTitle?: string;
    separators: boolean;
    coverBytes?: Uint8Array;
    separatorBytes?: (label: string) => Promise<Uint8Array>;
  }
): Promise<{
  bodyBytes: Uint8Array;
  sections: TocSection[];
  coverPages: number;
}> {
  const filled = slots.filter((s) => s.bytes && s.bytes.byteLength > 0);
  const parts: Uint8Array[] = [];
  const sections: TocSection[] = [];
  let pageCursor = 0;
  let coverPages = 0;

  if (options.coverBytes) {
    parts.push(options.coverBytes);
    coverPages = await measureSlotPages(options.coverBytes);
    pageCursor += coverPages;
  }

  for (const slot of filled) {
    if (options.separators && options.separatorBytes) {
      const sep = await options.separatorBytes(slot.label);
      parts.push(sep);
      pageCursor += await measureSlotPages(sep);
    }
    const startPageBeforeToc = pageCursor + 1;
    const count = await measureSlotPages(slot.bytes as Uint8Array);
    parts.push(slot.bytes as Uint8Array);
    sections.push({
      title: slot.label,
      startPageBeforeToc,
      pageCount: count,
    });
    pageCursor += count;
  }

  const bodyBytes = await mergePdfs(parts);
  return { bodyBytes, sections, coverPages };
}
