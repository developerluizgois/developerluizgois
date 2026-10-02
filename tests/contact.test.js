import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailDraft, parseTypeformUrl, createTypeformCallbacks } from '../contact.js';

test('missing provider keeps email fallback; valid public URLs retain only form identity', () => {
  assert.equal(parseTypeformUrl(''), null);
  assert.deepEqual(parseTypeformUrl('https://example.typeform.com/to/Ab12?source=private#email=secret'), { id: 'Ab12', url: 'https://example.typeform.com/to/Ab12' });
});
test('untrusted URLs and malformed form links cannot become embeds', () => {
  for (const value of ['https://typeform.com.evil.test/to/Ab12', 'javascript:alert(1)', 'http://example.typeform.com/to/Ab12', 'https://typeform.com/admin', 'https://user:secret@typeform.com/to/Ab12', 'https://typeform.com:8080/to/Ab12']) {
    assert.throws(() => parseTypeformUrl(value));
  }
});
test('email draft safely encodes punctuation, accents and query-like input', () => {
  const url = new URL(createEmailDraft('luizgois.contact@gmail.com', { firstname: 'José', email: 'jose@example.com', company: 'A&B?bcc=attacker', message: 'Integração com cobrança & retenção.' }));
  assert.equal(url.searchParams.get('bcc'), null);
  assert.equal(url.searchParams.get('subject'), 'Projeto: A&B?bcc=attacker');
  assert.match(url.searchParams.get('body'), /José/);
  assert.match(url.searchParams.get('body'), /cobrança & retenção/);
});
test('only matching successful Typeform submissions count; duplicates and PII are excluded', () => {
  const events = [];
  let ready = 0;
  const callbacks = createTypeformCallbacks('Ab12', (...args) => events.push(args), () => ready++);
  callbacks.ready({ formId: 'wrong' });
  callbacks.ready({ formId: 'Ab12' });
  callbacks.started({ formId: 'Ab12' });
  callbacks.started({ formId: 'Ab12' });
  callbacks.submitted({ formId: 'wrong', responseId: 'r1' });
  callbacks.submitted({ formId: 'Ab12' });
  assert.equal(events.length, 1);
  callbacks.submitted({ formId: 'Ab12', responseId: 'r1', email: 'private@example.com' });
  callbacks.submitted({ formId: 'Ab12', responseId: 'r1' });
  assert.equal(ready, 1);
  assert.deepEqual(events, [['contact_form_start', { form_provider: 'typeform' }], ['generate_lead', { form_provider: 'typeform' }]]);
});
