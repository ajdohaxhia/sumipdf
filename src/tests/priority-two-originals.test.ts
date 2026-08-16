import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  orderPages,
  perspectiveWarp,
  rotateIndex,
  toGray,
  toMono,
} from '@/js/sumi/capture';
import { runPreflight } from '@/js/sumi/preflight';
import {
  applySafeA11yFixes,
  auditAccessibility,
} from '@/js/sumi/accessibility';
import {
  diffWatched,
  readWatchedFiles,
  WATCH_FOLDER_EXPERIMENTAL,
  watchFolderDisclaimer,
} from '@/js/sumi/watch-folder';

describe('Capture', () => {
  it('warps, rotates, and converts pixels without a network', () => {
    const src = new Uint8ClampedArray(4 * 4 * 4);
    src[0] = 255;
    const out = perspectiveWarp(
      src,
      4,
      4,
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
        { x: 0, y: 3 },
      ],
      2,
      2
    );
    expect(out.length).toBe(16);
    expect(toGray(out)[0]).toBeGreaterThanOrEqual(0);
    expect(toMono(out)[0] === 0 || toMono(out)[0] === 255).toBe(true);
    expect(rotateIndex(90)).toBe(180);
    expect(
      orderPages([{ id: 'a' }, { id: 'b' }] as never, 0, 1).map((p) => p.id)
    ).toEqual(['b', 'a']);
  });
});

describe('Print Preflight', () => {
  it('flags mixed sizes and does not claim ISO', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 500]);
    doc.addPage([600, 400]);
    const report = await runPreflight(await doc.save());
    expect(report.isoClaim).toBe(false);
    expect(report.issues.some((i) => i.id === 'mixed-size')).toBe(true);
    expect(report.issues.some((i) => i.level === 'not-verifiable')).toBe(true);
    expect(report.limitations.join(' ')).toMatch(/not an iso/i);
  });
});

describe('Accessibility Audit', () => {
  it('offers safe title/lang fixes and refuses PDF/UA claims', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 500]);
    const bytes = await doc.save();
    const report = await auditAccessibility(bytes);
    expect(report.pdfUaClaim).toBe(false);
    expect(report.wcagClaim).toBe(false);
    expect(report.findings.some((f) => f.fix === 'set-title')).toBe(true);
    const fixed = await applySafeA11yFixes(bytes, {
      title: 'Pack',
      lang: 'en',
    });
    const after = await auditAccessibility(fixed);
    expect(after.findings.find((f) => f.id === 'title')?.detail).toContain(
      'Pack'
    );
  });
});

describe('Watch Folder', () => {
  it('is experimental, opt-in copy, and diffs local file lists', () => {
    expect(WATCH_FOLDER_EXPERIMENTAL).toBe(true);
    expect(watchFolderDisclaimer().toLowerCase()).toContain('opt-in');
    const diff = diffWatched(
      [{ name: 'a.pdf', size: 1, lastModified: 1 }],
      [
        { name: 'a.pdf', size: 1, lastModified: 1 },
        { name: 'b.pdf', size: 2, lastModified: 2 },
      ]
    );
    expect(diff.added.map((f) => f.name)).toEqual(['b.pdf']);
  });

  it('reads only files when the user explicitly refreshes a directory', async () => {
    const entries = [
      {
        kind: 'directory' as const,
        name: 'nested',
      },
      {
        kind: 'file' as const,
        name: 'b.pdf',
        getFile: async () =>
          new File(['bb'], 'b.pdf', {
            type: 'application/pdf',
            lastModified: 2,
          }),
      },
      {
        kind: 'file' as const,
        name: 'a.pdf',
        getFile: async () =>
          new File(['a'], 'a.pdf', {
            type: 'application/pdf',
            lastModified: 1,
          }),
      },
    ];
    const files = await readWatchedFiles({
      async *values() {
        yield* entries;
      },
    });
    expect(files).toEqual([
      { name: 'a.pdf', size: 1, lastModified: 1 },
      { name: 'b.pdf', size: 2, lastModified: 2 },
    ]);
  });
});
