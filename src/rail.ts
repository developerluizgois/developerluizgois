import { trackEvent } from './analytics';

// Native horizontal scroll + snap. Buttons and keys only move the scroll position; nothing autoplays.
export function initRail(): void {
  const rail = document.querySelector<HTMLElement>('[data-rail]');
  if (!rail) return;
  const track = rail.querySelector<HTMLElement>('.rail-track')!;
  const panels = [...track.querySelectorAll<HTMLElement>('.panel')];
  const prev = rail.querySelector<HTMLButtonElement>('[data-rail-prev]')!;
  const next = rail.querySelector<HTMLButtonElement>('[data-rail-next]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const step = () => panels.length > 1 ? panels[1]!.offsetLeft - panels[0]!.offsetLeft : track.clientWidth;
  const go = (direction: number) => track.scrollBy({ left: direction * step(), behavior: reduced.matches ? 'auto' : 'smooth' });

  let queued = false;
  function update(): void {
    queued = false;
    const max = track.scrollWidth - track.clientWidth;
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

  // Mouse drag: the track follows the pointer, then settles on a panel in the drag direction.
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || (event.target as Element).closest('a, button')) return;
    dragging = true;
    moved = false;
    startX = lastX = event.clientX;
    startLeft = track.scrollLeft;
    lastT = performance.now();
    velocity = 0;
  });
  window.addEventListener('pointermove', event => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    if (!moved && Math.abs(dx) < 4) return;
    if (!moved) { moved = true; track.classList.add('is-dragging'); }
    const now = performance.now();
    velocity = (event.clientX - lastX) / Math.max(1, now - lastT);
    lastX = event.clientX;
    lastT = now;
    track.scrollLeft = startLeft - dx;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    const pad = parseFloat(getComputedStyle(track).paddingLeft);
    const positions = panels.map(panel => panel.offsetLeft - pad);
    let index = positions.reduce((best, left, i) => Math.abs(left - track.scrollLeft) < Math.abs(positions[best]! - track.scrollLeft) ? i : best, 0);
    // A quick flick moves at least one panel in that direction.
    if (velocity < -.3 && positions[index]! <= track.scrollLeft) index += 1;
    if (velocity > .3 && positions[index]! >= track.scrollLeft) index -= 1;
    index = Math.max(0, Math.min(panels.length - 1, index));
    track.classList.remove('is-dragging');
    track.scrollTo({ left: positions[index], behavior: reduced.matches ? 'auto' : 'smooth' });
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  track.addEventListener('dragstart', event => event.preventDefault());

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
