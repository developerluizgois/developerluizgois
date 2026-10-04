declare global { interface Window { dataLayer?: unknown[] } }
export function trackEvent(event: string, properties: Record<string, string> = {}): void {
  try {
    window.dataLayer ??= [];
    window.dataLayer.push({ event, ...properties });
  } catch { /* Analytics must never interrupt the user's action. */ }
}
export function trackForm(event: 'contact_form_start' | 'generate_lead' | 'contact_form_submit' | 'contact_form_success' | 'contact_form_error'): void {
  trackEvent(event, { form_provider: 'hubspot' });
}
export function trackContactClick(placement: 'hero' | 'footer'): void {
  trackEvent('contact_click', { placement });
  if (placement === 'hero') trackEvent('hero_primary_cta_click');
}
export function trackJourneyClick(): void {
  trackEvent('journey_click', { placement: 'hero', destination: 'resultados' });
  trackEvent('hero_results_cta_click');
}
