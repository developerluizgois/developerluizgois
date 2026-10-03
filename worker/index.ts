import { readLead, PayloadError } from './validation';
import { saveLead, HubSpotError } from './hubspot';
import type { HubSpotConfig } from './hubspot';
import type { LeadResponse } from '../shared/lead';

export interface Env extends HubSpotConfig {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function json(body: LeadResponse, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
const unavailable = 'Não foi possível enviar sua solicitação. Tente novamente.';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
      await saveLead(lead, env, receivedAt);
      return json({ success: true }, 200);
    } catch (error) {
      if (error instanceof PayloadError) return json({ success: false, message: 'Confira os campos e o consentimento antes de enviar.' }, error.status);
      return json({ success: false, message: unavailable }, error instanceof HubSpotError ? (error.status === 409 ? 502 : error.status) : 502);
    }
  },
};
