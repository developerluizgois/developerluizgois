export interface LeadPayload {
  name: string;
  email: string;
  whatsapp?: string;
  companyOrProduct: string;
  challenge: string;
  consent: true;
  websiteCheck?: string;
}

export type LeadResponse = { success: true } | { success: false; message: string };
