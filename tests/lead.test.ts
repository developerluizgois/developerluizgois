import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLead } from '../worker/validation';
import { saveLead, consentTimestamp } from '../worker/hubspot';
import worker from '../worker/index';
import { createSubmission } from '../src/contact';
import type { FormState } from '../src/contact';

const lead = { name: 'Maria Teste', email: 'maria@example.com', companyOrProduct: 'Produto teste', challenge: 'Quero melhorar a conversão do produto.', consent: true as const };
const config = { HUBSPOT_SERVICE_KEY: 'unit-test-only', HUBSPOT_PIPELINE_ID: 'default', HUBSPOT_STAGE_NEW_ID: 'appointmentscheduled' };
const receivedAt = new Date('2026-10-02T15:22:33.444Z');
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('server validation', () => {
  it('normalizes text and omits empty optional phone', () => {
    expect(validateLead({ ...lead, name: '  Maria   Teste ', email: ' MARIA@example.com ', whatsapp: '   ' })).toEqual(lead);
    expect(validateLead({ ...lead, whatsapp: '+55 (48) 99999-9999' }).whatsapp).toBe('+5548999999999');
  });
  it.each([
    { consent: false }, { consent: undefined }, { websiteCheck: 'spam' }, { email: 'invalid' },
    { whatsapp: 'abc' }, { name: ' ' }, { challenge: 'short' }, { companyOrProduct: 'x'.repeat(161) },
    { unexpected: 'field' }, { name: null },
  ])('rejects invalid payload %j', patch => { expect(() => validateLead({ ...lead, ...patch })).toThrow(); });
  it('accepts a WhatsApp reply preference only together with a valid number', () => {
    expect(validateLead({ ...lead, whatsapp: '+55 48 99999-9999', contactPreference: 'whatsapp' })).toMatchObject({ whatsapp: '+5548999999999', contactPreference: 'whatsapp' });
    expect(() => validateLead({ ...lead, contactPreference: 'whatsapp' })).toThrow();
    expect(() => validateLead({ ...lead, whatsapp: '+5548999999999', contactPreference: 'email' })).toThrow();
  });
});

describe('HubSpot mapping without external calls', () => {
  function fakeApi(existing: boolean) {
    return vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.includes('/properties/')) return Response.json({ type: 'datetime' });
      if (init?.method === 'GET') return existing ? Response.json({ id: '101' }) : new Response(null, { status: 404 });
      if (path.includes('/associations/default/')) return Response.json({ status: 'COMPLETE', results: [{ from: { id: '202' }, to: { id: '101' } }] });
      if (path.endsWith('/contacts') || path.endsWith('/contacts/101')) return Response.json({ id: '101' });
      if (path.endsWith('/deals')) return Response.json({ id: '202' });
      throw new Error('Unexpected endpoint');
    });
  }
  it.each([true, false])('updates/creates contact and creates a new associated deal (existing=%s)', async existing => {
    const api = fakeApi(existing);
    await saveLead(lead, config, receivedAt, api);
    const contactWrite = api.mock.calls.find(([url, init]) => String(url).includes('/contacts') && ['POST', 'PATCH'].includes(init?.method || ''))!;
    const props = JSON.parse(String(contactWrite[1]?.body)).properties;
    expect(contactWrite[1]?.method).toBe(existing ? 'PATCH' : 'POST');
    expect(props).toEqual({ firstname: lead.name, email: lead.email, consentimento_pelo_site: 'true', data_do_consentimento_pelo_site: receivedAt.toISOString() });
    expect(props).not.toHaveProperty('mobilephone');
    const dealWrite = api.mock.calls.find(([url]) => String(url).endsWith('/deals'))!;
    expect(JSON.parse(String(dealWrite[1]?.body)).properties).toEqual({ dealname: 'Site | Produto teste | Maria Teste', pipeline: 'default', dealstage: 'appointmentscheduled', empresa_ou_produto: lead.companyOrProduct, desafio_do_projeto: lead.challenge, origem_do_lead: 'Site' });
    expect(api.mock.calls.at(-1)?.[0]).toBe('https://api.hubapi.com/crm/v4/objects/deals/202/associations/default/contacts/101');
  });
  it('sends phone only when provided and formats the actual property type', async () => {
    const api = fakeApi(true);
    await saveLead({ ...lead, whatsapp: '+5548999999999' }, config, receivedAt, api);
    const patch = api.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(JSON.parse(String(patch[1]?.body)).properties.mobilephone).toBe('+5548999999999');
    expect(consentTimestamp('datetime', receivedAt)).toBe('2026-10-02T15:22:33.444Z');
    expect(consentTimestamp('date', receivedAt)).toBe('2026-10-02');
    expect(() => consentTimestamp('string', receivedAt)).toThrow();
  });
  it('records the WhatsApp reply preference on the deal', async () => {
    const api = fakeApi(false);
    await saveLead({ ...lead, whatsapp: '+5548999999999', contactPreference: 'whatsapp' }, config, receivedAt, api);
    const dealWrite = api.mock.calls.find(([url]) => String(url).endsWith('/deals'))!;
    expect(JSON.parse(String(dealWrite[1]?.body)).properties.desafio_do_projeto).toBe(`${lead.challenge}\n\nPreferência de resposta: WhatsApp`);
  });
  it('does not confirm success for provider errors or unfinished associations', async () => {
    await expect(saveLead(lead, config, receivedAt, vi.fn<typeof fetch>().mockResolvedValue(new Response('private provider detail', { status: 500 })))).rejects.toThrow('Lead processing unavailable');
    const api = fakeApi(true);
    const original = api.getMockImplementation()!;
    api.mockImplementation(async (url, init) => String(url).includes('/associations/default/') ? Response.json({ status: 'PENDING', results: [] }) : original(url, init));
    await expect(saveLead(lead, config, receivedAt, api)).rejects.toThrow();
  });
});

describe('public endpoint', () => {
  const env = { ...config, ASSETS: { fetch: vi.fn(async () => new Response('asset')) } };
  it.each([
    ['GET', {}, undefined, 405],
    ['POST', { 'Content-Type': 'text/plain' }, '{}', 415],
    ['POST', { 'Content-Type': 'application/json', Origin: 'https://elsewhere.test' }, '{}', 403],
    ['POST', { 'Content-Type': 'application/json' }, '{invalid', 400],
    ['POST', { 'Content-Type': 'application/json' }, 'x'.repeat(17000), 413],
  ] as const)('rejects unsupported/invalid requests without provider calls', async (method, headers, body, status) => {
    const api = vi.fn(); vi.stubGlobal('fetch', api);
    const response = await worker.fetch(new Request('https://site.test/api/lead', { method, headers, body }), env);
    expect(response.status).toBe(status);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });
  it('fails safely without secrets and never exposes internals', async () => {
    const response = await worker.fetch(new Request('https://site.test/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }), { ...env, HUBSPOT_SERVICE_KEY: '' });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, message: 'Não foi possível enviar sua solicitação. Tente novamente.' });
  });
});

describe('form submission and analytics', () => {
  it('prevents concurrent submissions and emits a conversion only after complete success', async () => {
    vi.stubGlobal('window', { dataLayer: [] });
    let resolve!: (value: Response) => void;
    const api = vi.fn<typeof fetch>(() => new Promise<Response>(done => { resolve = done; }));
    const submit = createSubmission(api);
    const states: FormState[] = [];
    const first = submit(lead, next => states.push(next));
    expect(await submit(lead, next => states.push(next))).toBe(false);
    expect(api).toHaveBeenCalledTimes(1);
    expect(window.dataLayer).not.toContainEqual({ event: 'generate_lead', form_provider: 'hubspot' });
    resolve(Response.json({ success: true }));
    expect(await first).toBe(true);
    expect(states).toEqual(['submitting', 'success']);
    expect(window.dataLayer).toEqual(['form_submit', 'contact_form_submit', 'form_submit_success', 'generate_lead', 'contact_form_success'].map(event => ({ event, form_provider: 'hubspot' })));
    expect(JSON.stringify(window.dataLayer)).not.toContain(lead.email);
  });
  it('does not generate a lead on error/202 and permits retry', async () => {
    vi.stubGlobal('window', { dataLayer: [] });
    const api = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true }, { status: 202 })).mockResolvedValueOnce(Response.json({ success: true }));
    const submit = createSubmission(api);
    expect(await submit(lead, () => {})).toBe(false);
    expect(window.dataLayer).not.toContainEqual({ event: 'generate_lead', form_provider: 'hubspot' });
    expect(await submit(lead, () => {})).toBe(true);
  });
});

describe('safe production diagnostics', () => {
  it.each([
    ['/properties/', 'consent_schema', 403],
    ['idProperty=email', 'contact_lookup', 401],
    ['/objects/contacts', 'contact_write', 400],
    ['/objects/deals', 'deal_create', 400],
    ['/associations/default/', 'association', 403],
  ])('identifies %s failures without leaking input/provider content', async (marker, step, upstreamStatus) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = vi.fn<typeof fetch>(async (url, init) => {
      const path = String(url);
      const fail = marker === '/objects/contacts' ? path.endsWith(marker) && init?.method === 'POST' : marker === '/objects/deals' ? path.endsWith(marker) : path.includes(marker);
      if (fail) return Response.json({ message: `private ${lead.email} ${config.HUBSPOT_SERVICE_KEY}` }, { status: upstreamStatus });
      if (path.includes('/properties/')) return Response.json({ type: 'datetime' });
      if (init?.method === 'GET') return new Response(null, { status: 404 });
      if (path.endsWith('/contacts')) return Response.json({ id: '101' });
      return Response.json({ id: '202' });
    });
    vi.stubGlobal('fetch', api);
    const response = await worker.fetch(new Request('https://site.test/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }), { ...config, ASSETS: { fetch: api } });
    expect(response.status).toBe(502);
    const diagnostic = JSON.parse(log.mock.calls[0]![0]);
    expect(diagnostic).toMatchObject({ event: 'lead_delivery_failed', step, reason: 'upstream_rejected', upstreamStatus });
    expect(response.headers.get('X-Request-Id')).toBe(diagnostic.reference);
    const output = JSON.stringify(log.mock.calls) + await response.text();
    for (const value of [lead.email, lead.name, lead.challenge, config.HUBSPOT_SERVICE_KEY, 'private']) expect(output).not.toContain(value);
  });
  it('completes the public request only after contact, deal and association succeed', async () => {
    const api = vi.fn<typeof fetch>(async (url, init) => {
      const path = String(url);
      if (path.includes('/properties/')) return Response.json({ type: 'datetime' });
      if (init?.method === 'GET') return new Response(null, { status: 404 });
      if (path.includes('/associations/')) return Response.json({ status: 'COMPLETE', results: [{ from: { id: '202' }, to: { id: '101' } }] });
      return Response.json({ id: path.endsWith('/contacts') ? '101' : '202' });
    });
    vi.stubGlobal('fetch', api);
    const response = await worker.fetch(new Request('https://site.test/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://site.test' }, body: JSON.stringify({ ...lead, whatsapp: '+5548000000000' }) }), { ...config, ASSETS: { fetch: api } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(api).toHaveBeenCalledTimes(5);
  });
});


describe('qualification and attribution', () => {
  it('accepts every budget without rejecting lower investments', () => {
    for (const investmentRange of ['Ainda preciso entender', 'Até R$ 10 mil', 'R$ 10 mil a R$ 25 mil', 'R$ 25 mil a R$ 50 mil', 'Acima de R$ 50 mil']) {
      expect(validateLead({ ...lead, investmentRange }).investmentRange).toBe(investmentRange);
    }
  });
  it.each([{ challengeType: 'untrusted' }, { investmentRange: 'custom' }, { attribution: { email: 'private' } }, { attribution: { utm_source: 'person@example.com' } }, { attribution: { referrer: 'https://example.com/private?email=x' } }])('rejects unsafe qualification %j', fields => {
    expect(() => validateLead({ ...lead, ...fields })).toThrow();
  });
  it('preserves qualified input in the existing CRM field without new properties', async () => {
    const qualified = validateLead({ ...lead, challengeType: 'Integrações e dados', investmentRange: 'Até R$ 10 mil', attribution: { utm_source: 'linkedin', referrer: 'https://example.com' } });
    const api = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).includes('/properties/')) return Response.json({ type: 'datetime' });
      if (init?.method === 'GET') return Response.json({ id: '101' });
      if (String(url).includes('/associations/')) return Response.json({ status: 'COMPLETE', results: [{ from: { id: '202' }, to: { id: '101' } }] });
      return Response.json({ id: String(url).endsWith('/deals') ? '202' : '101' });
    });
    await saveLead(qualified, config, receivedAt, api);
    const deal = JSON.parse(String(api.mock.calls.find(([url]) => String(url).endsWith('/deals'))![1]?.body)).properties;
    expect(deal.desafio_do_projeto).toContain('O que deseja melhorar: Integrações e dados');
    expect(deal.desafio_do_projeto).toContain('Faixa de investimento: Até R$ 10 mil');
    expect(deal.desafio_do_projeto).toContain('utm_source: linkedin');
    expect(Object.keys(deal)).toHaveLength(6);
  });
  it('analytics failure cannot turn a successful submission into an error', async () => {
    vi.stubGlobal('window', { dataLayer: { push() { throw new Error('Blocked'); } } });
    const states: FormState[] = [];
    expect(await createSubmission(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true })))(lead, next => states.push(next))).toBe(true);
    expect(states).toEqual(['submitting', 'success']);
  });
  it.each([() => Promise.reject(new DOMException('Timeout', 'TimeoutError')), () => Promise.resolve(new Response('invalid json'))])('reports failed transport without converting', async fetcher => {
    vi.stubGlobal('window', { dataLayer: [] });
    expect(await createSubmission(vi.fn<typeof fetch>(fetcher))(lead, () => {})).toBe(false);
    expect(window.dataLayer).toEqual(['form_submit', 'contact_form_submit', 'form_submit_error', 'contact_form_error'].map(event => ({ event, form_provider: 'hubspot' })));
  });
});
