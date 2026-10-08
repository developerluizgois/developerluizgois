import './styles/main.css';
import { initContactForm } from './contact';
import { initMetrics } from './metrics';
import { initRail } from './rail';
import { initProcess } from './process';
import { initMotion } from './motion';
import { initAnchorLinks, initSmoothScroll, scrollToSection } from './scroll';
import { trackAnnouncementClick, trackContactClick, trackSocialClick, trackEvent, initScrollDepth } from './analytics';

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion-ready');

initSmoothScroll();
initAnchorLinks();
initMotion();
initContactForm();
initMetrics();
initRail();
initProcess();
initScrollDepth();

document.querySelectorAll<HTMLAnchorElement>('[data-cta]').forEach(link => {
  link.addEventListener('click', () => trackContactClick(link.dataset.cta === 'process' ? 'process' : 'hero'));
});

// "Quero esse serviço": glide to the form with an editable starting text for that service.
const challenge = document.querySelector<HTMLTextAreaElement>('#contact-form [name="challenge"]')!;
let lastPrefill = '';
document.querySelectorAll<HTMLAnchorElement>('[data-prefill]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const text = link.dataset.prefill!;
    // Never overwrite something the visitor wrote.
    if (!challenge.value.trim() || challenge.value === lastPrefill) {
      challenge.value = text;
      lastPrefill = text;
      challenge.removeAttribute('aria-invalid');
      document.getElementById('error-challenge')?.remove();
    }
    trackContactClick('service', link.dataset.service);
    scrollToSection(document.querySelector<HTMLElement>('#contato')!, () => challenge.focus({ preventScroll: true }));
  });
});
document.querySelector<HTMLAnchorElement>('[data-announce]')?.addEventListener('click', trackAnnouncementClick);
document.querySelectorAll<HTMLAnchorElement>('[data-social]').forEach(link => {
  const placement = link.closest('#form-success') ? 'form_success' : link.closest('.person') ? 'team' : 'footer';
  link.addEventListener('click', () => trackSocialClick(link.dataset.social!, placement));
});
document.querySelectorAll<HTMLDetailsElement>('[data-faq]').forEach(item => {
  item.addEventListener('toggle', () => { if (item.open) trackEvent('faq_open', { content_id: item.dataset.faq! }); });
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
