import './styles/main.css';
import { initContactForm } from './contact';
import { initMetrics } from './metrics';
import { initRail } from './rail';
import { initProcess } from './process';
import { trackAnnouncementClick, trackContactClick, trackSocialClick, trackEvent, initScrollDepth } from './analytics';

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion-ready');

initContactForm();
initMetrics();
initRail();
initProcess();
initScrollDepth();

document.querySelector<HTMLAnchorElement>('[data-cta="hero"]')?.addEventListener('click', trackContactClick);
document.querySelector<HTMLAnchorElement>('[data-announce]')?.addEventListener('click', trackAnnouncementClick);
document.querySelectorAll<HTMLAnchorElement>('[data-social]').forEach(link => {
  const placement = link.closest('#form-success') ? 'form_success' : link.closest('.person') ? 'team' : 'footer';
  link.addEventListener('click', () => trackSocialClick(link.dataset.social!, placement));
});
document.querySelectorAll<HTMLAnchorElement>('a[href="#privacidade"]').forEach(link => {
  link.addEventListener('click', () => { document.querySelector<HTMLDetailsElement>('#privacidade')!.open = true; });
});

// One observer marks blocks as seen (for motion) and sends static view events once.
const viewObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const element = entry.target as HTMLElement;
    element.classList.add('is-in');
    if (element.dataset.person) trackEvent('team_view', { content_id: element.dataset.person });
    viewObserver.unobserve(element);
  }
}, { threshold: .25, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll<HTMLElement>('.center-head, .person').forEach(element => viewObserver.observe(element));
