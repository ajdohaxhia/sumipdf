import { describe, expect, it } from 'vitest';
import {
  getAllTools,
  getToolById,
  getToolOrigin,
} from '@/js/config/tool-registry';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

describe('tool origin (internal)', () => {
  it('marks inherited tools upstream and originals as sumi or hybrid', () => {
    expect(getToolOrigin('split-pdf')).toBe('upstream');
    expect(getToolOrigin('sanitize-pdf')).toBe('upstream');
    expect(getToolOrigin('pdf-workflow')).toBe('upstream');
    expect(getToolOrigin('redact-pdf')).toBe('upstream');
    expect(getToolById('sentinel')?.origin).toBe('sumi');
    expect(getToolById('privacy-finder')?.origin).toBe('sumi');
    expect(getToolById('smart-split')?.origin).toBe('hybrid');
    expect(getToolById('duplicate-finder')?.origin).toBe('sumi');
    expect(getToolById('batch-forms')?.origin).toBe('sumi');
    expect(getToolById('packet-builder')?.origin).toBe('sumi');
    expect(getToolById('proof-verifier')?.origin).toBe('sumi');
    expect(getToolById('watch-folder')?.experimental).toBe(true);
    expect(getAllTools().every((t) => t.origin)).toBe(true);
  });

  it('does not paint origin badges in HTML', () => {
    const pages = resolve(__dirname, '../pages');
    const files = readdirSync(pages).filter((n) => n.endsWith('.html'));
    for (const name of files) {
      const html = readFileSync(join(pages, name), 'utf8');
      expect(html).not.toMatch(/origin:\s*['"]sumi['"]/);
      expect(html.toLowerCase()).not.toContain('origin badge');
    }
  });
});
