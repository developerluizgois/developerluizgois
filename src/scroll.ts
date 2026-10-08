import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

// Inertial scrolling on wheel/trackpad. Touch keeps the native feel; reduced motion keeps native scroll.
let lenis: Lenis | null = null;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initSmoothScroll(): void {
  if (reduced()) return;
  lenis = new Lenis({ autoRaf: true, lerp: .085, wheelMultiplier: .95, allowNestedScroll: true });
}

// Every in-page link glides to its section instead of jumping.
export function scrollToSection(target: HTMLElement, onDone?: () => void): void {
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.4, easing: t => 1 - Math.pow(1 - t, 4), onComplete: () => onDone?.() });
  } else {
    target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    onDone?.();
  }
}

export function initAnchorLinks(): void {
  document.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (event.defaultPrevented || !link || link.hash.length < 2 || link.hash === '#privacidade' || link.hash === '#conteudo') return;
    const target = document.querySelector<HTMLElement>(link.hash);
    if (!target) return;
    event.preventDefault();
    history.replaceState(null, '', link.hash);
    scrollToSection(target);
  });
}
