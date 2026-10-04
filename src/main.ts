import { initResultCounts } from './result-counts';
import './styles/main.css';
import { initContactForm } from './contact';
import { trackContactClick, trackJourneyClick, trackEvent } from './analytics';

initContactForm();
initResultCounts();

document.querySelectorAll<HTMLAnchorElement>('[data-cta]').forEach(link => {
  link.addEventListener('click', () => trackContactClick(link.dataset.cta === 'footer' ? 'footer' : 'hero'));
});

document.querySelectorAll<HTMLAnchorElement>('a[href="#privacidade"]').forEach(link => {
  link.addEventListener('click', () => { document.querySelector<HTMLDetailsElement>('#privacidade')!.open = true; });
});

document.querySelector<HTMLAnchorElement>('[data-journey="hero"]')?.addEventListener('click', trackJourneyClick);

// Anchor scrolling stays native. Navigation follows the reading position and surface.
const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
const surfaces = [...document.querySelectorAll<HTMLElement>('[data-nav-theme]')];
const nav = document.querySelector<HTMLElement>('.top-nav')!;
const links = [...nav.querySelectorAll<HTMLAnchorElement>('a')];
let queued = false;
function updateNavigation(): void {
  queued = false;
  const readingLine = Math.min(window.innerHeight * .35, 240);
  const current = panels.filter(panel => panel.getBoundingClientRect().top <= readingLine).at(-1) ?? panels[0]!;
  links.forEach(link => {
    if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  const surface = surfaces.filter(panel => panel.getBoundingClientRect().top <= 55).at(-1);
  nav.dataset.theme = surface?.dataset.navTheme ?? 'dark';
}
function scheduleNavigation(): void {
  if (!queued) { queued = true; requestAnimationFrame(updateNavigation); }
}
window.addEventListener('scroll', scheduleNavigation, { passive: true });
window.addEventListener('resize', scheduleNavigation);
new ResizeObserver(scheduleNavigation).observe(document.querySelector('main')!);
updateNavigation();

// Observe each case/front once; identifiers are static, never form values.
const seen = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const element = entry.target as HTMLElement;
    trackEvent(element.dataset.solution ? 'solution_view' : 'case_view', { content_id: element.dataset.solution ?? element.dataset.case! });
    seen.unobserve(element);
  });
}, { threshold: .3 });
document.querySelectorAll<HTMLElement>('[data-solution], .proof-linked').forEach((element, index) => {
  if (!element.dataset.solution) element.dataset.case = `case_${index + 1}`;
  seen.observe(element);
});
document.querySelectorAll<HTMLAnchorElement>('a[href^="https://www.linkedin.com/"]').forEach(link => link.addEventListener('click', () => trackEvent('linkedin_click')));
// No direct WhatsApp link exists; do not manufacture a whatsapp_click event.
