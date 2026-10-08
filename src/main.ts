import './styles/main.css';
import { initContactForm } from './contact';
import { initRail } from './rail';
import { initProcess } from './process';
import { trackContactClick, trackJourneyClick, trackSocialClick, trackEvent, initScrollDepth } from './analytics';

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion-ready');

initContactForm();
initRail();
initProcess();
initScrollDepth();

document.querySelectorAll<HTMLAnchorElement>('[data-cta]').forEach(link => {
  link.addEventListener('click', () => trackContactClick(link.dataset.cta === 'header' ? 'header' : 'hero'));
});
document.querySelector<HTMLAnchorElement>('[data-journey="hero"]')?.addEventListener('click', trackJourneyClick);
document.querySelectorAll<HTMLAnchorElement>('[data-social]').forEach(link => {
  link.addEventListener('click', () => trackSocialClick(link.dataset.social!, link.closest('#form-success') ? 'form_success' : 'footer'));
});
document.querySelectorAll<HTMLAnchorElement>('a[href="#privacidade"]').forEach(link => {
  link.addEventListener('click', () => { document.querySelector<HTMLDetailsElement>('#privacidade')!.open = true; });
});

// Header follows the surface beneath it and marks the section being read.
const header = document.querySelector<HTMLElement>('.site-header')!;
const surfaces = [...document.querySelectorAll<HTMLElement>('main [data-surface], footer[data-surface]')];
const navLinks = [...header.querySelectorAll<HTMLAnchorElement>('.header-nav a')];
const navSections = navLinks.map(link => document.querySelector<HTMLElement>(link.hash)!);
let queued = false;
function updateHeader(): void {
  queued = false;
  const line = header.offsetHeight + 12;
  const surface = surfaces.filter(element => element.getBoundingClientRect().top <= line).at(-1) ?? surfaces[0]!;
  header.dataset.surface = surface.dataset.surface!;
  header.toggleAttribute('data-scrolled', window.scrollY > 4);
  const reading = window.innerHeight * .35;
  navLinks.forEach((link, i) => {
    const box = navSections[i]!.getBoundingClientRect();
    if (box.top <= reading && box.bottom > reading) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
const scheduleHeader = () => { if (!queued) { queued = true; requestAnimationFrame(updateHeader); } };
window.addEventListener('scroll', scheduleHeader, { passive: true });
window.addEventListener('resize', scheduleHeader);
updateHeader();

// One observer marks blocks as seen (for motion) and sends static view events once.
const viewObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const element = entry.target as HTMLElement;
    element.classList.add('is-in');
    if (element.dataset.case) trackEvent('case_view', { content_id: element.dataset.case });
    if (element.hasAttribute('data-investment')) trackEvent('investment_view');
    viewObserver.unobserve(element);
  }
}, { threshold: .25, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll<HTMLElement>('.section-head, .case, [data-investment]').forEach(element => viewObserver.observe(element));
