// Lists the people in the Notion workspace so you can pick the NOTION_OWNER_ID.
// Run it yourself so the token never leaves your terminal:
//   NOTION_TOKEN=... npm run notion:users
const token = process.env.NOTION_TOKEN?.trim();
if (!token) {
  console.error('Defina NOTION_TOKEN.');
  process.exit(1);
}

let cursor: string | undefined;
let found = 0;
do {
  const response = await fetch(`https://api.notion.com/v1/users?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2026-03-11' },
  });
  const page = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Notion respondeu ${response.status}: ${page.message ?? 'sem detalhe'}`);
    process.exit(1);
  }
  for (const user of page.results ?? []) {
    if (user.type !== 'person') continue;
    found += 1;
    console.log(`${user.name ?? '(sem nome)'} · ${user.person?.email ?? '(email não liberado para a integração)'} · NOTION_OWNER_ID = ${user.id}`);
  }
  cursor = page.has_more ? page.next_cursor : undefined;
} while (cursor);
if (!found) console.log('Nenhuma pessoa visível para a integração.');

export {};
