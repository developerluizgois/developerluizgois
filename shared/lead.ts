export interface LeadPayload {
  name: string;
  email: string;
  whatsapp?: string;
  contactPreference?: 'whatsapp';
  companyOrProduct: string;
  challenge: string;
  challengeType?: typeof challengeTypes[number];
  investmentRange?: typeof investmentRanges[number];
  attribution?: Attribution;
  consent: true;
  websiteCheck?: string;
}

export type LeadResponse = { success: true } | { success: false; message: string };

// Mirrors the areas on the page; the form's <select> options must match exactly (checked in tests).
export const challengeTypes = ['Aquisição e landing page', 'Ativação e onboarding', 'Conversão e monetização', 'Retenção e churn', 'Outro / ainda não sei'] as const;
export const investmentRanges = ['Ainda preciso entender', 'Até R$ 10 mil', 'R$ 10 mil a R$ 25 mil', 'R$ 25 mil a R$ 50 mil', 'Acima de R$ 50 mil'] as const;
export const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer'] as const;
export type Attribution = Partial<Record<typeof attributionKeys[number], string>>;
