export function initResultCounts(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const frames = new Map<HTMLElement, number>();
  const finish = (element: HTMLElement) => {
    cancelAnimationFrame(frames.get(element) ?? 0);
    frames.delete(element);
    element.textContent = element.dataset.count!.replace('.', ',');
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target as HTMLElement;
      observer.unobserve(element);
      if (reduced.matches) continue;
      const target = Number(element.dataset.count);
      const digits = element.dataset.count!.includes('.') ? 1 : 0;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 850, 1);
        element.textContent = (target * (1 - (1 - progress) ** 3)).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
        if (progress < 1) frames.set(element, requestAnimationFrame(tick));
        else finish(element);
      };
      frames.set(element, requestAnimationFrame(tick));
    }
  }, { threshold: .5 });
  document.querySelectorAll<HTMLElement>('[data-count]').forEach(element => observer.observe(element));
  reduced.addEventListener('change', () => { if (reduced.matches) frames.forEach((_, element) => finish(element)); });
}
