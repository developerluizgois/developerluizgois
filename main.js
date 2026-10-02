import { contactConfig } from './config.js';
import { parseTypeformUrl, createEmailDraft, createTypeformCallbacks } from './contact.js';

function track(event, details = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...details });
}

document.querySelectorAll('[data-cta]').forEach((link) => {
  link.addEventListener('click', () => track('contact_click', { placement: link.dataset.cta }));
});

document.querySelectorAll('a[href="#privacidade"]').forEach((link) => {
  link.addEventListener('click', () => { document.querySelector('#privacidade').open = true; });
});

const form = document.querySelector('#contact-form');
const submit = document.querySelector('#submit-button');
const status = document.querySelector('#form-status');
const helper = document.querySelector('#form-helper');
const container = document.querySelector('#typeform-container');
const notice = document.querySelector('#typeform-notice');

// This fallback does not submit data, call a backend or claim a saved lead.
submit.textContent = 'Preparar mensagem por e-mail';
submit.disabled = false;
helper.textContent = 'Abre uma mensagem no seu aplicativo de e-mail. Revise e confirme o envio por lá.';
let emailStarted = false;
form.addEventListener('input', () => {
  if (!emailStarted) { track('contact_form_start', { form_provider: 'email' }); emailStarted = true; }
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  if (values.website_check) return;
  for (const [name, min] of [['firstname', 2], ['company', 1], ['message', 20]]) {
    if (values[name].trim().length < min) {
      status.dataset.state = 'error';
      status.textContent = 'Preencha nome, empresa e uma descrição do desafio com pelo menos 20 caracteres.';
      form.elements[name].focus();
      return;
    }
  }
  status.dataset.state = 'draft';
  status.textContent = 'Mensagem preparada. Confirme o envio no seu aplicativo de e-mail. Se ele não abrir, escreva diretamente para luizgois.contact@gmail.com. Seus dados continuam neste formulário.';
  track('contact_email_draft', { form_provider: 'email' });
  window.location.href = createEmailDraft(contactConfig.email, values);
});

let typeform;
try { typeform = parseTypeformUrl(contactConfig.typeformUrl); }
catch { console.warn('Invalid Typeform configuration; email contact remains available.'); }

if (typeform) {
  form.hidden = true;
  container.hidden = false;
  notice.hidden = false;
  notice.textContent = 'Carregando formulário…';
  const directLink = document.createElement('a');
  directLink.href = typeform.url;
  directLink.target = '_blank';
  directLink.rel = 'noopener noreferrer';
  directLink.className = 'text-link typeform-direct';
  directLink.textContent = 'Abrir formulário em outra aba';
  notice.after(directLink);
  let ready = false;
  const timeout = window.setTimeout(showFallback, 15000);
  function showFallback() {
    if (ready) return;
    container.hidden = true;
    form.hidden = false;
    notice.textContent = 'O formulário não carregou. Você pode abri-lo em outra aba ou preparar uma mensagem por e-mail abaixo.';
  }
  const callbacks = createTypeformCallbacks(typeform.id, track, () => {
    ready = true;
    clearTimeout(timeout);
    container.hidden = false;
    // Preserve any email draft already entered after a slow provider load.
    if (!emailStarted) form.hidden = true;
    notice.textContent = 'Suas respostas serão enviadas pelo Typeform.';
    const frame = container.querySelector('iframe');
    if (frame) frame.title = 'Conte sobre seu projeto para Luiz Gois';
  });
  window.lgTypeformReady = callbacks.ready;
  window.lgTypeformStarted = callbacks.started;
  window.lgTypeformSubmitted = callbacks.submitted;
  container.dataset.tfWidget = typeform.id;
  container.dataset.tfOpacity = '0';
  container.dataset.tfHideHeaders = '';
  container.dataset.tfInlineOnMobile = '';
  container.dataset.tfOnReady = 'lgTypeformReady';
  container.dataset.tfOnStarted = 'lgTypeformStarted';
  container.dataset.tfOnSubmit = 'lgTypeformSubmitted';
  const script = document.createElement('script');
  script.src = 'https://embed.typeform.com/next/embed.js';
  script.async = true;
  script.onerror = () => { clearTimeout(timeout); showFallback(); };
  document.body.append(script);
}
