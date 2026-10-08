import { trackEvent } from './analytics';

// Native horizontal scroll + snap. Buttons and keys only move the scroll position; nothing autoplays.
export function initRail(): void {
  const rail = document.querySelector<HTMLElement>('[data-rail]');
  if (!rail) return;
  const track = rail.querySelector<HTMLElement>('.rail-track')!;
  const panels = [...track.querySelectorAll<HTMLElement>('.panel')];
  const prev = rail.querySelector<HTMLButtonElement>('[data-rail-prev]')!;
  const next = rail.querySelector<HTMLButtonElement>('[data-rail-next]')!;
  const counter = rail.querySelector<HTMLElement>('[data-rail-current]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const step = () => panels.length > 1 ? panels[1]!.offsetLeft - panels[0]!.offsetLeft : track.clientWidth;
  const go = (direction: number) => track.scrollBy({ left: direction * step(), behavior: reduced.matches ? 'auto' : 'smooth' });

  let queued = false;
  function update(): void {
    queued = false;
    const max = track.scrollWidth - track.clientWidth;
    const index = Math.min(panels.length - 1, Math.round(track.scrollLeft / step()));
    counter.textContent = String(index + 1).padStart(2, '0');
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  track.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => go(1),
      ArrowLeft: () => go(-1),
      Home: () => track.scrollTo({ left: 0, behavior: reduced.matches ? 'auto' : 'smooth' }),
      End: () => track.scrollTo({ left: track.scrollWidth, behavior: reduced.matches ? 'auto' : 'smooth' }),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });
  update();

  // Visuals start when a panel is mostly visible; the view event is sent once per panel.
  const seen = new Set<string>();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const panel = entry.target as HTMLElement;
      panel.classList.add('is-in');
      const id = panel.dataset.capability!;
      if (!seen.has(id)) { seen.add(id); trackEvent('capability_view', { content_id: id }); }
      observer.unobserve(panel);
    }
  }, { threshold: .55 });
  panels.forEach(panel => observer.observe(panel));
}
