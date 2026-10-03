import { describe, expect, it } from 'vitest';
import { publicSiteUrl } from '../build/seo';

describe('canonical origin configuration', () => {
  it('normalizes HTTPS origins and keeps missing config as preview', () => {
    expect(publicSiteUrl(' https://example.com ')).toBe('https://example.com/');
    expect(publicSiteUrl('')).toBeUndefined();
  });
  it.each(['http://example.com', 'https://example.com/path', 'https://example.com/?utm_source=x', 'https://example.com/#inicio', 'https://user:pass@example.com', 'https://localhost'])('rejects noncanonical configuration %s', value => {
    expect(() => publicSiteUrl(value)).toThrow();
  });
});
