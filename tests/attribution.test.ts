import { describe, expect, it } from 'vitest';
import { readAttribution } from '../src/attribution';

describe('CRM-only attribution', () => {
  it('keeps campaign slugs and only the referring origin', () => {
    expect(readAttribution('https://luizgois.com/?utm_source=linkedin&utm_campaign=produto-2026&email=private', 'https://example.com/private?email=person@example.com')).toEqual({ utm_source: 'linkedin', utm_campaign: 'produto-2026', referrer: 'https://example.com' });
  });
  it('drops emails, overly long values and internal referrers', () => {
    expect(readAttribution(`https://luizgois.com/?utm_source=person@example.com&utm_term=${'x'.repeat(121)}`, 'https://luizgois.com/#sobre')).toEqual({});
  });
});
