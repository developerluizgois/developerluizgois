const examples = [
  { value: 28.8, prefix: '+', title: 'Experiências que engajam', description: 'de engajamento de usuários ativos', context: 'com melhorias na navegação.', category: 'Experiência do produto' },
  { value: 68, prefix: '', title: 'Atendimento que responde', description: 'menos tempo de resposta no WhatsApp', context: 'com um agente de IA de atendimento.', category: 'IA no atendimento' },
  { value: 18.6, prefix: '+', title: 'Jornadas que convertem', description: 'de conversão de novos clientes', context: 'com uma jornada de cadastro mais simples.', category: 'Conversão e ativação' },
  { value: 42, prefix: '', title: 'Operações com mais fluidez', description: 'menos tempo em tarefas manuais', context: 'com integrações e automações de processos.', category: 'Automação de processos' },
  { value: 16.4, prefix: '+', title: 'Produtos que fazem voltar', description: 'de retenção de clientes', context: 'com recomendações personalizadas por IA.', category: 'Personalização e retenção' },
];

export function initHeroMetrics(): void {
  const card = document.querySelector<HTMLElement>('.impact-example')!;
  const content = card.querySelector<HTMLElement>('.metric-content')!;
  const number = card.querySelector<HTMLElement>('[data-metric-value]')!;
  const metric = card.querySelector<HTMLElement>('.hero-metric')!;
  const title = card.querySelector<HTMLElement>('[data-metric-title]')!;
  const description = card.querySelector<HTMLElement>('[data-metric-description]')!;
  const category = card.querySelector<HTMLElement>('[data-metric-category]')!;
  const indexLabel = card.querySelector<HTMLElement>('[data-metric-index]')!;
  const toggle = card.querySelector<HTMLButtonElement>('.metric-toggle')!;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let paused = reducedMotion.matches;
  let frame = 0;
  let transition = 0;
  let visible = false;

  function render(): void {
    const example = examples[index]!;
    const decimals = Number.isInteger(example.value) ? 0 : 1;
    const format = (value: number) => example.prefix + value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    title.textContent = example.title;
    description.replaceChildren(example.description, document.createElement('br'), example.context);
    category.textContent = example.category;
    indexLabel.textContent = `0${index + 1} / 05`;
    metric.setAttribute('aria-label', `${example.prefix === '+' ? 'Mais ' : ''}${format(example.value).replace('+', '')} por cento`);
    cancelAnimationFrame(frame);
    number.textContent = format(example.value);
    if (reducedMotion.matches) return;
    const start = performance.now();
    const count = (now: number) => {
      const progress = Math.min((now - start) / 650, 1);
      number.textContent = format(example.value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(count);
    };
    frame = requestAnimationFrame(count);
  }
  function updateToggle(): void {
    toggle.textContent = paused ? 'Reproduzir' : 'Pausar';
    toggle.setAttribute('aria-label', paused ? 'Reproduzir exemplos' : 'Pausar exemplos');
  }
  toggle.addEventListener('click', () => { paused = !paused; updateToggle(); });
  reducedMotion.addEventListener('change', () => {
    paused = reducedMotion.matches;
    clearTimeout(transition);
    content.classList.remove('is-changing');
    render();
    updateToggle();
  });
  new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; }, { threshold: 0.2 }).observe(card);
  window.setInterval(() => {
    if (paused || !visible || document.hidden || card.matches(':hover, :focus-within')) return;
    content.classList.add('is-changing');
    transition = window.setTimeout(() => {
      index = (index + 1) % examples.length;
      render();
      content.classList.remove('is-changing');
    }, reducedMotion.matches ? 0 : 180);
  }, 5500);
  updateToggle();
  render();
}
