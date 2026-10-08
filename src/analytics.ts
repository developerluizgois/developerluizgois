declare global { interface Window { dataLayer?: unknown[] } }

// Properties are static identifiers only. Never pass form values or anything typed by the visitor.
export function trackEvent(event: string, properties: Record<string, string> = {}): void {
  try {
    window.dataLayer ??= [];
    window.dataLayer.push({ event, ...properties });
  } catch { /* Analytics must never interrupt the user's action. */ }
}

// Legacy names stay in parallel so existing GTM triggers keep firing.
const legacyFormEvents = {
  form_start: ['contact_form_start'],
  form_submit: ['contact_form_submit'],
  form_submit_success: ['generate_lead', 'contact_form_success'],
  form_submit_error: ['contact_form_error'],
} as const;
export type FormEvent = keyof typeof legacyFormEvents;

export function trackForm(event: FormEvent): void {
  trackEvent(event, { form_provider: 'hubspot' });
  legacyFormEvents[event].forEach(legacy => trackEvent(legacy, { form_provider: 'hubspot' }));
}

export function trackContactClick(placement: 'hero' | 'process' | 'service', service?: string): void {
  trackEvent('contact_click', { placement, ...(service ? { content_id: service } : {}) });
  if (placement === 'hero') {
    trackEvent('hero_cta_click', { cta: 'primary' });
    trackEvent('hero_primary_cta_click');
  }
  if (placement === 'service' && service) trackEvent('service_cta_click', { content_id: service });
}

export function trackAnnouncementClick(): void {
  trackEvent('announcement_click', { destination: 'mentor_wokepeople' });
}

export function trackSocialClick(network: string, placement: string): void {
  trackEvent('social_click', { network, placement });
  if (network === 'linkedin') trackEvent('linkedin_click');
}

// Fires each depth once per page view.
export function initScrollDepth(): void {
  const marks = [25, 50, 75, 90];
  const sent = new Set<number>();
  let queued = false;
  const check = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    const depth = (window.scrollY / max) * 100;
    for (const mark of marks) {
      if (depth >= mark && !sent.has(mark)) { sent.add(mark); trackEvent(`scroll_${mark}`); }
    }
    if (sent.size === marks.length) window.removeEventListener('scroll', schedule);
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  window.addEventListener('scroll', schedule, { passive: true });
}
