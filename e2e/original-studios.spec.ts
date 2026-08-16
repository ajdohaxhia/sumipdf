import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

async function textPdf(label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 595]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(label, { x: 48, y: 420, size: 16, font });
  return Buffer.from(await doc.save());
}

async function formPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 595]);
  const form = doc.getForm();
  const name = form.createTextField('name');
  name.addToPage(page, { x: 48, y: 420, width: 220, height: 28 });
  return Buffer.from(await doc.save());
}

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

test('command palette and utility archive work from the keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Control+K');
  const command = page.locator('#sumi-command-input');
  await expect(command).toBeFocused();
  await command.fill('privacy finder');
  await expect(
    page.getByRole('option', { name: /Privacy Finder/i })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sumi-command')).not.toHaveAttribute('open', '');

  await page.keyboard.press('/');
  await expect(page.locator('#search-bar')).toBeFocused();
  await expect(page.locator('.sumi-directory')).toHaveAttribute('open', '');
});

test('Batch Form Studio maps data before producing a ZIP', async ({ page }) => {
  await page.goto('/batch-forms.html');
  await page.locator('#original-file').setInputFiles([
    {
      name: 'template.pdf',
      mimeType: 'application/pdf',
      buffer: await formPdf(),
    },
    {
      name: 'rows.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name\nAda Lovelace\n'),
    },
  ]);
  await expect(page.getByText(/2 file\(s\) ready/i)).toBeVisible();
  await page.getByRole('button', { name: 'Map fields' }).click();
  await expect(
    page.getByRole('heading', { name: 'Map template fields' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Generate local batch' }).click();
  await expect(page.getByText(/1 PDF\(s\) ready/i)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('batch-forms.zip');
});

test('Packet Builder requires mapping, builds, and exports one PDF at a time', async ({
  page,
}) => {
  const files = await Promise.all([
    textPdf('Cover'),
    textPdf('Identity'),
    textPdf('CV'),
  ]);
  await page.goto('/packet-builder.html');
  await page.locator('#original-file').setInputFiles(
    files.map((buffer, index) => ({
      name: `packet-${index + 1}.pdf`,
      mimeType: 'application/pdf',
      buffer,
    }))
  );
  await page.getByRole('button', { name: 'Configure packet' }).click();
  await expect(page.getByText(/ready for slot mapping/i)).toBeVisible();
  await page.getByRole('button', { name: 'Build packet locally' }).click();
  await expect(page.getByText(/Packet ready/i)).toBeVisible({
    timeout: 30_000,
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download packet PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('packet.pdf');
});

test('Capture exposes an ordered image queue before PDF export', async ({
  page,
}) => {
  await page.goto('/capture.html');
  await page.locator('#original-file').setInputFiles([
    { name: 'page-1.png', mimeType: 'image/png', buffer: onePixelPng },
    { name: 'page-2.png', mimeType: 'image/png', buffer: onePixelPng },
  ]);
  await page.getByRole('button', { name: 'Open capture studio' }).click();
  await expect(page.locator('.sumi-capture-page')).toHaveCount(2);
  await page
    .locator('.sumi-capture-page')
    .first()
    .getByRole('button', { name: 'Rotate' })
    .click();
  await expect(page.locator('.sumi-capture-page').first()).toContainText('90°');
  await page.getByRole('button', { name: 'Build PDF from pages' }).click();
  await expect(page.getByText(/2 page PDF ready/i)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download capture.pdf' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('capture.pdf');
});
