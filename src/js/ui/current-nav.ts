export type CurrentNavId =
  | 'workspace'
  | 'inspect'
  | 'flow'
  | 'proof'
  | 'tools'
  | 'recipes'
  | 'privacy'
  | null;

const CHROME_PAGES = new Set([
  'index',
  'index.html',
  'workspace',
  'workspace.html',
  'inspect',
  'inspect.html',
  'flow',
  'flow.html',
  'proof',
  'proof.html',
  'tools',
  'tools.html',
  'recipes',
  'recipes.html',
  'privacy',
  'privacy.html',
  'terms',
  'terms.html',
  'faq',
  'faq.html',
  'contact',
  'contact.html',
  'licensing',
  'licensing.html',
  'simple-index',
  'simple-index.html',
]);

function fileFromPath(pathname: string): string {
  const raw = pathname.split('/').pop() || 'index.html';
  return raw.split('?')[0] || 'index.html';
}

function stem(file: string): string {
  return file.replace(/\.html$/, '') || 'index';
}

export function currentNavId(pathname: string, hash = ''): CurrentNavId {
  const file = fileFromPath(pathname);
  const name = stem(file);
  const fragment = hash.replace(/^#/, '');

  if (name === 'tools') return 'tools';
  if (name === 'recipes') return 'recipes';
  if (name === 'privacy') return 'privacy';
  if (name === 'inspect') return 'inspect';
  if (name === 'flow') return 'flow';
  if (name === 'proof') return 'proof';
  if (name === 'workspace') {
    if (fragment === 'inspect') return 'inspect';
    if (fragment === 'flow') return 'flow';
    if (fragment === 'proof' || fragment === 'preview') return 'proof';
    return 'workspace';
  }
  if (!CHROME_PAGES.has(file) && !CHROME_PAGES.has(name)) return 'tools';
  return null;
}

export function linkMatchesNav(href: string, id: CurrentNavId): boolean {
  if (!id) return false;
  let file: string;
  let fragment: string;
  try {
    const url = new URL(href, 'https://sumi.local/');
    file = fileFromPath(url.pathname);
    fragment = url.hash.replace(/^#/, '');
  } catch {
    const [path, hashPart] = href.split('#');
    file = fileFromPath(path || '');
    fragment = hashPart || '';
  }
  const name = stem(file);

  switch (id) {
    case 'workspace':
      return name === 'workspace' && fragment === '';
    case 'inspect':
      return (
        name === 'inspect' || (name === 'workspace' && fragment === 'inspect')
      );
    case 'flow':
      return name === 'flow' || (name === 'workspace' && fragment === 'flow');
    case 'proof':
      return (
        name === 'proof' ||
        (name === 'workspace' &&
          (fragment === 'proof' || fragment === 'preview'))
      );
    case 'tools':
      return name === 'tools';
    case 'recipes':
      return name === 'recipes';
    case 'privacy':
      return name === 'privacy';
    default:
      return false;
  }
}

export function markCurrentNav(
  root: Document | HTMLElement = document,
  loc: Pick<Location, 'pathname' | 'hash'> = window.location
): void {
  const id = currentNavId(loc.pathname, loc.hash);
  const links = root.querySelectorAll<HTMLAnchorElement>(
    '.sumi-nav a[href], #mobile-menu a[href], a.mobile-nav-link'
  );
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (linkMatchesNav(href, id)) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

export function initCurrentNav(): void {
  markCurrentNav();
  window.addEventListener('hashchange', () => markCurrentNav());
}
