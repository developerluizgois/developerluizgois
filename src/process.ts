import { trackEvent } from './analytics';
import { syncMotion } from './motion';

// Desktop: scenes move into one sticky stage and follow the step in the reading band.
// Mobile and no-JS: each step keeps its own scene inline, in the same order.
export function initProcess(): void {
  const layout = document.querySelector<HTMLElement>('[data-process]');
  if (!layout) return;
  const stage = layout.querySelector<HTMLElement>('[data-stage-scenes]')!;
  const steps = [...layout.querySelectorAll<HTMLElement>('.step')];
  const scenes = steps.map(step => step.querySelector<HTMLElement>('.step-visual')!);
  const indicators = [...layout.querySelectorAll<HTMLElement>('[data-stage-index]')];
  const desktop = window.matchMedia('(min-width: 1024px)');
  const seen = new Set<string>();

  function activate(index: number): void {
    steps.forEach((step, i) => step.classList.toggle('is-current', i === index));
    scenes.forEach((scene, i) => scene.classList.toggle('is-active', i === index));
    indicators.forEach((indicator, i) => indicator.classList.toggle('is-current', i === index));
    syncMotion();
  }

  function record(step: HTMLElement): void {
    const id = step.dataset.step!;
    if (seen.has(id)) return;
    seen.add(id);
    trackEvent('process_step_view', { content_id: `step_${id}` });
  }

  function arrange(): void {
    if (desktop.matches) {
      scenes.forEach(scene => stage.append(scene));
      layout!.classList.add('is-enhanced');
    } else {
      layout!.classList.remove('is-enhanced');
      scenes.forEach((scene, i) => steps[i]!.prepend(scene));
    }
    syncMotion();
  }

  // Active band: the middle of the viewport.
  const bandObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const step = entry.target as HTMLElement;
      activate(steps.indexOf(step));
      record(step);
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(step => bandObserver.observe(step));

  // Inline scenes play once they are on screen.
  const sceneObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) entry.target.classList.add('is-in');
    }
  }, { threshold: .4 });
  scenes.forEach(scene => sceneObserver.observe(scene));

  arrange();
  activate(0);
  desktop.addEventListener('change', arrange);
}
