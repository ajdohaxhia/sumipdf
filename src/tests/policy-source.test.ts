import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(rel: string): string {
  return readFileSync(resolve(__dirname, '../..', rel), 'utf8');
}

describe('homepage engine loading', () => {
  it('does not import PDF.js or WASM engines from the home entry', () => {
    const main = read('src/js/main.ts');
    const core = read('src/js/ui-core.ts');
    const format = read('src/js/utils/format.ts');
    const blob = `${main}\n${core}\n${format}`;
    expect(blob).not.toMatch(/pdfjs-dist/);
    expect(blob).not.toMatch(/pymupdf/);
    expect(blob).not.toMatch(/libreoffice/i);
    expect(blob).not.toMatch(/tesseract/i);
    expect(main).toContain("from './ui-core.js'");
    expect(main).not.toContain("from './ui.js'");
  });
});

describe('service worker cache policy', () => {
  it('uses a Sumi cache name and does not cache blob URLs', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("CACHE_VERSION = 'sumi-pdf-v1'");
    expect(sw).toContain('Never caches user documents');
    expect(sw).toContain("url.protocol === 'blob:'");
    expect(sw).toMatch(/isCDN|trustedCdnOrigins/);
  });
});

describe('github stars default', () => {
  it('keeps the GitHub API off unless ENABLE_GITHUB_STARS is true', () => {
    const script = read('scripts/generate-security-headers.mjs');
    expect(script).toContain("process.env.ENABLE_GITHUB_STARS !== 'true'");
  });
});

describe('sitemap origin policy', () => {
  it('omits absolute URLs when SITE_URL is empty', () => {
    const script = read('scripts/generate-sitemap.mjs');
    expect(script).toContain('Skipping absolute sitemap');
    expect(script).not.toContain('github.com/ajdohaxhia/sumipdf');
  });
});
