import type { LeadPayload } from '../shared/lead';

export class PayloadError extends Error {
  constructor(public readonly status = 400) { super('Invalid request'); }
}

const MAX_BODY_BYTES = 16 * 1024;
const allowed = new Set(['name', 'email', 'whatsapp', 'companyOrProduct', 'challenge', 'consent', 'websiteCheck']);

function text(value: unknown, min: number, max: number, multiline = false): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) throw new PayloadError();
  const normalized = multiline ? value.replace(/\r\n?/g, '\n').trim() : value.replace(/\s+/g, ' ').trim();
  if (normalized.length < min) throw new PayloadError();
  return normalized;
}

export function validateLead(payload: unknown): LeadPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new PayloadError();
  const data = payload as Record<string, unknown>;
  if (Object.keys(data).some(key => !allowed.has(key)) || data.consent !== true) throw new PayloadError();
  const websiteCheck = data.websiteCheck === undefined ? '' : text(data.websiteCheck, 0, 200);
  if (websiteCheck) throw new PayloadError();
  const name = text(data.name, 2, 120);
  const email = text(data.email, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PayloadError();
  const companyOrProduct = text(data.companyOrProduct, 1, 160);
  const challenge = text(data.challenge, 20, 3000, true);
  let whatsapp: string | undefined;
  if (data.whatsapp !== undefined) {
    const phone = text(data.whatsapp, 0, 40);
    if (phone) {
      if (!/^\+?[\d\s().-]+$/.test(phone)) throw new PayloadError();
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) throw new PayloadError();
      whatsapp = `${phone.startsWith('+') ? '+' : ''}${digits}`;
    }
  }
  return { name, email, ...(whatsapp ? { whatsapp } : {}), companyOrProduct, challenge, consent: true };
}

export async function readLead(request: Request): Promise<LeadPayload> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new PayloadError(415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new PayloadError(413);
  if (!request.body) throw new PayloadError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new PayloadError(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
  catch { throw new PayloadError(); }
  return validateLead(payload);
}
