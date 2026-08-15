import { describe, expect, it } from 'vitest';
import { brand, absoluteUrl } from '@/js/config/brand';

describe('brand configuration', () => {
  it('names the product Sumi PDF by default', () => {
    expect(brand.name).toBe('Sumi PDF');
    expect(brand.tagline).toContain('Your files stay on your device');
    expect(brand.repoUrl).toContain('github.com');
    expect(brand.upstreamUrl).toContain('alam00000/bentopdf');
  });

  it('does not claim BentoPDF authorship for the fork credit', () => {
    expect(brand.credit).toContain('BentoPDF');
    expect(brand.credit).toContain('Adelajdo Haxhiaj');
  });

  it('builds absolute URLs from the configured site', () => {
    const url = absoluteUrl('privacy.html');
    expect(url.includes('privacy.html')).toBe(true);
  });
});
