declare global {
  interface Window { dataLayer?: unknown[] }
}

type ContactEvent = 'contact_form_start' | 'generate_lead';

export function trackForm(event: ContactEvent): void {
  window.dataLayer ??= [];
  window.dataLayer.push({ event, form_provider: 'hubspot' });
}

export function trackContactClick(placement: 'hero' | 'footer'): void {
  window.dataLayer ??= [];
  window.dataLayer.push({ event: 'contact_click', placement });
}

export function trackJourneyClick(): void {
  window.dataLayer ??= [];
  window.dataLayer.push({ event: 'journey_click', placement: 'hero', destination: 'resultados' });
}
