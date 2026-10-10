import { trackEvent } from './analytics';

// Market benchmarks from Luiz's table: the label is the funnel stage, the value is where a well-built product should be.
const companyMetrics = [
  { id: 'aquisicao', label: 'Aquisição', value: '↑ 7–10%', aux: 'dos visitantes deveriam criar uma conta no seu teste grátis. A média do mercado fica entre 2% e 5%.', chart: 1 },
  { id: 'ativacao', label: 'Ativação', value: '↑ 50–60%', aux: 'de quem se cadastra deveria chegar ao valor do produto. A média do mercado é 37,5%.', chart: 2 },
  { id: 'onboarding', label: 'Primeiros passos', value: '↑ 70–80%', aux: 'deveriam concluir um onboarding curto e guiado. Com checklist, a média é 19%.', chart: 0 },
  { id: 'primeiro-valor', label: 'Primeiro valor', value: '↓ minutos', aux: 'é o tempo que seu usuário deveria levar até o primeiro valor. A média é 1 dia e 12 horas.', chart: 5 },
  { id: 'boas-vindas', label: 'Boas-vindas', value: '↑ 50%+', aux: 'de abertura no e-mail de boas-vindas, com 10% a 20% de clique. A média é 20% e 2%.', chart: 4 },
  { id: 'conversao', label: 'Conversão', value: '↑ 20–25%', aux: 'dos testes sem cartão deveriam virar clientes pagantes. A média do mercado é 18%.', chart: 3 },
  { id: 'retencao', label: 'Retenção', value: '↑ 55–65%', aux: 'dos usuários deveriam continuar usando depois do primeiro mês. A média é 47%.', chart: 2 },
  { id: 'cancelamento', label: 'Cancelamento', value: '↓ < 2%', aux: 'é o máximo de clientes que deveria cancelar por mês. A média em empresas pequenas é de 3% a 7%.', chart: 5 },
  { id: 'receita', label: 'Receita recorrente', value: '↑ 110%+', aux: 'é quanto a receita dos clientes atuais deveria render em um ano. A mediana do mercado é 106%.', chart: 3 },
] as const;

// /mentoria shows AI productivity and market data from Luiz's research instead.
const mentorshipMetrics = [
  { id: 'programacao', label: 'Programação', value: '↓ 55,8%', aux: 'menos tempo numa tarefa isolada de programação com IA. Cerca de 2,2x mais rápido.', chart: 5 },
  { id: 'escrita', label: 'Escrita', value: '↓ 40%', aux: 'menos tempo em escrita profissional com IA, com qualidade 18% maior.', chart: 4 },
  { id: 'consultoria', label: 'Consultoria', value: '↑ 40%+', aux: 'de qualidade em consultoria e análise com IA, 25% mais rápido e com 12% mais tarefas.', chart: 0 },
  { id: 'atencao', label: 'Atenção', value: '↓ 19%', aux: 'mais lentos ficaram devs experientes em código maduro, embora achassem estar 20% mais rápidos.', chart: 5 },
  { id: 'destaque', label: 'Quem se destaca', value: '↑ 10h+', aux: 'economizadas por semana pelos 5% que mais usam IA. O usuário mediano economiza de 40 a 60 minutos por dia.', chart: 2 },
  { id: 'salario', label: 'Salário', value: '↑ 62%', aux: 'de prêmio salarial para quem domina IA em 2026, contra 57% no ano anterior.', chart: 3 },
  { id: 'vagas', label: 'Vagas', value: '↑ 69%', aux: 'de crescimento nas vagas que exigem IA, contra 9% do mercado total.', chart: 4 },
  { id: 'freelancer', label: 'Freelancer', value: '↑ 34%', aux: 'a mais por hora ganha o freelancer que usa IA.', chart: 0 },
  { id: 'generico', label: 'Trabalho genérico', value: '↓ 13%', aux: 'no pagamento por contrato de trabalho genérico com IA, mesmo com 90% mais volume.', chart: 5 },
  { id: 'fundador-solo', label: 'Fundador solo', value: '↑ 36,3%', aux: 'das startups em 2025 têm um fundador solo, contra 23,7% em 2019.', chart: 2 },
  { id: 'receita-pessoa', label: 'Receita por pessoa', value: '↑ 2x+', aux: 'de receita por funcionário em 55% das empresas nativas de IA, acima de US$ 400 mil.', chart: 3 },
] as const;
const INTERVAL = 4800;

// Rotating card of where a product should be at each stage. The same data is listed for screen readers, so the rotation is visual only.
export function initMetrics(): void {
  const root = document.querySelector<HTMLElement>('[data-metrics]');
  if (!root) return;
  const metrics = root.dataset.metrics === 'mentoria' ? mentorshipMetrics : companyMetrics;
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
    scenes.forEach((scene, i) => scene.classList.toggle('is-active', i === metric.chart));
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
