import { trackEvent } from './analytics';

const metrics = [
  { label: 'Aquisição', value: '+10–30%', aux: 'mais usuários entrando no produto' },
  { label: 'Ativação', value: '+10–30%', aux: 'mais usuários chegando ao primeiro valor' },
  { label: 'Engajamento', value: '+10–30%', aux: 'mais uso das ações que movem o produto' },
  { label: 'Conversão', value: '+10–25%', aux: 'mais usuários virando receita' },
  { label: 'Retenção', value: '+10–30%', aux: 'mais usuários permanecendo ativos' },
  { label: 'Churn', value: '−10–30%', aux: 'menos clientes deixando o produto' },
] as const;
const INTERVAL = 4800;

// Rotating card in the hero. The same data is listed for screen readers, so the rotation is visual only.
export function initMetrics(): void {
  const root = document.querySelector<HTMLElement>('[data-metrics]');
  if (!root) return;
  const label = root.querySelector<HTMLElement>('[data-mc-label]')!;
  const value = root.querySelector<HTMLElement>('[data-mc-value]')!;
  const aux = root.querySelector<HTMLElement>('[data-mc-aux]')!;
  const scenes = [...root.querySelectorAll<SVGGElement>('[data-chart]')];
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-mc-tab]')];
  const pause = root.querySelector<HTMLButtonElement>('[data-mc-pause]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let current = 0;
  let timer = 0;
  let paused = reduced.matches;
  let hovering = false;

  function show(index: number): void {
    if (index === current) return;
    const metric = metrics[index]!;
    const previous = value.querySelector('span:not(.is-leaving)');
    const next = document.createElement('span');
    next.textContent = metric.value;
    if (reduced.matches || !previous) {
      value.replaceChildren(next);
    } else {
      next.className = 'is-entering';
      value.append(next);
      requestAnimationFrame(() => {
        previous.classList.add('is-leaving');
        next.classList.remove('is-entering');
      });
      window.setTimeout(() => previous.remove(), 550);
    }
    label.textContent = metric.label;
    aux.classList.add('is-swapping');
    window.setTimeout(() => { aux.textContent = metric.aux; aux.classList.remove('is-swapping'); }, reduced.matches ? 0 : 180);
    scenes.forEach((scene, i) => scene.classList.toggle('is-active', i === index));
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
    current = index;
  }

  function schedule(): void {
    window.clearTimeout(timer);
    if (paused || hovering || document.hidden) return;
    timer = window.setTimeout(() => { show((current + 1) % metrics.length); schedule(); }, INTERVAL);
  }

  function setPaused(next: boolean): void {
    paused = next;
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Retomar troca automática de indicadores' : 'Pausar troca automática de indicadores');
    schedule();
  }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => {
    show(i);
    trackEvent('hero_metric_select', { content_id: metrics[i]!.label.toLowerCase() });
    schedule();
  }));
  pause.addEventListener('click', () => setPaused(!paused));
  root.addEventListener('pointerenter', () => { hovering = true; schedule(); });
  root.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  root.addEventListener('focusin', () => { hovering = true; schedule(); });
  root.addEventListener('focusout', () => { hovering = false; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  setPaused(paused);
}
