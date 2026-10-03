import { initHeroMetrics } from './hero-metrics';
import './styles/main.css';
import { initContactForm } from './contact';
import { trackContactClick } from './analytics';

initContactForm();
initHeroMetrics();

document.querySelectorAll<HTMLAnchorElement>('[data-cta]').forEach(link => {
  link.addEventListener('click', () => trackContactClick(link.dataset.cta === 'footer' ? 'footer' : 'hero'));
});

document.querySelectorAll<HTMLAnchorElement>('a[href="#privacidade"]').forEach(link => {
  link.addEventListener('click', () => { document.querySelector<HTMLDetailsElement>('#privacidade')!.open = true; });
});

// Native scrolling retains keyboard, touch, reduced motion and deep-link navigation.
// Oversized/expanded panels keep their full natural height; no wheel interception.
const panels = document.querySelectorAll<HTMLElement>('[data-panel]');
const dots = document.querySelectorAll<HTMLAnchorElement>('.section-progress a');
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    dots.forEach(dot => {
      const active = dot.hash === `#${entry.target.id}`;
      if (active) dot.setAttribute('aria-current', 'location');
      else dot.removeAttribute('aria-current');
    });
  }
}, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });
panels.forEach(panel => observer.observe(panel));
