// SMIL visuals run only while visible. Hidden process scenes and off-screen cards stay paused,
// and reduced motion freezes each one on a representative frame (data-still, in seconds).
const visible = new WeakMap<SVGSVGElement, boolean>();
let svgs: SVGSVGElement[] = [];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

function shouldRun(svg: SVGSVGElement): boolean {
  if (reduced.matches || !visible.get(svg)) return false;
  const stageScene = svg.closest('[data-stage-scenes] .step-visual');
  return !stageScene || stageScene.classList.contains('is-active');
}

export function syncMotion(): void {
  for (const svg of svgs) {
    if (shouldRun(svg)) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }
}

export function initMotion(): void {
  svgs = [...document.querySelectorAll<SVGSVGElement>('svg[data-motion]')];
  for (const svg of svgs) {
    svg.pauseAnimations();
    if (reduced.matches) svg.setCurrentTime(Number(svg.dataset.still ?? 2));
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) visible.set(entry.target as SVGSVGElement, entry.isIntersecting);
    syncMotion();
  }, { threshold: .1 });
  svgs.forEach(svg => observer.observe(svg));
  reduced.addEventListener('change', syncMotion);
}
