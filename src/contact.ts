import { readAttribution } from './attribution';
import type { LeadPayload } from '../shared/lead';
import { trackForm } from './analytics';
import { setScrollLocked } from './scroll';

export type FormState = 'idle' | 'submitting' | 'success' | 'error';
const errorMessage = 'Não foi possível enviar sua solicitação. Seus dados foram mantidos. Tente novamente.';
const submitLabel = 'Enviar';

// A small submission gate also makes duplicate-click behavior testable without a browser.
export function createSubmission(fetcher: typeof fetch = fetch) {
  let pending = false;
  return async (payload: LeadPayload, state: (next: FormState) => void): Promise<boolean> => {
    if (pending) return false;
    pending = true;
    state('submitting');
    trackForm('form_submit');
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
      trackForm('form_submit_success');
      state('success');
      return true;
    } catch {
      trackForm('form_submit_error');
      state('error');
      return false;
    } finally { pending = false; }
  };
}

export function initContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('#contact-form')!;
  const button = document.querySelector<HTMLButtonElement>('#submit-button')!;
  const status = document.querySelector<HTMLElement>('#form-status')!;
  const success = document.querySelector<HTMLDialogElement>('#form-success')!;
  const fieldset = form.querySelector<HTMLFieldSetElement>('fieldset')!;
  const preferWhatsapp = form.querySelector<HTMLInputElement>('[name="preferWhatsapp"]')!;
  const whatsappField = document.querySelector<HTMLElement>('#whatsapp-field')!;
  const whatsapp = form.querySelector<HTMLInputElement>('[name="whatsapp"]')!;
  const submit = createSubmission();
  const attribution = readAttribution(window.location.href, document.referrer);
  let started = false;
  button.disabled = false;

  // Progressive disclosure: the phone field exists only for people who ask for WhatsApp.
  function syncWhatsapp(): void {
    const on = preferWhatsapp.checked;
    whatsappField.hidden = !on;
    whatsapp.disabled = !on;
    whatsapp.required = on;
    preferWhatsapp.setAttribute('aria-expanded', String(on));
    if (on) whatsapp.focus();
  }
  preferWhatsapp.addEventListener('change', syncWhatsapp);

  // The form stays in place, cleared, behind the confirmation modal.
  success.querySelector('[data-dialog-close]')!.addEventListener('click', () => success.close());
  success.addEventListener('click', event => { if (event.target === success) success.close(); });
  success.addEventListener('close', () => setScrollLocked(false));

  form.addEventListener('input', (event) => {
    if ((event.target as HTMLInputElement).name === 'websiteCheck') return;
    if (!started) { trackForm('form_start'); started = true; }
  });

  function state(next: FormState): void {
    form.dataset.state = next;
    const submitting = next === 'submitting';
    button.disabled = submitting;
    fieldset.disabled = submitting;
    form.setAttribute('aria-busy', String(submitting));
    button.textContent = submitting ? 'Enviando…' : submitLabel;
    status.dataset.state = next;
    status.textContent = next === 'error' ? errorMessage : submitting ? 'Enviando seu contexto…' : '';
    if (next === 'error') status.focus({ preventScroll: true });
    if (next === 'success') {
      const viaWhatsapp = preferWhatsapp.checked;
      success.querySelector('[data-success-copy]')!.textContent = `Vou ler seu contexto e responder por ${viaWhatsapp ? 'WhatsApp' : 'email'} em até 1 dia útil com o próximo passo.`;
      form.reset();
      syncWhatsapp();
      started = false;
      success.showModal();
      setScrollLocked(true);
    }
  }

  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:not([type="hidden"]):not([name="websiteCheck"]):not([name="preferWhatsapp"]), textarea, select').forEach(field => {
    const errorId = `error-${field.name}`;
    const helpId = field.name === 'challenge' ? 'challenge-help' : '';
    const clearError = () => {
      field.removeAttribute('aria-invalid');
      if (helpId) field.setAttribute('aria-describedby', helpId); else field.removeAttribute('aria-describedby');
      document.getElementById(errorId)?.remove();
    };
    field.addEventListener('invalid', () => {
      clearError();
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', [errorId, helpId].filter(Boolean).join(' '));
      const message = document.createElement('span');
      message.id = errorId;
      message.className = 'field-error';
      message.textContent = field.validity.valueMissing
        ? (field.type === 'checkbox' ? 'Aceite o uso dos dados para continuar.' : field instanceof HTMLSelectElement ? 'Escolha uma opção.' : 'Preencha este campo.')
        : field.validity.typeMismatch ? 'Informe um email válido.'
        : !(field instanceof HTMLSelectElement) && field.validity.tooShort ? `Use pelo menos ${field.minLength} caracteres.`
        : 'Confira o valor informado.';
      field.closest('label')!.append(message);
      status.dataset.state = 'error';
      status.textContent = 'Confira os campos destacados antes de enviar.';
    });
    field.addEventListener('input', clearError);
    field.addEventListener('change', clearError);
    form.addEventListener('reset', clearError);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.state === 'submitting') return;
    // novalidate keeps native bubbles away; checkValidity still fires the invalid handlers above.
    if (!form.checkValidity()) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const values = new FormData(form);
    const wantsWhatsapp = preferWhatsapp.checked;
    const payload: LeadPayload = {
      name: String(values.get('name') ?? '').trim(),
      email: String(values.get('email') ?? '').trim(),
      ...(wantsWhatsapp ? { whatsapp: String(values.get('whatsapp') ?? '').trim(), contactPreference: 'whatsapp' as const } : {}),
      companyOrProduct: String(values.get('companyOrProduct') ?? '').trim(),
      challengeType: String(values.get('challengeType') ?? '') as LeadPayload['challengeType'],
      investmentRange: String(values.get('investmentRange') ?? '') as LeadPayload['investmentRange'],
      challenge: String(values.get('challenge') ?? '').trim(),
      consent: true,
      websiteCheck: String(values.get('websiteCheck') ?? ''),
      attribution,
    };
    await submit(payload, state);
  });
}
