import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturePdf = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/tests/fixtures/bookmarked.pdf'
);

test('homepage loads without PDF engines', async ({ page }) => {
  const engineHits: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (
      /pdfjs-dist|pymupdf|tesseract|libreoffice|qpdf-wasm|coherentpdf/i.test(
        url
      )
    ) {
      engineHits.push(url);
    }
  });
  await page.goto('/');
  await expect(page.getByTestId('home-drop-zone')).toBeVisible();
  await expect(page.locator('body')).toContainText(
    /stay on your device|this device/i
  );
  expect(engineHits).toEqual([]);
});

test('merge-pdf.html is a direct HTML route', async ({ page }) => {
  const response = await page.goto('/merge-pdf.html');
  expect(response?.ok()).toBe(true);
  await expect(
    page.locator('#file-input, input[type="file"]').first()
  ).toBeAttached();
});

test('privacy page states files stay on device', async ({ page }) => {
  const response = await page.goto('/privacy.html');
  expect(response?.ok()).toBe(true);
  await expect(page.locator('body')).toContainText(
    /on your device|this device|not uploaded/i
  );
});

test('service worker never caches a blob PDF request', async ({ page }) => {
  await page.goto('/');
  const cachedBlob = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'no-sw';
    const blob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    await fetch(url).catch(() => undefined);
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      const match = await cache.match(url);
      if (match) return 'cached';
    }
    URL.revokeObjectURL(url);
    return 'not-cached';
  });
  expect(cachedBlob === 'no-sw' || cachedBlob === 'not-cached').toBe(true);
});

test('workspace handoff does not require a server upload', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      uploads.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.goto('/');
  const input = page
    .locator('#home-drop-zone input[type="file"], input[type="file"]')
    .first();
  if (await input.count()) {
    await input.setInputFiles(fixturePdf);
  }
  expect(
    uploads.filter((u) => !u.includes('localhost') && !u.includes('127.0.0.1'))
  ).toEqual([]);
});
