// One-time setup: creates the leads database in Notion and prints the IDs the Worker needs.
// Run it yourself so the token never leaves your terminal:
//   NOTION_TOKEN=... NOTION_PARENT_PAGE=<page link or id> npm run setup:notion
import { challengeTypes, investmentRanges } from '../shared/lead.ts';

const NOTION_VERSION = '2026-03-11';
const token = process.env.NOTION_TOKEN?.trim();
const parent = process.env.NOTION_PARENT_PAGE?.trim();
const ownerEmail = (process.env.NOTION_OWNER_EMAIL ?? 'luizgois.contact@gmail.com').trim().toLowerCase();

if (!token || !parent) {
  console.error('Defina NOTION_TOKEN e NOTION_PARENT_PAGE (o link ou o id da página compartilhada com a integração).');
  process.exit(1);
}
const hex = parent.replace(/-/g, '').match(/[0-9a-f]{32}(?=[^0-9a-f]*$)/i)?.[0];
if (!hex) {
  console.error('NOTION_PARENT_PAGE não parece um link ou id de página do Notion.');
  process.exit(1);
}
const pageId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

async function api(path: string, method = 'GET', body?: unknown): Promise<any> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Notion respondeu ${response.status} em ${method} ${path}: ${data.message ?? 'sem detalhe'}`);
  return data;
}

async function findOwner(): Promise<string | undefined> {
  let cursor: string | undefined;
  do {
    const page = await api(`/users?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    const match = page.results.find((user: any) => user.type === 'person' && user.person?.email?.toLowerCase() === ownerEmail);
    if (match) return match.id;
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return undefined;
}

const options = (names: readonly string[], color = 'default') => names.map(name => ({ name, color }));

const ownerId = await findOwner();
const database = await api('/databases', 'POST', {
  parent: { type: 'page_id', page_id: pageId },
  title: [{ type: 'text', text: { content: 'Contatos do site' } }],
  initial_data_source: {
    properties: {
      Nome: { type: 'title', title: {} },
      Classe: { type: 'select', select: { options: [{ name: 'A', color: 'green' }, { name: 'B', color: 'yellow' }, { name: 'C', color: 'gray' }] } },
      Nota: { type: 'number', number: { format: 'number' } },
      Status: { type: 'status', status: { options: [
        { name: 'Novo', color: 'blue', group: 'To-do' },
        { name: 'Chamei', color: 'yellow', group: 'In progress' },
        { name: 'Em conversa', color: 'orange', group: 'In progress' },
        { name: 'Proposta', color: 'purple', group: 'In progress' },
        { name: 'Fechado', color: 'green', group: 'Complete' },
        { name: 'Descartado', color: 'gray', group: 'Complete' },
      ] } },
      Responsável: { type: 'people', people: {} },
      Email: { type: 'email', email: {} },
      WhatsApp: { type: 'phone_number', phone_number: {} },
      'Responder por': { type: 'select', select: { options: [{ name: 'Email', color: 'default' }, { name: 'WhatsApp', color: 'green' }] } },
      Empresa: { type: 'rich_text', rich_text: {} },
      'Tipo de desafio': { type: 'select', select: { options: options(challengeTypes, 'blue') } },
      Investimento: { type: 'select', select: { options: options(investmentRanges, 'purple') } },
      Desafio: { type: 'rich_text', rich_text: {} },
      Justificativa: { type: 'rich_text', rich_text: {} },
      'Primeira pergunta': { type: 'rich_text', rich_text: {} },
      Análise: { type: 'select', select: { options: [{ name: 'Pendente', color: 'gray' }, { name: 'Com IA', color: 'green' }, { name: 'Sem IA', color: 'red' }] } },
      Origem: { type: 'rich_text', rich_text: {} },
      Consentimento: { type: 'checkbox', checkbox: {} },
      'Recebido em': { type: 'date', date: {} },
    },
  },
});
const full = database.data_sources ? database : await api(`/databases/${database.id}`);
const dataSourceId = full.data_sources?.[0]?.id;
if (!dataSourceId) throw new Error('O Notion criou o banco, mas não devolveu o id da data source.');

console.log('\nBanco "Contatos do site" criado.\n');
console.log('Copie estes dois valores para o Claude (não são secretos):');
console.log(`  NOTION_DATA_SOURCE_ID = ${dataSourceId}`);
console.log(ownerId ? `  NOTION_OWNER_ID = ${ownerId}` : `  NOTION_OWNER_ID = (não encontrei ${ownerEmail}; confira se a integração pode ler emails de usuários)`);
