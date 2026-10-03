import type { LeadPayload } from '../shared/lead';

export interface HubSpotConfig {
  HUBSPOT_SERVICE_KEY?: string;
  HUBSPOT_PIPELINE_ID: string;
  HUBSPOT_STAGE_NEW_ID: string;
}

type HubSpotStep = 'configuration' | 'consent_schema' | 'contact_lookup' | 'contact_write' | 'deal_create' | 'association';
type FailureReason = 'configuration_missing' | 'upstream_rejected' | 'invalid_response' | 'timeout' | 'network_error' | 'association_unconfirmed';
export class HubSpotError extends Error {
  step?: HubSpotStep;
  constructor(public readonly status: number, public readonly reason: FailureReason = 'invalid_response', public readonly upstreamStatus?: number) { super('Lead processing unavailable'); }
}


function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HubSpotError(502);
  return value as Record<string, unknown>;
}

function recordId(value: unknown): string {
  const id = object(value).id;
  if (typeof id !== 'string' || !/^\d+$/.test(id)) throw new HubSpotError(502);
  return id;
}

export function consentTimestamp(type: unknown, receivedAt: Date): string {
  if (type === 'datetime') return receivedAt.toISOString();
  // A date-only HubSpot field cannot preserve time of day.
  if (type === 'date') return receivedAt.toISOString().slice(0, 10);
  throw new HubSpotError(502);
}

export async function saveLead(lead: LeadPayload, config: HubSpotConfig, receivedAt: Date, fetcher: typeof fetch = fetch): Promise<void> {
  if (!config.HUBSPOT_SERVICE_KEY || !config.HUBSPOT_PIPELINE_ID || !config.HUBSPOT_STAGE_NEW_ID) { const error = new HubSpotError(503, 'configuration_missing'); error.step = 'configuration'; throw error; }
  let step: HubSpotStep = 'consent_schema';
  // One deadline bounds the complete operation, not a separate timeout per step.
  const signal = AbortSignal.timeout(20_000);
  async function api(path: string, method = 'GET', body?: unknown, allowMissing = false): Promise<unknown> {
    step = path.includes('/properties/') ? 'consent_schema' : path.includes('/associations/') ? 'association' : path === '/crm/v3/objects/deals' ? 'deal_create' : method === 'GET' ? 'contact_lookup' : 'contact_write';
    try {
      const response = await fetcher(`https://api.hubapi.com${path}`, {
        method,
        headers: { Authorization: `Bearer ${config.HUBSPOT_SERVICE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal,
        redirect: 'error',
      });
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) {
        // No provider bodies, personal data, IDs or credentials enter logs/errors.
        throw new HubSpotError(response.status === 409 ? 409 : response.status === 429 ? 503 : 502, 'upstream_rejected', response.status);
      }
      if (response.status === 204) return null;
      try { return await response.json(); } catch { throw new HubSpotError(502, 'invalid_response', response.status); }
    } catch (error) {
      if (error instanceof HubSpotError) throw error;
      throw new HubSpotError(signal.aborted ? 504 : 502, signal.aborted ? 'timeout' : 'network_error');
    }
  }

  try {
    const metadata = object(await api('/crm/v3/properties/contacts/data_do_consentimento_pelo_site'));
    const properties: Record<string, string> = {
      firstname: lead.name,
      email: lead.email,
      consentimento_pelo_site: 'true',
      data_do_consentimento_pelo_site: consentTimestamp(metadata.type, receivedAt),
      ...(lead.whatsapp ? { mobilephone: lead.whatsapp } : {}),
    };
    const lookup = `/crm/v3/objects/contacts/${encodeURIComponent(lead.email)}?idProperty=email`;
    let contact = await api(lookup, 'GET', undefined, true);
    let contactId: string;
    if (contact) {
      contactId = recordId(contact);
      recordId(await api(`/crm/v3/objects/contacts/${contactId}`, 'PATCH', { properties }));
    } else {
      try {
        contactId = recordId(await api('/crm/v3/objects/contacts', 'POST', { properties }));
      } catch (error) {
        // A concurrent submission may have created this email after our lookup.
        if (!(error instanceof HubSpotError) || error.status !== 409) throw error;
        contact = await api(lookup);
        contactId = recordId(contact);
        recordId(await api(`/crm/v3/objects/contacts/${contactId}`, 'PATCH', { properties }));
      }
    }

    // Intentionally create a new deal for each submission, even for an existing contact.
    const dealId = recordId(await api('/crm/v3/objects/deals', 'POST', {
      properties: {
        dealname: `Site | ${lead.companyOrProduct} | ${lead.name}`,
        pipeline: config.HUBSPOT_PIPELINE_ID,
        dealstage: config.HUBSPOT_STAGE_NEW_ID,
        empresa_ou_produto: lead.companyOrProduct,
        desafio_do_projeto: lead.challenge,
        origem_do_lead: 'Site',
      },
    }));
    const association = object(await api(`/crm/v4/objects/deals/${dealId}/associations/default/contacts/${contactId}`, 'PUT'));
    if ((association.status !== 'COMPLETE' && association.status !== 'COMPLETED') ||
        (Array.isArray(association.errors) && association.errors.length > 0) ||
        (typeof association.numErrors === 'number' && association.numErrors > 0) ||
        !Array.isArray(association.results) || !association.results.some(result => {
          const entry = object(result);
          return object(entry.from).id === dealId && object(entry.to).id === contactId;
        })) throw new HubSpotError(502, 'association_unconfirmed');
  } catch (error) {
    const failure = error instanceof HubSpotError ? error : new HubSpotError(502);
    failure.step = step;
    throw failure;
  }
}
