import { mentorshipType, type LeadPayload } from '../shared/lead';
import { tierFor, type Assessment } from './scoring.ts';

export const NOTION_VERSION = '2026-03-11';

export interface NotionConfig {
  NOTION_TOKEN?: string;
  NOTION_DATA_SOURCE_ID?: string;
  // Mentoring requests from /mentoria go to their own table ("Contatos da mentoria").
  NOTION_MENTORSHIP_DATA_SOURCE_ID?: string;
  NOTION_OWNER_ID?: string;
}

type NotionStep = 'configuration' | 'page_create' | 'page_update';
type FailureReason = 'configuration_missing' | 'upstream_rejected' | 'invalid_response' | 'timeout' | 'network_error';
// Plain fields (no parameter properties) so Node can run this file directly in the setup scripts.
export class NotionError extends Error {
  step?: NotionStep;
  readonly status: number;
  readonly reason: FailureReason;
  readonly upstreamStatus?: number;
  constructor(status: number, reason: FailureReason = 'invalid_response', upstreamStatus?: number) {
    super('Lead processing unavailable');
    this.status = status;
    this.reason = reason;
    this.upstreamStatus = upstreamStatus;
  }
}

// Notion caps each text object at 2,000 characters; long descriptions are split, never cut.
export function richText(value: string): { type: 'text'; text: { content: string } }[] {
  const parts: { type: 'text'; text: { content: string } }[] = [];
  for (let start = 0; start < value.length; start += 2000) parts.push({ type: 'text', text: { content: value.slice(start, start + 2000) } });
  return parts;
}

async function notion(path: string, method: 'POST' | 'PATCH', body: unknown, config: NotionConfig, step: NotionStep, fetcher: typeof fetch): Promise<Record<string, unknown>> {
  const signal = AbortSignal.timeout(15_000);
  try {
    const response = await fetcher(`https://api.notion.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.NOTION_TOKEN}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      // Workers only accept 'follow' or 'manual'; a redirect then fails as a non-2xx response.
      redirect: 'manual',
    });
    // No provider bodies, personal data, IDs or credentials enter logs/errors.
    if (!response.ok) throw Object.assign(new NotionError(response.status === 429 ? 503 : 502, 'upstream_rejected', response.status), { step });
    const data: unknown = await response.json().catch(() => null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(new NotionError(502, 'invalid_response', response.status), { step });
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NotionError) throw error;
    throw Object.assign(new NotionError(signal.aborted ? 504 : 502, signal.aborted ? 'timeout' : 'network_error'), { step });
  }
}

function origin(lead: LeadPayload): string {
  return Object.entries(lead.attribution ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ');
}

export async function createLeadPage(lead: LeadPayload, score: number, config: NotionConfig, receivedAt: Date, fetcher: typeof fetch = fetch): Promise<string> {
  const mentorship = lead.challengeType === mentorshipType;
  const dataSourceId = mentorship ? config.NOTION_MENTORSHIP_DATA_SOURCE_ID : config.NOTION_DATA_SOURCE_ID;
  if (!config.NOTION_TOKEN || !dataSourceId) throw Object.assign(new NotionError(503, 'configuration_missing'), { step: 'configuration' as const });
  const owner = config.NOTION_OWNER_ID ? [{ object: 'user', id: config.NOTION_OWNER_ID }] : [];
  const source = origin(lead);
  // The mentoring table names the free-text fields for a person, not a company, and has no challenge type or budget.
  const details = mentorship
    ? {
      Status: { select: { name: 'Novo' } },
      'O que faz hoje': { rich_text: richText(lead.companyOrProduct) },
      Objetivo: { rich_text: richText(lead.challenge) },
    }
    : {
      Status: { status: { name: 'Novo' } },
      Empresa: { rich_text: richText(lead.companyOrProduct) },
      ...(lead.challengeType ? { 'Tipo de desafio': { select: { name: lead.challengeType } } } : {}),
      ...(lead.investmentRange ? { Investimento: { select: { name: lead.investmentRange } } } : {}),
      Desafio: { rich_text: richText(lead.challenge) },
    };
  const page = await notion('/pages', 'POST', {
    parent: { type: 'data_source_id', data_source_id: dataSourceId },
    properties: {
      Nome: { title: richText(lead.name) },
      Classe: { select: { name: tierFor(score) } },
      Nota: { number: score },
      Responsável: { people: owner },
      Email: { email: lead.email },
      ...(lead.whatsapp ? { WhatsApp: { phone_number: lead.whatsapp } } : {}),
      'Responder por': { select: { name: lead.contactPreference === 'whatsapp' ? 'WhatsApp' : 'Email' } },
      ...details,
      Análise: { select: { name: 'Pendente' } },
      ...(source ? { Origem: { rich_text: richText(source) } } : {}),
      Consentimento: { checkbox: true },
      'Recebido em': { date: { start: receivedAt.toISOString() } },
    },
    // A mention in the page body is what makes Notion notify the owner right away.
    ...(owner.length ? { children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'mention', mention: { type: 'user', user: owner[0] } }, { type: 'text', text: { content: mentorship ? ' novo pedido de mentoria pelo site.' : ' novo contato pelo site.' } }] } }] } : {}),
  }, config, 'page_create', fetcher);
  if (typeof page.id !== 'string' || !page.id) throw Object.assign(new NotionError(502, 'invalid_response'), { step: 'page_create' as const });
  return page.id;
}

export async function recordAssessment(pageId: string, score: number, assessment: Assessment, config: NotionConfig, fetcher: typeof fetch = fetch): Promise<void> {
  await notion(`/pages/${encodeURIComponent(pageId)}`, 'PATCH', {
    properties: {
      Nota: { number: score },
      Classe: { select: { name: tierFor(score) } },
      Justificativa: { rich_text: richText(assessment.reason) },
      'Primeira pergunta': { rich_text: richText(assessment.firstQuestion) },
      Análise: { select: { name: 'Com IA' } },
    },
  }, config, 'page_update', fetcher);
}

export async function markUnassessed(pageId: string, config: NotionConfig, fetcher: typeof fetch = fetch): Promise<void> {
  await notion(`/pages/${encodeURIComponent(pageId)}`, 'PATCH', { properties: { Análise: { select: { name: 'Sem IA' } } } }, config, 'page_update', fetcher);
}
