import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PAGES = resolve(__dirname, '../pages');
const CHROME_EXCEPTIONS = new Set(['pdf-multi-tool.html']);

describe('shared tool chrome', () => {
  it('includes the standard navbar except documented full-viewport editors', () => {
    const files = readdirSync(PAGES).filter((name) => name.endsWith('.html'));
    const missing = files.filter((name) => {
      if (CHROME_EXCEPTIONS.has(name)) return false;
      const html = readFileSync(join(PAGES, name), 'utf8');
      return !html.includes('{{> navbar }}');
    });
    expect(missing).toEqual([]);
    for (const name of CHROME_EXCEPTIONS) {
      const html = readFileSync(join(PAGES, name), 'utf8');
      expect(html).toMatch(/<nav[\s>]/);
    }
  });
});
