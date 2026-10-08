// Measurement consent (LGPD). GTM, and with it GA4, only loads after the visitor accepts.
// Refusing keeps every analytics event inside the page's own dataLayer.

export const GTM_ID = 'GTM-KW3WSNGQ';
export const CONSENT_KEY = 'lg-consent';
// The choice is asked again after a year, so it never becomes a forgotten default.
export const CONSENT_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

export type ConsentChoice = 'granted' | 'denied';
interface StoredConsent { analytics: ConsentChoice; at: number }
type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readConsent(storage: ConsentStorage | undefined, now = Date.now()): ConsentChoice | undefined {
  try {
    const stored = JSON.parse(storage?.getItem(CONSENT_KEY) ?? 'null') as Partial<StoredConsent> | null;
    if (!stored || (stored.analytics !== 'granted' && stored.analytics !== 'denied')) return undefined;
    if (typeof stored.at !== 'number' || now - stored.at > CONSENT_MAX_AGE || stored.at > now) return undefined;
    return stored.analytics;
  } catch {
    return undefined;
  }
}

export function saveConsent(storage: ConsentStorage | undefined, choice: ConsentChoice, now = Date.now()): void {
  try { storage?.setItem(CONSENT_KEY, JSON.stringify({ analytics: choice, at: now } satisfies StoredConsent)); } catch { /* Private mode: the banner simply asks again next visit. */ }
}

function gtag(..._args: unknown[]): void {
  window.dataLayer ??= [];
  // gtag commands must be pushed as an `arguments` object, exactly like the official snippet.
  window.dataLayer.push(arguments);
}

// Google signals stay denied until consent; ads signals stay denied because the site runs no ads.
export function setConsentDefaults(): void {
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
}

let gtmLoaded = false;
export function loadGtm(doc: Document = document): void {
  if (gtmLoaded) return;
  gtmLoaded = true;
  gtag('consent', 'update', { analytics_storage: 'granted' });
  window.dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  doc.head.appendChild(script);
}

// GA4 cookies are set on the registrable domain (.luizgois.com); clearing both forms covers local hosts too.
export function clearAnalyticsCookies(doc: Document = document): void {
  const names = doc.cookie.split(';').map(part => part.split('=')[0].trim()).filter(name => name === '_ga' || name.startsWith('_ga_'));
  const host = doc.location.hostname;
  for (const name of names) {
    for (const domain of ['', `; domain=${host}`, `; domain=.${host.split('.').slice(-2).join('.')}`]) {
      doc.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  }
}

export function initConsent(): void {
  setConsentDefaults();
  const storage = (() => { try { return window.localStorage; } catch { return undefined; } })();
  const current = readConsent(storage);
  if (current === 'granted') loadGtm();

  // Visibility is a class on <html> so the inline script in index.html can set it before first paint.
  const root = document.documentElement;
  const banner = document.querySelector<HTMLElement>('[data-consent-banner]');
  if (!banner) return;
  const show = () => root.classList.remove('consent-known');
  const hide = () => root.classList.add('consent-known');
  if (current) hide(); else show();

  banner.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach(button => {
    button.addEventListener('click', () => {
      const choice = button.dataset.consent === 'granted' ? 'granted' : 'denied';
      saveConsent(storage, choice);
      hide();
      if (choice === 'granted') {
        loadGtm();
      } else {
        // Withdrawing after accepting: stop GA4 on this page and remove its cookies.
        if (gtmLoaded) gtag('consent', 'update', { analytics_storage: 'denied' });
        clearAnalyticsCookies();
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-consent-open]').forEach(button => {
    button.addEventListener('click', () => {
      show();
      banner.querySelector<HTMLButtonElement>('[data-consent="granted"]')?.focus();
    });
  });
}
