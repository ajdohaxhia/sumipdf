import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { loadPdf } from '../shared/pdf';
import {
  mergePdfs,
  addPageNumbers,
  fixPageSize,
} from '../../utils/pdf-operations';
import { defaultSanitizeOptions, sanitizePdf } from '../../utils/sanitize';
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
  const parts: Uint8Array[] = [];
  const notes: string[] = [
    'Packet Builder merges files in slot order on this device.',
    'Templates are not legal claims.',
  ];
  if (options.coverTitle) parts.push(await coverPage(options.coverTitle));
  for (const slot of filled) {
    if (options.separators) parts.push(await separatorPage(slot.label));
    parts.push(slot.bytes as Uint8Array);
  }
  let bytes = await mergePdfs(parts);
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
  if (options.bookmarks || options.toc) {
    notes.push(
      options.toc
        ? 'A full TOC page was not generated; slot labels are recorded in Proof. Use Table of Contents on the merged file if you need a TOC page.'
        : 'Outline bookmarks are best-effort. Slot order is the source of truth.'
    );
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
