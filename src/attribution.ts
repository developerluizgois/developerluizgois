import { attributionKeys, type Attribution } from '../shared/lead';

// Campaign slugs only; never store full URLs, query strings or arbitrary free text.
export function readAttribution(url: string, referrer: string): Attribution {
  const result: Attribution = {};
  const params = new URL(url).searchParams;
  for (const key of attributionKeys) {
    if (key === 'referrer') continue;
    const value = params.get(key)?.trim();
    if (value && value.length <= 120 && /^[a-zA-Z0-9_. -]+$/.test(value)) result[key] = value;
  }
  try {
    const source = new URL(referrer);
    if (['https:', 'http:'].includes(source.protocol) && source.origin !== new URL(url).origin && source.origin.length <= 120) result.referrer = source.origin;
  } catch { /* No referrer is normal. */ }
  return result;
}
