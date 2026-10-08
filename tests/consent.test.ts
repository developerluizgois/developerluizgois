import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY, CONSENT_MAX_AGE, GTM_ID, clearAnalyticsCookies, loadGtm, readConsent, saveConsent, setConsentDefaults } from '../src/consent';

afterEach(() => { vi.unstubAllGlobals(); });

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => { data[key] = value; }, data };
}

describe('stored consent', () => {
  const now = Date.UTC(2026, 9, 8);
  it('round-trips a choice', () => {
    const storage = memoryStorage();
    saveConsent(storage, 'granted', now);
    expect(readConsent(storage, now)).toBe('granted');
    saveConsent(storage, 'denied', now);
    expect(readConsent(storage, now)).toBe('denied');
  });
  it('asks again after a year, for corrupt values and without storage', () => {
    const storage = memoryStorage();
    saveConsent(storage, 'granted', now - CONSENT_MAX_AGE - 1);
    expect(readConsent(storage, now)).toBeUndefined();
    expect(readConsent(memoryStorage({ [CONSENT_KEY]: '{not json' }), now)).toBeUndefined();
    expect(readConsent(memoryStorage({ [CONSENT_KEY]: JSON.stringify({ analytics: 'yes', at: now }) }), now)).toBeUndefined();
    expect(readConsent(undefined, now)).toBeUndefined();
  });
  it('never throws when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readConsent(blocked, now)).toBeUndefined();
    expect(() => saveConsent(blocked, 'granted', now)).not.toThrow();
  });
});

describe('Google tag loading', () => {
  it('denies every signal by default and loads GTM once, only after consent', () => {
    const appended: { src: string; async: boolean }[] = [];
    vi.stubGlobal('window', { dataLayer: [] });
    const doc = { createElement: () => ({ src: '', async: false }), head: { appendChild: (el: { src: string; async: boolean }) => appended.push(el) } } as unknown as Document;

    setConsentDefaults();
    const [command, type, defaults] = Array.from(window.dataLayer![0] as ArrayLike<unknown>);
    expect([command, type]).toEqual(['consent', 'default']);
    expect(Object.values(defaults as Record<string, string>).every(value => value === 'denied')).toBe(true);
    expect(appended).toHaveLength(0);

    loadGtm(doc);
    loadGtm(doc);
    expect(appended).toEqual([{ src: `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`, async: true }]);
    expect(Array.from(window.dataLayer![1] as ArrayLike<unknown>)).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(window.dataLayer).toContainEqual(expect.objectContaining({ event: 'gtm.js' }));
  });
});

describe('withdrawing consent', () => {
  it('expires only the GA4 cookies', () => {
    const writes: string[] = [];
    const doc = {
      location: { hostname: 'luizgois.com' },
      get cookie() { return '_ga=GA1.1.1; _ga_17FND4NZ6T=GS1; theme=dark'; },
      set cookie(value: string) { writes.push(value); },
    } as unknown as Document;
    clearAnalyticsCookies(doc);
    expect(writes.every(write => write.includes('Max-Age=0'))).toBe(true);
    expect(writes.some(write => write.startsWith('_ga=') && write.includes('domain=.luizgois.com'))).toBe(true);
    expect(writes.some(write => write.startsWith('_ga_17FND4NZ6T='))).toBe(true);
    expect(writes.some(write => write.startsWith('theme='))).toBe(false);
  });
});
