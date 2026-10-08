// Sends one labeled test lead through the same code the Worker uses and prints Notion's answer.
// Run it yourself so the token never leaves your terminal:
//   NOTION_TOKEN=... npm run notion:check
import { readFileSync } from 'node:fs';
import { createLeadPage } from '../worker/notion.ts';
import { provisionalScore } from '../worker/scoring.ts';

const token = process.env.NOTION_TOKEN?.trim();
if (!token) {
  console.error('Defina NOTION_TOKEN.');
  process.exit(1);
}
// wrangler.jsonc holds the two non-secret IDs; strip its line comments before parsing.
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const vars = config.vars as { NOTION_DATA_SOURCE_ID: string; NOTION_OWNER_ID: string };

const lead = {
  name: 'TESTE CLAUDE (pode apagar)',
  email: 'teste-claude@example.com',
  companyOrProduct: 'exemplo.test',
  challengeType: 'Retenção e churn' as const,
  investmentRange: 'R$ 25 mil a R$ 50 mil' as const,
  challenge: 'Teste do fluxo de contatos rodado pelo script notion:check.',
  consent: true as const,
};

// Only Notion's status, code and message are printed: no token, no request body.
const fetcher: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.clone().json().catch(() => ({}));
    console.error(`Notion respondeu ${response.status} (${body.code ?? 'sem código'}): ${body.message ?? 'sem detalhe'}`);
  }
  return response;
};

try {
  const pageId = await createLeadPage(lead, provisionalScore(lead), { NOTION_TOKEN: token, ...vars }, new Date(), fetcher);
  console.log(`Funcionou: página de teste criada (${pageId}). Pode apagá-la no Notion.`);
} catch {
  console.error('Falhou. A mensagem do Notion acima mostra o motivo.');
  process.exit(1);
}
