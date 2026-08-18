import { afterEach, describe, expect, it } from 'vitest';
import {
  currentNavId,
  linkMatchesNav,
  markCurrentNav,
} from '@/js/ui/current-nav';

const NAV = `
<nav class="sumi-nav">
  <a href="workspace.html">Workspace</a>
  <a href="workspace.html#inspect">Inspect</a>
  <a href="workspace.html#flow">Flow</a>
  <a href="workspace.html#proof">Proof</a>
  <a href="tools.html">Tools</a>
  <a href="recipes.html">Recipes</a>
  <a href="privacy.html">Privacy</a>
</nav>
<div id="mobile-menu">
  <a href="workspace.html" class="mobile-nav-link">Workspace</a>
  <a href="workspace.html#inspect" class="mobile-nav-link">Inspect</a>
  <a href="tools.html" class="mobile-nav-link">Tools</a>
</div>
`;

function currentHrefs(): string[] {
  return [...document.querySelectorAll('[aria-current="page"]')].map(
    (el) => el.getAttribute('href') || ''
  );
}

describe('current nav', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('maps chrome pages and tool pages to the matching item', () => {
    expect(currentNavId('/workspace.html', '')).toBe('workspace');
    expect(currentNavId('/workspace.html', '#inspect')).toBe('inspect');
    expect(currentNavId('/inspect.html', '')).toBe('inspect');
    expect(currentNavId('/workspace.html', '#flow')).toBe('flow');
    expect(currentNavId('/merge-pdf.html', '')).toBe('tools');
    expect(currentNavId('/edit-pdf-text.html', '')).toBe('tools');
    expect(currentNavId('/tools.html', '')).toBe('tools');
    expect(currentNavId('/recipes.html', '')).toBe('recipes');
    expect(currentNavId('/privacy.html', '')).toBe('privacy');
    expect(currentNavId('/index.html', '')).toBeNull();
    expect(currentNavId('/faq.html', '')).toBeNull();
  });

  it('matches hashed workspace links without marking the workspace root', () => {
    expect(linkMatchesNav('workspace.html#inspect', 'inspect')).toBe(true);
    expect(linkMatchesNav('workspace.html', 'inspect')).toBe(false);
    expect(linkMatchesNav('workspace.html', 'workspace')).toBe(true);
    expect(linkMatchesNav('inspect.html', 'inspect')).toBe(true);
    expect(linkMatchesNav('tools.html', 'tools')).toBe(true);
  });

  it('marks Tools on a classic tool page', () => {
    document.body.innerHTML = NAV;
    markCurrentNav(document, { pathname: '/merge-pdf.html', hash: '' });
    expect(currentHrefs()).toEqual(['tools.html', 'tools.html']);
  });

  it('marks Inspect from both inspect.html and the workspace hash', () => {
    document.body.innerHTML = NAV;
    markCurrentNav(document, { pathname: '/inspect.html', hash: '' });
    expect(currentHrefs()).toEqual([
      'workspace.html#inspect',
      'workspace.html#inspect',
    ]);

    markCurrentNav(document, { pathname: '/workspace.html', hash: '#inspect' });
    expect(currentHrefs()).toEqual([
      'workspace.html#inspect',
      'workspace.html#inspect',
    ]);
  });

  it('treats hash-only workspace moves as a new current item', () => {
    document.body.innerHTML = NAV;
    markCurrentNav(document, { pathname: '/workspace.html', hash: '' });
    expect(currentHrefs()).toEqual(['workspace.html', 'workspace.html']);
    markCurrentNav(document, { pathname: '/workspace.html', hash: '#flow' });
    expect(currentHrefs()).toEqual(['workspace.html#flow']);
  });
});
