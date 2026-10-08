import { trackEvent } from './analytics';

const metrics = [
  { id: 'receita', label: 'Receita', value: '+30%', aux: 'no faturamento, com priorização e recuperação de leads' },
  { id: 'conversao', label: 'Conversão', value: '<1% → 3%', aux: 'dos novos usuários ativando, com signup e onboarding redesenhados' },
  { id: 'engajamento', label: 'Engajamento', value: '+53%', aux: 'no uso das funcionalidades principais do produto' },
  { id: 'relacionamento', label: 'Relacionamento', value: '+8%', aux: 'em compras concluídas, com email e WhatsApp automatizados' },
  { id: 'ia', label: 'Inteligência artificial', value: '+3 mil', aux: 'análises feitas por agentes de IA, sem trabalho manual' },
  { id: 'abandono', label: 'Abandono', value: '−12%', aux: 'de desistências no checkout' },
] as const;
const INTERVAL = 4800;

// Rotating card of results the work can reach, kept generic so no client is named. The same data is listed for screen readers, so the rotation is visual only.
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
    pause.setAttribute('aria-label', paused ? 'Retomar troca automática de resultados' : 'Pausar troca automática de resultados');
    schedule();
  }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => {
    show(i);
    trackEvent('hero_metric_select', { content_id: metrics[i]!.id });
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
