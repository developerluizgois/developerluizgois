import { readAttribution } from './attribution';
import { showSuccessNotification } from './celebration';
import type { LeadPayload } from '../shared/lead';
import { trackForm } from './analytics';

export type FormState = 'idle' | 'submitting' | 'success' | 'error';
const errorMessage = 'Não foi possível enviar sua solicitação. Seus dados foram mantidos. Tente novamente.';

// A small submission gate also makes duplicate-click behavior testable without a browser.
export function createSubmission(fetcher: typeof fetch = fetch) {
  let pending = false;
  return async (payload: LeadPayload, state: (next: FormState) => void): Promise<boolean> => {
    if (pending) return false;
    pending = true;
    state('submitting');
    trackForm('contact_form_submit');
    try {
      const response = await fetcher('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const result: unknown = await response.json();
      if (response.status !== 200 || !result || typeof result !== 'object' || !('success' in result) || result.success !== true) throw new Error('Submission failed');
      trackForm('generate_lead');
      trackForm('contact_form_success');
      state('success');
      return true;
    } catch {
      trackForm('contact_form_error');
      state('error');
      return false;
    } finally { pending = false; }
  };
}

export function initContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('#contact-form')!;
  const button = document.querySelector<HTMLButtonElement>('#submit-button')!;
  const status = document.querySelector<HTMLElement>('#form-status')!;
  const fieldset = form.querySelector<HTMLFieldSetElement>('fieldset')!;
  const submit = createSubmission();
  const attribution = readAttribution(window.location.href, document.referrer);
  let started = false;
  button.disabled = false;
  form.addEventListener('input', (event) => {
    if ((event.target as HTMLInputElement).name === 'websiteCheck') return;
    if (!started) { trackForm('contact_form_start'); started = true; }
  });
  function state(next: FormState): void {
    form.dataset.state = next;
    const submitting = next === 'submitting';
    button.disabled = submitting;
    fieldset.disabled = submitting;
    form.setAttribute('aria-busy', String(submitting));
    button.textContent = submitting ? 'Enviando sua mensagem…' : 'Solicitar análise inicial';
    status.dataset.state = next;
    status.textContent = next === 'success'
      ? 'Recebi sua mensagem. Vou analisar o contexto e entrar em contato com você.'
      : next === 'error' ? errorMessage : submitting ? 'Enviando sua solicitação…' : '';
    if (next === 'success' || next === 'error') status.focus({ preventScroll: true });
    if (next === 'success') { form.reset(); started = false; showSuccessNotification(); }
  }
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]), textarea').forEach(field => {
    const errorId = `error-${field.name}`;
    const clearError = () => { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); document.getElementById(errorId)?.remove(); };
    field.addEventListener('invalid', () => {
      clearError();
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', errorId);
      const message = document.createElement('span');
      message.id = errorId;
      message.className = 'field-error';
      message.textContent = field.validity.valueMissing ? (field.type === 'checkbox' ? 'Aceite o uso dos dados para continuar.' : 'Preencha este campo.') : field.validity.typeMismatch ? 'Informe um email válido.' : field.validity.tooShort ? `Use pelo menos ${field.minLength} caracteres.` : 'Confira o valor informado.';
      field.closest('label')!.append(message);
      status.textContent = 'Confira os campos destacados antes de enviar.';
    });
    field.addEventListener('input', clearError);
    form.addEventListener('reset', clearError);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.state === 'submitting' || !form.reportValidity()) return;
    const values = new FormData(form);
    const payload = {
      name: String(values.get('name') ?? '').trim(),
      email: String(values.get('email') ?? '').trim(),
      whatsapp: String(values.get('whatsapp') ?? '').trim(),
      companyOrProduct: String(values.get('companyOrProduct') ?? '').trim(),
      challenge: String(values.get('challenge') ?? '').trim(),
      consent: values.get('consent') === 'on',
      websiteCheck: String(values.get('websiteCheck') ?? ''),
      ...(values.get('challengeType') ? { challengeType: String(values.get('challengeType')) as LeadPayload['challengeType'] } : {}),
      ...(values.get('investmentRange') ? { investmentRange: String(values.get('investmentRange')) as LeadPayload['investmentRange'] } : {}),
      attribution,
    };
    if (payload.name.length < 2 || !payload.companyOrProduct || payload.challenge.length < 20 || !payload.consent) {
      status.dataset.state = 'error';
      status.textContent = 'Confira os campos. Descreva seu desafio com pelo menos 20 caracteres e aceite o uso dos dados.';
      status.focus({ preventScroll: true });
      return;
    }
    await submit({ ...payload, consent: true }, state);
  });
}
