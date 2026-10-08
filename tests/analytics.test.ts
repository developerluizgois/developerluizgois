import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackContactClick, trackForm, trackJourneyClick, trackSocialClick } from '../src/analytics';

afterEach(() => { vi.unstubAllGlobals(); });

describe('analytics events', () => {
  it('sends new event names alongside the legacy names GTM already listens to', () => {
    vi.stubGlobal('window', { dataLayer: [] });
    trackForm('form_start');
    trackForm('form_submit_error');
    expect(window.dataLayer!.map(entry => (entry as { event: string }).event)).toEqual(['form_start', 'contact_form_start', 'form_submit_error', 'contact_form_error']);
  });
  it('keeps hero and social events limited to static identifiers', () => {
    vi.stubGlobal('window', { dataLayer: [] });
    trackContactClick('hero');
    trackJourneyClick();
    trackSocialClick('linkedin', 'footer');
    const allowed = new Set(['event', 'placement', 'cta', 'destination', 'network', 'form_provider']);
    for (const entry of window.dataLayer as Record<string, string>[]) {
      expect(Object.keys(entry).every(key => allowed.has(key))).toBe(true);
    }
    expect(window.dataLayer).toContainEqual({ event: 'hero_cta_click', cta: 'primary' });
    expect(window.dataLayer).toContainEqual({ event: 'social_click', network: 'linkedin', placement: 'footer' });
    expect(window.dataLayer).toContainEqual({ event: 'linkedin_click' });
  });
});
