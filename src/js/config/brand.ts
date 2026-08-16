/**
 * Central Sumi PDF brand and deployment configuration.
 * Override URLs with VITE_* env vars at build time. Do not scatter domains in templates.
 */

const env = (key: string, fallback: string): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

export const brand = {
  name: env('VITE_BRAND_NAME', 'Sumi PDF'),
  shortName: 'Sumi',
  tagline: 'Understand a document. Build a flow. Prove what changed.',
  supportLine: 'Drop a PDF first. Inspect stays local. Nothing is uploaded.',
  description:
    'Private, local-first PDF workspace. Inspect a document, build a non-destructive flow, and prove what changed before export.',
  logoMark: env('VITE_BRAND_LOGO', 'images/logo-mark.svg'),
  logoHorizontal: 'images/logo-horizontal.svg',
  logoMono: 'images/logo-mono.svg',
  socialImage: 'images/og-default.png',
  siteUrl: trimSlash(env('VITE_SITE_URL', env('SITE_URL', ''))),
  repoUrl: trimSlash(
    env('VITE_REPO_URL', 'https://github.com/ajdohaxhia/sumipdf')
  ),
  upstreamUrl: trimSlash(
    env('VITE_UPSTREAM_URL', 'https://github.com/alam00000/bentopdf')
  ),
  authorUrl: trimSlash(env('VITE_AUTHOR_URL', 'https://adelajdo.com')),
  authorName: 'Adelajdo Haxhiaj',
  credit:
    'Sumi PDF is an open-source project by Adelajdo Haxhiaj, built on BentoPDF.',
  sourceLabel: 'Source code',
  noindex: env('VITE_NOINDEX', '') === 'true',
} as const;

export type BrandConfig = typeof brand;

export function absoluteUrl(path = ''): string {
  const base = brand.siteUrl || '';
  if (!base) return path.startsWith('/') ? path : `/${path}`;
  const suffix = path.replace(/^\//, '');
  return suffix ? `${base}/${suffix}` : base;
}
