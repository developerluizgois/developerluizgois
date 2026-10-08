import { readLead, PayloadError } from './validation';
import { createLeadPage, recordAssessment, markUnassessed, NotionError } from './notion';
import type { NotionConfig } from './notion';
import { assessLead } from './assessment';
import { finalScore, provisionalScore } from './scoring';
import type { LeadPayload, LeadResponse } from '../shared/lead';

export interface Env extends NotionConfig {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ANTHROPIC_API_KEY?: string;
}
interface WorkerContext { waitUntil(promise: Promise<unknown>): void }

function json(body: LeadResponse, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
const unavailable = 'Não foi possível enviar sua solicitação. Tente novamente.';

// Runs after the visitor already has their confirmation; a failure here never loses the lead.
export async function enrichLead(lead: LeadPayload, pageId: string, env: Env, fetcher: typeof fetch = fetch): Promise<void> {
  let step = 'assessment';
  try {
    const assessment = await assessLead(lead, env.ANTHROPIC_API_KEY, fetcher);
    step = 'page_update';
    await recordAssessment(pageId, finalScore(lead, assessment), assessment, env, fetcher);
  } catch (error) {
    // Allowlisted diagnostics only: never log the lead, the model output or provider bodies.
    console.error(JSON.stringify({ event: 'lead_assessment_failed', step, upstreamStatus: error instanceof NotionError ? error.upstreamStatus ?? null : null }));
    await markUnassessed(pageId, env, fetcher).catch(() => {});
  }
}

export default {
  async fetch(request: Request, env: Env, ctx?: WorkerContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname !== '/api/lead') return json({ success: false, message: 'Não encontrado.' }, 404);
    if (request.method !== 'POST') return json({ success: false, message: 'Método não permitido.' }, 405, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      return json({ success: false, message: 'Solicitação não permitida.' }, 403);
    }
    const receivedAt = new Date();
    try {
      const lead = await readLead(request);
      const pageId = await createLeadPage(lead, provisionalScore(lead), env, receivedAt);
      const enrichment = enrichLead(lead, pageId, env);
      if (ctx) ctx.waitUntil(enrichment); else await enrichment;
      return json({ success: true }, 200);
    } catch (error) {
      if (error instanceof PayloadError) return json({ success: false, message: 'Confira os campos e o consentimento antes de enviar.' }, error.status);
      const reference = crypto.randomUUID();
      // Allowlisted diagnostics only: never log requests, provider bodies, URLs or error messages.
      console.error(JSON.stringify({ event: 'lead_delivery_failed', reference, step: error instanceof NotionError ? error.step ?? 'unknown' : 'unknown', reason: error instanceof NotionError ? error.reason : 'invalid_response', upstreamStatus: error instanceof NotionError ? error.upstreamStatus ?? null : null }));
      return json({ success: false, message: unavailable }, error instanceof NotionError ? error.status : 502, { 'X-Request-Id': reference });
    }
  },
};
