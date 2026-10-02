export function parseTypeformUrl(value) {
  if (!value?.trim()) return null;
  const url = new URL(value);
  const match = url.pathname.match(/^\/to\/([a-zA-Z0-9]+)\/?$/);
  const validHost = url.hostname === 'typeform.com' || url.hostname.endsWith('.typeform.com');
  if (url.protocol !== 'https:' || !validHost || !match || url.username || url.password || url.port) {
    throw new Error('Use the public HTTPS Typeform /to/FORM_ID link.');
  }
  return { id: match[1], url: `${url.origin}/to/${match[1]}` };
}

export function createEmailDraft(email, values) {
  const subject = `Projeto: ${values.company.trim()}`;
  const body = `Olá, Luiz!\n\nMeu nome é ${values.firstname.trim()}.\nE-mail: ${values.email.trim()}\nEmpresa ou produto: ${values.company.trim()}\n\nMeu desafio:\n${values.message.trim()}\n\nConcordo com o uso destes dados para responder a esta solicitação.`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Only successful provider callbacks can produce a lead conversion.
// Never send response IDs, answers or personal information to analytics.
export function createTypeformCallbacks(formId, track, onReady) {
  let started = false;
  const submissions = new Set();
  return {
    ready: (payload) => { if (payload?.formId === formId) onReady(); },
    started: (payload) => {
      if (payload?.formId !== formId || started) return;
      started = true;
      track('contact_form_start', { form_provider: 'typeform' });
    },
    submitted: (payload) => {
      if (payload?.formId !== formId || !payload.responseId || submissions.has(payload.responseId)) return;
      submissions.add(payload.responseId);
      track('generate_lead', { form_provider: 'typeform' });
    },
  };
}
