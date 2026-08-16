import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FORBIDDEN = [
  'pdfjs-dist',
  'pymupdf',
  'tesseract',
  'libreoffice',
  'ghostscript',
  '@matbee/libreoffice',
  'wasm-vips',
];

function staticImports(source: string): string[] {
  return [...source.matchAll(/^\s*import\s.+from\s+['"]([^'"]+)['"]/gm)].map(
    (match) => match[1]
  );
}

describe('homepage does not load PDF engines before intent', () => {
  it('keeps main.ts free of engine modules', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/js/main.ts'), 'utf8');
    const imports = staticImports(main).join('\n');
    for (const token of FORBIDDEN) {
      expect(imports.toLowerCase().includes(token), token).toBe(false);
    }
    expect(main).not.toMatch(/from ['"]\.\/ui\.js['"]/);
    expect(main).not.toMatch(/from ['"]\.\/utils\/helpers\.js['"]/);
    expect(main).not.toMatch(/from ['"]\.\/flow['"]/);
    expect(main).not.toMatch(/from ['"]\.\/inspect/);
    expect(main).not.toMatch(/from ['"].*\/sumi\//);
  });

  it('homepage HTML only boots the shared shell', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('src/js/main.ts');
    expect(html).not.toContain('pdf.worker');
    expect(html).not.toContain('pymupdf');
    expect(html).not.toContain('tesseract');
  });
});
