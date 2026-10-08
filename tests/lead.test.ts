import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLead } from '../worker/validation';
import { readFileSync } from 'node:fs';
import { createLeadPage, richText, NOTION_VERSION } from '../worker/notion';
import { assessLead } from '../worker/assessment';
import { finalScore, provisionalScore, tierFor } from '../worker/scoring';
import worker, { enrichLead } from '../worker/index';
import { challengeTypes, investmentRanges } from '../shared/lead';
import { createSubmission } from '../src/contact';
import type { FormState } from '../src/contact';

const lead = { name: 'Maria Teste', email: 'maria@example.com', companyOrProduct: 'Produto teste', challenge: 'Quero melhorar a conversão do produto.', consent: true as const };
const config = { NOTION_TOKEN: 'unit-test-only', NOTION_DATA_SOURCE_ID: 'source-1', NOTION_OWNER_ID: 'owner-1' };
const env = { ...config, ASSETS: { fetch: async () => new Response('asset') } };
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

// Fake Notion + Anthropic APIs: records every call, never leaves the process.
function fakeApis(options: { notion?: number; anthropic?: number; assessment?: Record<string, unknown> } = {}) {
  const assessment = options.assessment ?? { fit: 26, urgency: 17, clarity: 12, reason: 'SaaS com churn subindo e dados.', first_question: 'Qual é o churn mensal hoje?' };
  return vi.fn<typeof fetch>(async input => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('https://api.notion.com/')) {
      if (options.notion && options.notion !== 200) return Response.json({ message: `private ${lead.email}` }, { status: options.notion });
      return Response.json({ object: 'page', id: 'page-1' });
    }
    if (url.startsWith('https://api.anthropic.com/')) {
      if (options.anthropic && options.anthropic !== 200) return Response.json({ type: 'error', error: { type: 'api_error', message: 'private' } }, { status: options.anthropic });
      return Response.json({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text: JSON.stringify(assessment) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
    }
    throw new Error(`Unexpected endpoint ${url}`);
  });
}
const notionBodies = (api: ReturnType<typeof fakeApis>) => api.mock.calls
  .filter(([input]) => String(input instanceof Request ? input.url : input).startsWith('https://api.notion.com/'))
  .map(([input, init]) => ({ url: String(input), method: init?.method, body: JSON.parse(String(init?.body)) }));

describe('lead scoring', () => {
  it('weights the visitor budget and the rule signals into a provisional score', () => {
    const strong = { ...lead, email: 'ana@acme.com', companyOrProduct: 'acme.com', challengeType: 'Retenção e churn' as const, investmentRange: 'Acima de R$ 50 mil' as const, challenge: 'x'.repeat(320) };
    const weak = { ...lead, email: 'ana@gmail.com', investmentRange: 'Até R$ 10 mil' as const };
    expect(provisionalScore(strong)).toBe(35 + 25 + 10 + 11);
    expect(tierFor(provisionalScore(strong))).toBe('A');
    expect(provisionalScore(weak)).toBe(8 + 5 + 10 + 5);
    expect(tierFor(provisionalScore(weak))).toBe('C');
  });
  it('clamps model scores so a bad answer cannot exceed each weight', () => {
    const qualified = { ...lead, investmentRange: 'R$ 25 mil a R$ 50 mil' as const };
    expect(finalScore(qualified, { fit: 99, urgency: 99, clarity: 99, reason: '', firstQuestion: '' })).toBe(32 + 30 + 20 + 15);
    expect(finalScore(qualified, { fit: -5, urgency: Number.NaN, clarity: 3, reason: '', firstQuestion: '' })).toBe(32 + 0 + 0 + 3);
    expect([tierFor(70), tierFor(69), tierFor(45), tierFor(44)]).toEqual(['A', 'B', 'B', 'C']);
  });
});

describe('Notion records without external calls', () => {
  it('creates the lead with every field, owner and provisional class', async () => {
    const api = fakeApis();
    const qualified = validateLead({ ...lead, whatsapp: '+55 48 99999-9999', contactPreference: 'whatsapp', challengeType: 'Integrações e dados', investmentRange: 'Até R$ 10 mil', attribution: { utm_source: 'linkedin' } });
    expect(await createLeadPage(qualified, 72, config, receivedAt, api)).toBe('page-1');
    const [call] = notionBodies(api);
    expect(call!.url).toBe('https://api.notion.com/v1/pages');
    expect(api.mock.calls[0]![1]?.headers).toMatchObject({ 'Notion-Version': NOTION_VERSION, Authorization: 'Bearer unit-test-only' });
    expect(call!.body.parent).toEqual({ type: 'data_source_id', data_source_id: 'source-1' });
    const props = call!.body.properties;
    expect(props).toMatchObject({
      Nome: { title: [{ type: 'text', text: { content: lead.name } }] },
      Classe: { select: { name: 'A' } }, Nota: { number: 72 }, Status: { status: { name: 'Novo' } },
      Responsável: { people: [{ object: 'user', id: 'owner-1' }] },
      Email: { email: lead.email }, WhatsApp: { phone_number: '+5548999999999' }, 'Responder por': { select: { name: 'WhatsApp' } },
      'Tipo de desafio': { select: { name: 'Integrações e dados' } }, Investimento: { select: { name: 'Até R$ 10 mil' } },
      Análise: { select: { name: 'Pendente' } }, Origem: { rich_text: [{ type: 'text', text: { content: 'utm_source: linkedin' } }] },
      Consentimento: { checkbox: true }, 'Recebido em': { date: { start: receivedAt.toISOString() } },
    });
    expect(call!.body.children[0].paragraph.rich_text[0]).toEqual({ type: 'mention', mention: { type: 'user', user: { object: 'user', id: 'owner-1' } } });
  });
  it('splits long descriptions into 2,000-character pieces without cutting text', () => {
    const parts = richText('a'.repeat(4500));
    expect(parts.map(part => part.text.content.length)).toEqual([2000, 2000, 500]);
  });
  it('omits optional fields and the mention when they are absent', async () => {
    const api = fakeApis();
    await createLeadPage(lead, 30, { ...config, NOTION_OWNER_ID: '' }, receivedAt, api);
    const { body } = notionBodies(api)[0]!;
    expect(body.properties).not.toHaveProperty('WhatsApp');
    expect(body.properties).not.toHaveProperty('Origem');
    expect(body.properties.Responsável).toEqual({ people: [] });
    expect(body).not.toHaveProperty('children');
  });
  it('rejects without configuration and maps provider errors', async () => {
    await expect(createLeadPage(lead, 50, { ...config, NOTION_TOKEN: '' }, receivedAt, fakeApis())).rejects.toMatchObject({ status: 503, step: 'configuration' });
    await expect(createLeadPage(lead, 50, config, receivedAt, fakeApis({ notion: 400 }))).rejects.toMatchObject({ status: 502, step: 'page_create', upstreamStatus: 400 });
    await expect(createLeadPage(lead, 50, config, receivedAt, fakeApis({ notion: 429 }))).rejects.toMatchObject({ status: 503 });
  });
});

describe('AI assessment', () => {
  it('sends only the business context to the model and returns capped text', async () => {
    const api = fakeApis({ assessment: { fit: 20, urgency: 10, clarity: 9, reason: 'r'.repeat(500), first_question: 'Qual é o churn?' } });
    const result = await assessLead({ ...lead, whatsapp: '+5548999999999', challengeType: 'Retenção e churn' }, 'unit-test-key', api);
    expect(result).toMatchObject({ fit: 20, urgency: 10, clarity: 9, firstQuestion: 'Qual é o churn?' });
    expect(result.reason).toHaveLength(300);
    const request = api.mock.calls.find(([input]) => String(input instanceof Request ? input.url : input).startsWith('https://api.anthropic.com/'))!;
    const body = JSON.parse(String(request[1]?.body));
    expect(body.model).toBe('claude-haiku-5-5');
    const sent = JSON.stringify(body.messages);
    expect(sent).toContain('example.com');
    expect(sent).toContain(lead.challenge);
    for (const value of [lead.name, lead.email, '+5548999999999']) expect(sent).not.toContain(value);
  });
  it('fails without a key instead of calling the API', async () => {
    const api = fakeApis();
    await expect(assessLead(lead, undefined, api)).rejects.toThrow();
    expect(api).not.toHaveBeenCalled();
  });
  it('records the final score, or marks the lead when the model is unavailable', async () => {
    const ok = fakeApis();
    await enrichLead({ ...lead, investmentRange: 'R$ 25 mil a R$ 50 mil' }, 'page-1', { ...env, ANTHROPIC_API_KEY: 'unit-test-key' }, ok);
    const update = notionBodies(ok).at(-1)!;
    expect(update).toMatchObject({ url: 'https://api.notion.com/v1/pages/page-1', method: 'PATCH' });
    expect(update.body.properties).toMatchObject({ Nota: { number: 32 + 26 + 17 + 12 }, Classe: { select: { name: 'A' } }, Análise: { select: { name: 'Com IA' } }, 'Primeira pergunta': { rich_text: [{ type: 'text', text: { content: 'Qual é o churn mensal hoje?' } }] } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = fakeApis({ anthropic: 400 });
    await enrichLead(lead, 'page-1', { ...env, ANTHROPIC_API_KEY: 'unit-test-key' }, down);
    expect(notionBodies(down).at(-1)!.body.properties).toEqual({ Análise: { select: { name: 'Sem IA' } } });
    const output = JSON.stringify(log.mock.calls);
    for (const value of [lead.email, lead.name, lead.challenge, 'private']) expect(output).not.toContain(value);
  });
});

describe('public endpoint', () => {
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await worker.fetch(new Request('https://site.test/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }), { ...env, NOTION_TOKEN: '' });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, message: 'Não foi possível enviar sua solicitação. Tente novamente.' });
  });
  it('confirms once the lead is saved and leaves the AI step to waitUntil', async () => {
    const api = fakeApis();
    vi.stubGlobal('fetch', api);
    const pending: Promise<unknown>[] = [];
    const response = await worker.fetch(new Request('https://site.test/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://site.test' }, body: JSON.stringify(lead) }), { ...env, ANTHROPIC_API_KEY: 'unit-test-key' }, { waitUntil: promise => { pending.push(promise); } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(notionBodies(api).map(call => call.method)).toEqual(['POST', 'PATCH']);
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
    expect(window.dataLayer).not.toContainEqual({ event: 'generate_lead', form_provider: 'notion' });
    resolve(Response.json({ success: true }));
    expect(await first).toBe(true);
    expect(states).toEqual(['submitting', 'success']);
    expect(window.dataLayer).toEqual(['form_submit', 'contact_form_submit', 'form_submit_success', 'generate_lead', 'contact_form_success'].map(event => ({ event, form_provider: 'notion' })));
    expect(JSON.stringify(window.dataLayer)).not.toContain(lead.email);
  });
  it('does not generate a lead on error/202 and permits retry', async () => {
    vi.stubGlobal('window', { dataLayer: [] });
    const api = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true }, { status: 202 })).mockResolvedValueOnce(Response.json({ success: true }));
    const submit = createSubmission(api);
    expect(await submit(lead, () => {})).toBe(false);
    expect(window.dataLayer).not.toContainEqual({ event: 'generate_lead', form_provider: 'notion' });
    expect(await submit(lead, () => {})).toBe(true);
  });
});

describe('safe production diagnostics', () => {
  it.each([400, 401, 403, 500])('logs Notion failure %s without leaking input/provider content', async upstreamStatus => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', fakeApis({ notion: upstreamStatus }));
    const response = await worker.fetch(new Request('https://site.test/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }), env);
    expect(response.status).toBe(502);
    const diagnostic = JSON.parse(log.mock.calls[0]![0]);
    expect(diagnostic).toMatchObject({ event: 'lead_delivery_failed', step: 'page_create', reason: 'upstream_rejected', upstreamStatus });
    expect(response.headers.get('X-Request-Id')).toBe(diagnostic.reference);
    const output = JSON.stringify(log.mock.calls) + await response.text();
    for (const value of [lead.email, lead.name, lead.challenge, config.NOTION_TOKEN, 'private']) expect(output).not.toContain(value);
  });
});

describe('form options', () => {
  it('offers exactly the challenge types and budgets the server accepts', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const optionsOf = (name: string) => [...html.match(new RegExp(`<select name="${name}"[\\s\\S]*?</select>`))![0].matchAll(/<option>([^<]+)<\/option>/g)].map(match => match[1]);
    expect(optionsOf('challengeType')).toEqual([...challengeTypes]);
    expect(optionsOf('investmentRange')).toEqual([...investmentRanges]);
    for (const [, type] of html.matchAll(/data-challenge-type="([^"]+)"/g)) expect(challengeTypes).toContain(type);
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
  it('analytics failure cannot turn a successful submission into an error', async () => {
    vi.stubGlobal('window', { dataLayer: { push() { throw new Error('Blocked'); } } });
    const states: FormState[] = [];
    expect(await createSubmission(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true })))(lead, next => states.push(next))).toBe(true);
    expect(states).toEqual(['submitting', 'success']);
  });
  it.each([() => Promise.reject(new DOMException('Timeout', 'TimeoutError')), () => Promise.resolve(new Response('invalid json'))])('reports failed transport without converting', async fetcher => {
    vi.stubGlobal('window', { dataLayer: [] });
    expect(await createSubmission(vi.fn<typeof fetch>(fetcher))(lead, () => {})).toBe(false);
    expect(window.dataLayer).toEqual(['form_submit', 'contact_form_submit', 'form_submit_error', 'contact_form_error'].map(event => ({ event, form_provider: 'notion' })));
  });
});
