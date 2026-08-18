import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getToolById } from '@/js/config/tool-registry';

const styles = readFileSync(resolve(__dirname, '../css/styles.css'), 'utf8');
const sumi = readFileSync(resolve(__dirname, '../css/sumi.css'), 'utf8');
const atelier = readFileSync(
  resolve(__dirname, '../css/sumi-atelier.css'),
  'utf8'
);
const editor = readFileSync(
  resolve(__dirname, '../css/edit-pdf-text.css'),
  'utf8'
);
const textPage = readFileSync(
  resolve(__dirname, '../pages/edit-pdf-text.html'),
  'utf8'
);
const toolsPage = readFileSync(resolve(__dirname, '../../tools.html'), 'utf8');

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  expect(match, `missing ${selector}`).toBeTruthy();
  return match![1];
}

describe('atelier contrast and chrome', () => {
  it('does not paint category headers white on paper', () => {
    const body = ruleBody(styles, '.category-header');
    expect(body).toContain('var(--sumi-ink)');
    expect(body).not.toMatch(/#fff(?:fff)?/i);
  });

  it('keeps compact tool cards on atelier surfaces', () => {
    expect(styles).toMatch(
      /\.compact-mode \.tool-card:hover \{[^}]*background-color: var\(--sumi-surface\)/
    );
    expect(styles).not.toMatch(
      /\.compact-mode \.tool-card:hover \{[^}]*#1f2937/
    );
  });

  it('renders legal copy in ink instead of leftover dark-theme white', () => {
    const body = ruleBody(styles, '.legal-content h2');
    expect(body).toContain('var(--sumi-ink)');
    expect(body).not.toMatch(/color:\s*white/i);
  });

  it('shows the privacy pill only with the desktop nav row', () => {
    expect(sumi).toMatch(
      /@media \(min-width: 1100px\) \{[\s\S]*?\.sumi-privacy-pill \{[\s\S]*?display: inline-flex;/
    );
    expect(sumi).not.toMatch(
      /@media \(min-width: 1024px\) \{[\s\S]*privacy-pill/
    );
  });

  it('lets original-index columns shrink instead of overflowing', () => {
    expect(atelier).toContain(
      'grid-template-columns: 3rem minmax(0, 0.75fr) minmax(0, 1.25fr) 2rem'
    );
  });
});

describe('Edit PDF Text surface', () => {
  it('is registered as an edit tool', () => {
    expect(getToolById('edit-pdf-text')).toMatchObject({
      id: 'edit-pdf-text',
      category: 'edit',
      href: expect.stringContaining('edit-pdf-text.html'),
    });
  });

  it('follows Sumi tokens and does not lock color-scheme to dark', () => {
    expect(editor).toContain('--ecbg: var(--sumi-paper)');
    expect(editor).toContain('--ecaccent: var(--sumi-signal)');
    expect(editor).toContain('z-index: 70');
    expect(textPage).toContain('{{> navbar }}');
    expect(textPage).not.toMatch(/color-scheme"\s+content="dark"/);
  });
});

describe('tools directory filters', () => {
  it('does not override category chips with leftover BentoPDF indigo', () => {
    expect(toolsPage).not.toMatch(/\.category-filter\.active \{[^}]*#4f46e5/);
    expect(toolsPage).not.toMatch(
      /\.category-filter \{[^}]*background-color: #1f2937/
    );
  });
});
