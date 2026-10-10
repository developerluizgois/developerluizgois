import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { faqFromHtml, publicSiteUrl } from '../build/seo';

describe('FAQ structured data', () => {
  it('mirrors every visible question and answer as plain text', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const faq = faqFromHtml(html);
    expect(faq).toHaveLength((html.match(/class="faq-item"/g) ?? []).length);
    expect(faq.length).toBeGreaterThan(0);
    expect(faq.find(item => item.question === 'Quanto custa?')?.answer).toContain('R$ 8 mil');
    for (const { question, answer } of faq) {
      expect(question).not.toMatch(/[<>]|&\w+;/);
      expect(answer).not.toMatch(/[<>]|&\w+;/);
    }
  });
});

describe('canonical origin configuration', () => {
  it('normalizes HTTPS origins and keeps missing config as preview', () => {
    expect(publicSiteUrl(' https://example.com ')).toBe('https://example.com/');
    expect(publicSiteUrl('')).toBeUndefined();
  });
  it.each(['http://example.com', 'https://example.com/path', 'https://example.com/?utm_source=x', 'https://example.com/#inicio', 'https://user:pass@example.com', 'https://localhost'])('rejects noncanonical configuration %s', value => {
    expect(() => publicSiteUrl(value)).toThrow();
  });
});
