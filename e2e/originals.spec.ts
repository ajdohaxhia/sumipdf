import { test, expect } from '@playwright/test';

test('homepage still boots without original engines', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  const heavy = requests.filter((url) =>
    /pdf\.worker|pymupdf|tesseract|libreoffice|qpdf|opencv|bwip/i.test(url)
  );
  expect(heavy).toEqual([]);
});

test('Sentinel page mounts a local drop zone', async ({ page }) => {
  await page.goto('/sentinel.html');
  await expect(page.getByRole('heading', { name: 'Sentinel' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/malware-free/i)).toBeVisible();
});
