import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function syntheticPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([420, 595]);
  page.drawText('Sumi journey fixture', {
    x: 48,
    y: 400,
    size: 16,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  doc.setTitle('Journey title');
  doc.setAuthor('Journey author');
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

test('drop inspect accept flow preview execute proof download', async ({
  page,
}) => {
  await page.goto('/');
  const pdf = await syntheticPdf();
  await page.setInputFiles('[data-testid="home-file-input"]', {
    name: 'journey.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  });

  await expect(page.getByTestId('workspace-root')).toBeVisible();
  await expect(page.getByTestId('inspect-findings')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId('accept-recommendation').first().click();
  await expect(page.getByTestId('pane-flow')).toBeVisible();

  await page.getByTestId('flow-add').selectOption('remove-metadata');
  await page.getByTestId('flow-preview').click();
  await expect(page.getByTestId('pane-preview')).toBeVisible();
  await page.getByRole('tab', { name: 'Flow' }).click();
  await page.getByTestId('flow-execute').click();
  await expect(page.getByTestId('proof-panel')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/not a legal certificate/i)).toBeVisible();

  const [downloadPdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-output').click(),
  ]);
  expect(downloadPdf.suggestedFilename()).toMatch(/\.pdf$/i);

  const [downloadReceipt] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-receipt').click(),
  ]);
  expect(downloadReceipt.suggestedFilename()).toMatch(/json/i);
});
