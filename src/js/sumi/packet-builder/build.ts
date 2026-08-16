import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { loadPdf } from '../shared/pdf';
import {
  mergePdfs,
  addPageNumbers,
  fixPageSize,
} from '../../utils/pdf-operations';
import { defaultSanitizeOptions, sanitizePdf } from '../../utils/sanitize';
import { insertTableOfContents, mergeBodyWithMeasuredSections } from './toc';
import type { PacketOptions, PacketSlot, PacketWarning } from './types';

export function packetWarnings(slots: PacketSlot[]): PacketWarning[] {
  const warnings: PacketWarning[] = [];
  const names = new Map<string, string[]>();
  for (const slot of slots) {
    if (slot.required && !slot.bytes) {
      warnings.push({
        level: 'missing',
        message: `Required slot “${slot.label}” is empty.`,
        slotId: slot.id,
      });
    }
    if (slot.fileName) {
      const list = names.get(slot.fileName.toLowerCase()) || [];
      list.push(slot.id);
      names.set(slot.fileName.toLowerCase(), list);
    }
  }
  for (const [name, ids] of names) {
    if (ids.length > 1) {
      warnings.push({
        level: 'duplicate',
        message: `“${name}” is attached to more than one slot.`,
        slotId: ids[0],
      });
    }
  }
  warnings.push({
    level: 'info',
    message:
      'Packet templates are editable starting points. They are not legal forms or filing certificates.',
  });
  return warnings;
}

async function coverPage(title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(title.slice(0, 80) || 'Packet', {
    x: 72,
    y: 720,
    size: 22,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('Assembled locally in Sumi PDF. Not a legal certificate.', {
    x: 72,
    y: 680,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  return new Uint8Array(await doc.save());
}

async function separatorPage(label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(label.slice(0, 80), {
    x: 72,
    y: 421,
    size: 18,
    font,
  });
  return new Uint8Array(await doc.save());
}

export async function buildPacket(
  slots: PacketSlot[],
  options: PacketOptions
): Promise<{ bytes: Uint8Array; warnings: PacketWarning[]; notes: string[] }> {
  const warnings = packetWarnings(slots);
  const filled = slots.filter((s) => s.bytes && s.bytes.byteLength > 0);
  if (!filled.length) {
    throw new Error('Add at least one PDF to a slot.');
  }
  const notes: string[] = [
    'Packet Builder merges files in slot order on this device.',
    'Templates are not legal claims.',
  ];

  const { bodyBytes, sections, coverPages } =
    await mergeBodyWithMeasuredSections(filled, {
      separators: Boolean(options.separators),
      coverBytes: options.coverTitle
        ? await coverPage(options.coverTitle)
        : undefined,
      separatorBytes: (label) => separatorPage(label),
    });

  let bytes = bodyBytes;

  if (options.toc) {
    const toc = await insertTableOfContents(bytes, sections, {
      afterCoverPages: coverPages,
    });
    bytes = toc.bytes;
    notes.push(...toc.notes);
  } else if (options.bookmarks) {
    // Bookmarks without a TOC page: still insert outlines via TOC helper with 0 visual pages?
    // Use insert with toc that only writes outlines — reuse insert which always draws TOC pages.
    // For bookmarks-only, call insert (creates TOC) only when toc is true; otherwise note:
    notes.push(
      'Outline bookmarks are generated when Table of Contents is enabled. Enable TOC for clickable outlines.'
    );
  }

  if (options.normalize) {
    bytes = await fixPageSize(bytes, {
      targetSize: 'A4',
      orientation: 'portrait',
      scalingMode: 'fit',
      backgroundColor: { r: 1, g: 1, b: 1 },
    });
    notes.push('Pages were fit onto A4. Content may letterbox.');
  }
  if (options.pageNumbers) {
    bytes = await addPageNumbers(bytes, {
      position: 'bottom-center',
      fontSize: 11,
      format: 'page_x_of_y',
      color: { r: 0.2, g: 0.2, b: 0.2 },
    });
  }
  if (options.cleanMetadata) {
    const cleaned = await sanitizePdf(bytes, {
      ...defaultSanitizeOptions,
      flattenForms: false,
      removeMetadata: true,
      removeAnnotations: false,
      removeJavascript: true,
      removeEmbeddedFiles: false,
      removeLayers: false,
      removeLinks: false,
      removeStructureTree: false,
      removeMarkInfo: false,
      removeFonts: false,
    });
    bytes = cleaned.bytes;
  }
  if (options.compress) {
    const doc = await loadPdf(bytes);
    bytes = new Uint8Array(await doc.save({ useObjectStreams: true }));
    notes.push('pdf-lib object-stream recompress. Not every packet shrinks.');
  }
  return { bytes, warnings, notes };
}

export function reorderSlots(
  slots: PacketSlot[],
  from: number,
  to: number
): PacketSlot[] {
  const next = slots.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
