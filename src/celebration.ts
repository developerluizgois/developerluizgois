const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function showSuccessNotification(): void {
  document.querySelector('.success-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'success-toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = '<span class="toast-check" aria-hidden="true">✓</span><div><strong>Solicitação recebida!</strong><p>Vamos entrar em contato assim que possível.</p></div><button type="button" aria-label="Fechar notificação">×</button>';
  document.body.append(toast);
  const timer = window.setTimeout(() => toast.remove(), 12_000);
  toast.querySelector('button')!.addEventListener('click', () => { clearTimeout(timer); toast.remove(); });
  document.querySelector('.confetti')?.remove();
  if (reducedMotion()) return;
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  confetti.setAttribute('aria-hidden', 'true');
  const colors = ['#648bc9', '#c2d3f5', '#a78668', '#f3f4f5'];
  for (let i = 0; i < 65; i++) {
    const piece = document.createElement('i');
    piece.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--drift:${Math.random() * 240 - 120}px;animation-delay:${Math.random() * .8}s;animation-duration:${2.5 + Math.random() * 1.5}s;`;
    confetti.append(piece);
  }
  document.body.append(confetti);
  window.setTimeout(() => confetti.remove(), 5000);
}
