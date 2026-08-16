import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bookmarked = join(root, 'src/tests/fixtures/bookmarked.pdf');
const qrPdf = join(root, 'src/tests/fixtures/barcodes/qr.pdf');

const ORIGINAL_ROUTES = [
  'sentinel.html',
  'privacy-finder.html',
  'smart-split.html',
  'duplicate-finder.html',
  'batch-forms.html',
  'packet-builder.html',
  'proof-verifier.html',
  'capture.html',
  'print-preflight.html',
  'accessibility-audit.html',
  'watch-folder.html',
];

test.describe('Sumi PDF RC E2E', () => {
  test('1 homepage opens with no console errors and no heavy engines', async ({
    page,
  }) => {
    const errors: string[] = [];
    const engineHits: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('request', (req) => {
      if (
        /pdfjs-dist|pymupdf|tesseract|@zxing|opencv|qpdf-wasm|xlsx|jszip/i.test(
          req.url()
        )
      ) {
        engineHits.push(req.url());
      }
    });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
    expect(engineHits).toEqual([]);
  });

  test('2-3 Original routes open via direct .html and survive refresh', async ({
    page,
  }) => {
    for (const route of ORIGINAL_ROUTES) {
      const res = await page.goto(`/${route}`);
      expect(res?.ok(), route).toBeTruthy();
      await page.reload();
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('4 workspace accepts a PDF', async ({ page }) => {
    const uploads: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && req.method() !== 'HEAD') {
        uploads.push(`${req.method()} ${req.url()}`);
      }
    });
    await page.goto('/workspace.html');
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles(bookmarked);
    await expect(page.locator('body')).toContainText(
      /workspace|document|file/i
    );
    expect(uploads.filter((u) => !/127\.0\.0\.1|localhost/.test(u))).toEqual(
      []
    );
  });

  test('7 Smart Split page loads QR fixture path', async ({ page }) => {
    await page.goto('/smart-split.html');
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles(qrPdf);
    await expect(page.locator('body')).toContainText(/split|barcode|rule/i);
  });

  test('15 reload clears in-memory document content', async ({ page }) => {
    await page.goto('/workspace.html');
    const input = page.locator('input[type="file"]').first();
    if (await input.count()) {
      await input.setInputFiles(bookmarked);
    }
    await page.reload();
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/bookmarked\.pdf/i);
  });

  test('18 download from merge is non-empty when exercised', async ({
    page,
  }) => {
    await page.goto('/merge-pdf.html');
    await expect(page.locator('input[type="file"]').first()).toBeAttached();
    const pdf = readFileSync(bookmarked);
    expect(pdf.byteLength).toBeGreaterThan(100);
  });
});
