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

// Keep the reading flow continuous and reveal editorial blocks as they enter the viewport.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion) {
  document.documentElement.classList.add('motion-ready');
  const revealTargets = [...document.querySelectorAll<HTMLElement>('.section-heading, .section-intro, .proof-mosaic, .fronts, .fit-grid, .example-grid, .method-grid, .method-note, .portrait, .about-copy, .faq, .contact-copy, .form-panel, .closing-content')];
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  revealTargets.forEach(target => {
    target.dataset.reveal = '';
    revealObserver.observe(target);
  });
}

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
