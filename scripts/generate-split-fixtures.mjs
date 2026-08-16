/**
 * Generate redistributable synthetic PDFs for split tests.
 * Uses raw PDF syntax so this script does not import pdf-lib (slow cold start).
 * Run: node scripts/generate-split-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/tests/fixtures'
);
mkdirSync(outDir, { recursive: true });

function xrefTable(offsets) {
  let table = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    table += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  return table;
}

function assemble(objects) {
  let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(body, 'latin1');
  body += xrefTable(offsets);
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function sharedResourcesPdf() {
  const blob = 'SUMI-SHARED-RESOURCE '.repeat(4000);
  const pageCount = 12;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    'PLACEHOLDER_PAGES',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${blob.length} >>\nstream\n${blob}\nendstream`,
  ];
  const pageObjNumbers = [];
  for (let i = 0; i < pageCount; i++) {
    const contentObj = objects.length + 1;
    const content =
      i === 0
        ? 'BT /F1 12 Tf 48 740 Td (shared-resource-page-0) Tj ET'
        : `BT /F1 12 Tf 48 740 Td (shared-resource-page-${i}) Tj ET q 20 0 0 20 48 400 cm /Im1 Do Q`;
    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    );
    pageObjNumbers.push(objects.length + 1);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObj} 0 R >>`
    );
  }
  objects[1] = `<< /Type /Pages /Count ${pageCount} /Kids [ ${pageObjNumbers
    .map((n) => `${n} 0 R`)
    .join(
      ' '
    )} ] /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 4 0 R >> >> >>`;
  return assemble(objects);
}

function bookmarkedPdf() {
  const contents = [1, 2, 3].map(
    (i) => `BT /F1 12 Tf 24 100 Td (Bookmark page ${i}) Tj ET`
  );
  return assemble([
    '<< /Type /Catalog /Pages 2 0 R /Outlines 3 0 R >>',
    '<< /Type /Pages /Count 3 /Kids [ 7 0 R 8 0 R 9 0 R ] /Resources << /Font << /F1 10 0 R >> >> >>',
    '<< /Type /Outlines /First 4 0 R /Last 6 0 R /Count 3 >>',
    '<< /Title (One) /Parent 3 0 R /Dest [ 7 0 R /Fit ] /Next 5 0 R >>',
    '<< /Title (Two) /Parent 3 0 R /Dest [ 8 0 R /Fit ] /Prev 4 0 R /Next 6 0 R >>',
    '<< /Title (Three) /Parent 3 0 R /Dest [ 9 0 R /Fit ] /Prev 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 11 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 12 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 13 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${contents[0].length} >>\nstream\n${contents[0]}\nendstream`,
    `<< /Length ${contents[1].length} >>\nstream\n${contents[1]}\nendstream`,
    `<< /Length ${contents[2].length} >>\nstream\n${contents[2]}\nendstream`,
  ]);
}

writeFileSync(join(outDir, 'shared-resources.pdf'), sharedResourcesPdf());
writeFileSync(join(outDir, 'bookmarked.pdf'), bookmarkedPdf());
console.log('wrote fixtures to', outDir);
