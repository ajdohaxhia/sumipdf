#!/usr/bin/env node
/**
 * Generate Smart Split barcode fixtures: real raster symbols embedded in PDFs.
 * PNGs are flattened onto opaque white before embed so pdf-lib/PDF.js preserve bars.
 * Uses bwip-js. Output: src/tests/fixtures/barcodes/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bwipjs from 'bwip-js';
import { PNG } from 'pngjs';
import { PDFDocument, degrees, rgb } from 'pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src/tests/fixtures/barcodes');
mkdirSync(outDir, { recursive: true });

/** Composite transparent barcode modules onto white (required for PDF embed fidelity). */
function flattenPng(buf) {
  const png = PNG.sync.read(Buffer.from(buf));
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3] / 255;
    png.data[i] = Math.round(png.data[i] * a + 255 * (1 - a));
    png.data[i + 1] = Math.round(png.data[i + 1] * a + 255 * (1 - a));
    png.data[i + 2] = Math.round(png.data[i + 2] * a + 255 * (1 - a));
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

async function png(opts) {
  return flattenPng(await bwipjs.toBuffer(opts));
}

async function pdfWithImages(pages, name) {
  const doc = await PDFDocument.create();
  for (const pageSpec of pages) {
    const page = doc.addPage(pageSpec.size || [500, 600]);
    if (pageSpec.bg) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: page.getWidth(),
        height: page.getHeight(),
        color: pageSpec.bg,
      });
    }
    for (const img of pageSpec.images || []) {
      const embedded = await doc.embedPng(img.bytes);
      const dims = embedded.scale(img.scale || 1);
      page.drawImage(embedded, {
        x: img.x,
        y: img.y,
        width: dims.width,
        height: dims.height,
        rotate: img.rotate ? degrees(img.rotate) : undefined,
      });
    }
    if (pageSpec.label) {
      page.drawText(pageSpec.label, {
        x: 24,
        y: page.getHeight() - 28,
        size: 10,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }
  const bytes = await doc.save({ useObjectStreams: false });
  writeFileSync(join(outDir, name), bytes);
  return bytes;
}

const qr = await png({
  bcid: 'qrcode',
  text: 'SUMI-QR-ALPHA',
  scale: 4,
  padding: 16,
  includetext: false,
});
const code128 = await png({
  bcid: 'code128',
  text: 'SUMI128TEST',
  scale: 4,
  height: 18,
  padding: 16,
  includetext: false,
});
const ean13 = await png({
  bcid: 'ean13',
  text: '5901234123457',
  scale: 4,
  height: 18,
  padding: 16,
  includetext: false,
});
const qrLow = await png({
  bcid: 'qrcode',
  text: 'SUMI-QR-LOW',
  scale: 3,
  padding: 12,
  includetext: false,
  barcolor: '777777',
  backgroundcolor: 'EEEEEE',
});

writeFileSync(join(outDir, 'qr.png'), qr);
writeFileSync(join(outDir, 'code128.png'), code128);
writeFileSync(join(outDir, 'ean13.png'), ean13);

await pdfWithImages(
  [{ label: 'qr', images: [{ bytes: qr, x: 80, y: 180 }] }],
  'qr.pdf'
);
await pdfWithImages(
  [{ label: 'code128', images: [{ bytes: code128, x: 40, y: 250 }] }],
  'code128.pdf'
);
await pdfWithImages(
  [{ label: 'ean13', images: [{ bytes: ean13, x: 60, y: 250 }] }],
  'ean13.pdf'
);
await pdfWithImages(
  [
    {
      label: 'rotated-qr',
      images: [{ bytes: qr, x: 140, y: 180, rotate: 90 }],
    },
  ],
  'rotated-qr.pdf'
);
await pdfWithImages(
  [
    {
      label: 'low-contrast-qr',
      bg: rgb(0.93, 0.93, 0.93),
      images: [{ bytes: qrLow, x: 80, y: 180 }],
    },
  ],
  'low-contrast-qr.pdf'
);
await pdfWithImages(
  [
    {
      label: 'multi',
      images: [
        { bytes: qr, x: 40, y: 320, scale: 0.8 },
        { bytes: code128, x: 40, y: 140, scale: 0.9 },
      ],
    },
  ],
  'multi-codes.pdf'
);
await pdfWithImages([{ label: 'no-code control' }], 'no-code.pdf');

console.log(`[fixtures] wrote barcode PDFs to ${outDir}`);
