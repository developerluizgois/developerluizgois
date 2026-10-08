import type { investmentRanges, LeadPayload } from '../shared/lead';

export type Tier = 'A' | 'B' | 'C';

// What the model judges from the free text. Budget is never part of it: it comes from the visitor's own choice.
export interface Assessment {
  fit: number;
  urgency: number;
  clarity: number;
  reason: string;
  firstQuestion: string;
}

// Weights: investment 35, fit with the ideal client 30, urgency 20, clarity 15.
const investmentPoints: Record<typeof investmentRanges[number], number> = {
  'Ainda preciso entender': 14,
  'Até R$ 10 mil': 8,
  'R$ 10 mil a R$ 25 mil': 24,
  'R$ 25 mil a R$ 50 mil': 32,
  'Acima de R$ 50 mil': 35,
};
const freeMail = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|icloud|me|bol|uol|terra|ig|proton|protonmail)\./i;

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));

export const tierFor = (score: number): Tier => score >= 70 ? 'A' : score >= 45 ? 'B' : 'C';

export function investmentScore(lead: LeadPayload): number {
  return lead.investmentRange ? investmentPoints[lead.investmentRange] : 12;
}

// Rules only, so every lead gets a usable score even when the AI step fails.
export function provisionalScore(lead: LeadPayload): number {
  const fit = (freeMail.test(lead.email) ? 5 : 15)
    + (/\.[a-z]{2,}/i.test(lead.companyOrProduct) ? 5 : 0)
    + (lead.challengeType && lead.challengeType !== 'Outro / ainda não sei' ? 5 : 0);
  const urgency = 10;
  const clarity = lead.challenge.length >= 300 ? 11 : lead.challenge.length >= 120 ? 8 : 5;
  return clamp(investmentScore(lead) + fit + urgency + clarity, 100);
}

export function finalScore(lead: LeadPayload, assessment: Assessment): number {
  return clamp(investmentScore(lead) + clamp(assessment.fit, 30) + clamp(assessment.urgency, 20) + clamp(assessment.clarity, 15), 100);
}
