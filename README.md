# Luiz Gois — Engenharia de produto & IA aplicada

Landing de página única, em português, com **Vite + Vanilla TypeScript + CSS**, publicada como **Cloudflare Worker + Static Assets** no mesmo projeto. Não utiliza framework de UI, banco próprio ou servidor tradicional.

## Rodar localmente


Use Node.js 22.12+ (Node 24 recomendado).

```sh
npm install
npm run dev
```

A página fica em `http://127.0.0.1:4173`. A API roda no runtime local do plugin Cloudflare. Sem configuração de serviço, o formulário retorna erro amigável e preserva os campos; o restante da página funciona normalmente.

```sh
npm run check
npm run test
npm run build
npm run preview
```

`check` executa TypeScript. `test` executa testes unitários em Node, com respostas HTTP locais controladas, sem acessar contas externas. `build` gera `dist/client` (assets públicos) e `dist/developerluizgois` (Worker/configuração de deploy). `preview` serve o build existente.

## Cloudflare e GitHub Builds

Worker alvo: **`developerluizgois`**, exatamente o nome já existente. O plugin oficial `@cloudflare/vite-plugin` produz a configuração que Wrangler utiliza; mantenha o diretório `.wrangler/deploy` gerado pelo build disponível no job de deploy, mas não o versione.

Configuração não sensível em `wrangler.jsonc`:

```text
NOTION_DATA_SOURCE_ID=<id gerado por npm run setup:notion>
NOTION_OWNER_ID=<id do usuário que recebe a notificação>
```

Os secrets `NOTION_TOKEN` e `ANTHROPIC_API_KEY` são lidos **somente pelo Worker** e cadastrados com `npx wrangler secret put <NOME>`. Seus valores não ficam no repositório, no frontend nem no README. Não os declare como `VITE_*` nem em `vars` do Wrangler.

Para testes locais feitos pelo proprietário, copie `.dev.vars.example` para `.dev.vars` e preencha o valor apenas no arquivo local. `.dev.vars`, suas variantes, `.env`, `.wrangler`, `node_modules` e `dist` estão ignorados. Este trabalho não usou nem solicitou a chave real.

### Deploy automático

Todo merge na `main` publica o site pelo **Cloudflare Workers Builds**, conectado a `developerluizgois/developerluizgois`. Configuração no painel do Worker (**Settings → Builds → Production**):

- Diretório raiz: `/`; branch de produção: `main`.
- Build: `npm run build`. Deploy: `npx wrangler deploy`.
- **Builds for Preview branches** desligado: o comando de preview em beta (`wrangler preview`) exige um bloco `previews` que apontaria para o mesmo Notion de produção.

Os PRs são checados pelo GitHub Actions (`.github/workflows/ci.yml`): TypeScript, testes, build e `wrangler deploy --dry-run`, que valida a configuração gerada sem publicar nada. O workflow não usa secrets.

O Worker responde só no custom domain `luizgois.com`, ligado pelo painel. `workers_dev` e `preview_urls` estão desligados no `wrangler.jsonc` para não publicar uma cópia indexável do site. Sem `routes` no arquivo, o deploy não altera os domínios configurados no painel.

Deploy manual, se necessário (executa build e `wrangler deploy`):

```sh
npm run deploy
```

Não é um deploy de Cloudflare Pages; não envie apenas `dist/client`, pois a API precisa acompanhar os assets.

## Fluxo de contato

O visitante preenche o formulário na própria página. O frontend envia JSON somente para `POST /api/lead`, sem iframe ou redirecionamento.

Campos visíveis: nome, e-mail, empresa/produto, tipo de desafio, investimento previsto, contexto e consentimento. O WhatsApp só aparece quando a pessoa marca “Prefiro receber a resposta por WhatsApp”; nesse caso o número é obrigatório. Os botões dos serviços preenchem o contexto e o tipo de desafio sem sobrescrever o que o visitante já escreveu. O Worker:

1. Restringe método, origem, Content-Type, tamanho do body (16 KiB), campos e limites; rejeita honeypot preenchido e consentimento ausente. Tipo de desafio e investimento são validados por listas fechadas em `shared/lead.ts`.
2. Calcula uma nota provisória só com regras (`worker/scoring.ts`) e cria uma página no banco “Contatos do site” do Notion, atribuída a `NOTION_OWNER_ID` e com uma menção a essa pessoa, o que dispara a notificação do Notion.
3. Responde `{ "success": true }` assim que a página existe. Falhas retornam mensagens públicas genéricas e não expõem resposta do provedor, IDs ou segredo.
4. Em segundo plano (`waitUntil`), envia ao Claude Haiku apenas empresa/produto, domínio do e-mail, tipo de desafio e descrição, e atualiza a página com nota final, classe, justificativa e primeira pergunta sugerida. Se a IA falhar, a página fica com a nota provisória e `Análise: Sem IA`; o contato nunca se perde.

**Nota (0–100):** investimento 35 (escolha do visitante, nunca da IA), aderência ao cliente ideal 30, urgência 20, clareza 15. **Classe:** A ≥ 70, B ≥ 45, C abaixo disso.

A API é same-origin e não abre CORS. Requisições sem `Origin` são aceitas para clientes HTTP legítimos; navegadores com origem diferente são rejeitados. Não existe autenticação de visitante. A proteção básica reduz abuso comum, mas não substitui rate limiting/WAF caso necessário no futuro.

Timeouts: Notion 15 s por chamada, IA 25 s com um retry, frontend 30 s. Nenhum body, e-mail, telefone, mensagem, ID de página ou chave é enviado aos logs pelo código da aplicação.

## Configuração do Notion (uma vez)

1. Em [notion.so/my-integrations](https://www.notion.so/my-integrations), crie uma integração interna com permissão de ler, inserir e atualizar conteúdo e de ler informações de usuários, incluindo e-mail.
2. Crie uma página no Notion (ex.: “CRM”) e compartilhe com a integração (`•••` → Conexões).
3. No terminal, com o token só no seu ambiente: `NOTION_TOKEN=... NOTION_PARENT_PAGE=<link da página> npm run setup:notion`. O script cria o banco com todas as colunas e imprime `NOTION_DATA_SOURCE_ID` e `NOTION_OWNER_ID`.
4. Coloque os dois IDs em `vars` no `wrangler.jsonc` e cadastre os secrets: `npx wrangler secret put NOTION_TOKEN` e `npx wrangler secret put ANTHROPIC_API_KEY`.
5. No Notion, ordene a visão principal por `Nota` (decrescente) e filtre `Status` diferente de Fechado/Descartado.

## GTM e privacidade

Container preservado: `GTM-KW3WSNGQ`, com script e fallback `noscript`.

| Evento | Condição | Dados |
| --- | --- | --- |
| `journey_click` | CTA do hero para resultados | `placement`: hero; `destination`: resultados |
| `contact_click` | CTA do rodapé para o formulário | `placement`: footer |
| `contact_form_start` | Primeiro preenchimento do formulário | `form_provider`: notion |
| `generate_lead` | HTTP 200 com `success: true` da API | `form_provider`: notion |
| `faq_open` | Pergunta do FAQ aberta | `content_id`: id da pergunta |

Não há dados pessoais, respostas ou IDs de CRM nesses eventos. Tags/consentimento adicionais dentro do container são administrados pelo proprietário no GTM. Não foram criadas ou publicadas tags nessa conta.

O botão é bloqueado durante envio, inclusive contra submissões concorrentes. Em falha, os campos são preservados; em sucesso, são limpos e a mensagem de recebimento aparece na mesma seção.

## Visual e arquivos

- `index.html`: única página, metadados, conteúdo, formulário e redes sociais do rodapé.
- `src/main.ts`, `src/contact.ts`, `src/analytics.ts`: interações, envio e tracking sem PII.
- `src/rail.ts`, `src/process.ts`: rail horizontal de “Onde eu entro” e palco sticky de “Como eu trabalho”.
- `src/styles/main.css`: tokens da paleta original (navy, preto, marrom, papel) e todo o layout responsivo.
- `worker/index.ts`, `worker/validation.ts`: roteamento e validação.
- `worker/notion.ts`, `worker/scoring.ts`, `worker/assessment.ts`: registro no Notion, nota e análise com IA.
- `scripts/setup-notion.ts`: cria o banco de contatos no Notion.
- `shared/lead.ts`: contrato tipado entre camadas.
- `public/assets/`: foto fornecida por Luiz, fonte local, licença e favicon atualizado.
- `vite.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `vitest.config.ts`, `package-lock.json`: tooling/configuração.
- Scripts artesanais anteriores e o fluxo provisório de contato foram removidos.

O scroll usa `scroll-snap` nativo: aproximação suave no desktop e no celular, com altura natural nos blocos editoriais para permitir leitura de seções longas e preenchimento com teclado aberto. Conteúdo que ultrapassa uma tela continua acessível. `prefers-reduced-motion` desativa o encaixe e animações. Não existe captura de eventos wheel nem bloqueio de rolagem.

LinkedIn, X e Instagram aparecem no rodapé. Os quatro cases possuem links para a plataforma de origem da experiência profissional. A imagem nova é preservada em sua versão original; o recorte é responsivo via CSS. A fonte Geist é servida localmente sob a licença incluída.

## Validação e entrega

Executados localmente: instalação de dependências, checagem TypeScript, testes unitários e build Vite para frontend/Worker. Os testes exercitam validação, ausência/normalização de telefone, mapeamento dos objetos, associação, falhas externas, bloqueio de envio concorrente e conversão somente após confirmação.

Não foram usados HubSpot real, Cloudflare remoto, chave real ou deploy. A validação ponta a ponta cabe ao proprietário:

1. Publicar no Worker existente após revisar a branch e confirmar bindings/permissões.
2. Enviar com um e-mail novo e verificar Contact, consentimento, Deal no estágio inicial e associação.
3. Enviar novamente com o mesmo e-mail e outro projeto: deve reutilizar Contact e criar outro Deal.
4. Reenviar sem WhatsApp: deve preservar o telefone anteriormente informado.
5. Conferir o tipo da propriedade de consentimento, os valores internos das propriedades customizadas e o valor `Site`.
6. Conferir mensagens de erro e recuperação, preenchimento inválido, botão durante envio, teclado no celular e rolagem nos dispositivos desejados.
7. Verificar `generate_lead` no Tag Assistant após sucesso real, sem PII.

**Limitação operacional:** contato, negócio e associação são operações separadas na API externa, sem transação distribuída. Se ocorrer falha depois da criação de um negócio, ele pode existir sem associação; um novo envio pode criar outro negócio. Também existe resultado indeterminado quando o provedor processa uma escrita mas a resposta se perde. O site não declara sucesso nessas situações. Revise negócios do período no CRM antes de repetir uma solicitação com resultado incerto. Não foi introduzido banco, fila, propriedade de idempotência ou rollback destrutivo fora do escopo.

Referências: [Cloudflare Vite](https://developers.cloudflare.com/workers/vite-plugin/get-started/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [HubSpot Contacts](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/contacts/guide), [propriedades e datas](https://developers.hubspot.com/docs/api-reference/legacy/crm/properties/guide).

## SEO e medição em produção

O domínio principal é **https://luizgois.com/**. O título é **Luiz Gois — Engenharia de produto e growth para software**. O build normal de produção gera:

- Descrição de busca, idioma pt-BR, título e descrição para compartilhamento, Open Graph (com largura, altura e tipo da imagem) e Twitter Card com o retrato de Luiz. `apple-touch-icon.png` (180 px) para atalhos no iOS.
- Canonical absoluto e `og:url` apontando para a raiz, sem parâmetros UTM nem fragmentos das seções.
- JSON-LD com Person (com `knowsAbout` e os seis serviços dos painéis em `makesOffer`), WebSite, WebPage e FAQPage, retrato e perfis sociais reais. O FAQPage é lido do próprio HTML no build (`faqFromHtml`), então editar uma pergunta na página atualiza os dados estruturados. Ao mudar um serviço nos painéis, atualize a lista `services` em `build/seo.ts`. Não inclui números ilustrativos, avaliações ou resultados inventados.
- `robots.txt` permitindo rastreamento da landing e informando o sitemap; `/api/` fica fora do rastreamento.
- `sitemap.xml` contendo apenas a página canônica. Não há datas de atualização fictícias nem URLs separadas para cada seção.
- Conteúdo e metadados no HTML entregue pelo servidor, sem depender da execução de JavaScript pelo buscador. Um H1, títulos de seção, formulário com labels e retrato com dimensões e texto alternativo.
- Fonte local com preload; CSS/JS versionados pelo Vite. `public/_headers` faz cache de 1 ano (`immutable`) nos bundles com hash e de 1 semana nas imagens, fonte e ícones; o HTML continua sempre revalidado. O retrato continua lazy loaded. O componente de exemplos fictícios foi removido. O mosaico usa apenas os resultados fornecidos por Luiz; o texto final está no HTML antes da animação.
- URLs inexistentes não usam fallback de SPA (`not_found_handling: none`), evitando páginas desconhecidas respondendo com a landing e status 200.

A variável **de build** `SITE_URL` pode substituir o domínio, se necessário. Não é secret nem configuração do frontend em runtime. O padrão de produção já é `https://luizgois.com/`. `npm run dev` e builds com `--mode staging` geram `noindex, nofollow`, sem canonical/sitemap de produção. Use modo staging nas previews públicas. Não publique um build staging no domínio principal. Alterar o domínio exige rebuild.

### Depois de publicar

1. Confirmar HTTPS e status 200 em `https://luizgois.com/`, `/robots.txt`, `/sitemap.xml` e na imagem social. Confirmar 404 em uma URL inexistente e ausência de `noindex` na raiz de produção.
2. Configurar na Cloudflare redirecionamento permanente de HTTP e de `www.luizgois.com` para HTTPS sem www, preservando caminho e parâmetros de campanha. Não aplicar redirecionamento de domínio a previews de desenvolvimento.
3. Verificar a propriedade de domínio `luizgois.com` no Google Search Console via DNS. Enviar `/sitemap.xml`, inspecionar a raiz e solicitar indexação. A conta e o DNS não foram alterados por esta implementação.
4. Conferir os dados estruturados no Schema Markup Validator e a leitura da página na inspeção de URL do Search Console. Esses tipos não prometem um resultado enriquecido específico. O Google decide título, descrição e indexação finais.
5. Conferir PageSpeed Insights/Core Web Vitals na URL pública, também no celular. A foto original tem cerca de 2,8 MB; versões menores em WebP/AVIF são uma melhoria futura possível, sem bloqueio funcional. Nenhuma pontuação de performance foi medida ou prometida.

### GTM → GA4 → Ads

O container **GTM-KW3WSNGQ** continua sendo o único ponto de instalação. Não adicione um segundo snippet GA4/Ads ao código da página.

1. No GTM, criar a Google tag com o ID real de medição GA4 e o disparo de page_view configurado uma única vez por carregamento. Esta landing é uma página única: mudanças de hash como `#contato` não devem criar page_views artificiais por History Change.
2. Criar triggers de Custom Event com nomes exatos `journey_click`, `contact_click`, `contact_form_start` e `generate_lead`, associados às respectivas tags de evento GA4. Usar as variáveis de Data Layer `placement`, `destination` e `form_provider` quando presentes. São parâmetros sem dados pessoais.
3. Marcar `generate_lead` como evento principal no GA4. Ele só ocorre após HTTP 200 e `success: true`, com confirmação do contato, negócio e associação. `form_submit`, `contact_click` e `contact_form_start` não comprovam conversão. Se a medição automática de formulários do GA4 gerar ruído, desativá-la e manter os eventos explícitos.
4. Para Ads, escolher uma única conversão principal para o mesmo lead: importar o evento principal do GA4 OU disparar a tag de conversão Ads em `generate_lead`. Não contar as duas como conversões principais da mesma ação. Configurar Conversion Linker/Google tag conforme o caminho escolhido.
5. Configurar consentimento de Analytics e publicidade no GTM/CMP antes de publicar essas tags. O checkbox do formulário autoriza o tratamento da solicitação, não cookies ou personalização de anúncios. Não há CMP implementada nesta entrega; a configuração de tags e consentimento pertence à próxima etapa.
6. No Tag Assistant/GA4 DebugView, conferir page_view único, clique, início do formulário, erro sem generate_lead e sucesso com um único generate_lead. Validar UTMs e auto tagging Ads na URL pública. Não enviar nome, email, telefone ou desafio como parâmetros de eventos, nem habilitar coleta desses campos por seletores automáticos.

GTM instalado não significa que GA4/Ads já estejam recebendo eventos. IDs, tags, consentimento e publicação do container ainda precisam ser configurados pelo proprietário. Search Console mede a presença na busca; GA4 mede o uso do site. Instalar Analytics não garante nem melhora diretamente o posicionamento.

Fontes oficiais: [títulos na busca](https://developers.google.com/search/docs/appearance/title-link), [canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [eventos GA4 no GTM](https://support.google.com/tagmanager/answer/13034206), [generate_lead](https://developers.google.com/analytics/devguides/collection/ga4/reference/events#generate_lead).

## Diagnóstico seguro do erro 502

O 502 apresentado pelo proprietário confirma uma falha no processamento, mas não identifica a etapa nem o motivo retornado pelo HubSpot. A requisição informada é compatível com a validação local. Não foi reproduzida contra a conta real e a causa de produção **não está confirmada como resolvida**.

O Worker agora emite `lead_delivery_failed` com campos estritamente controlados: `reference`, `step`, `reason` e `upstreamStatus`. A mesma referência aparece no header `X-Request-Id`. Não são registrados payload, respostas brutas, URL de chamada ao HubSpot, email, telefone, IDs de contato/negócio ou chave. A resposta pública mantém a mensagem genérica. A observabilidade de logs está habilitada no Wrangler, com logs automáticos de invocação desabilitados para evitar coleta desnecessária; nenhum deploy foi feito nesta entrega.

Após o proprietário publicar esta revisão:

1. Fazer uma tentativa controlada e anotar `X-Request-Id` se falhar.
2. Nos logs do Worker, localizar o evento com a mesma `reference`. Compartilhar somente os quatro campos de diagnóstico, nunca chave ou payload.
3. Interpretar `step`:
   - `configuration`: falta uma variável obrigatória.
   - `consent_schema`: verificar existência e permissão de leitura de `data_do_consentimento_pelo_site`; seu tipo precisa ser date ou datetime. HTTP 403 indica acesso negado; 404 indica propriedade não encontrada.
   - `contact_lookup` / `contact_write`: verificar leitura/escrita de contatos e propriedades de consentimento.
   - `deal_create`: verificar escrita de negócios, os nomes internos das propriedades, a opção interna `Site`, pipeline `default` e estágio `appointmentscheduled`.
   - `association`: verificar permissão de associação. `association_unconfirmed` significa que não foi recebida confirmação concluída para o par criado.
4. Em qualquer etapa, 401 indica falha de autenticação; 403, permissão; 400, parâmetros/propriedades rejeitados; 429, limite do serviço. `timeout` e `network_error` são falhas de comunicação. Corrigir a configuração identificada, sem remover validação ou declarar sucesso antecipado.
5. Antes de reenviar, conferir se o contato ou negócio já foi criado para evitar duplicação decorrente de falha parcial.

Validação local: 36 testes passaram, incluindo sucesso completo no endpoint e falhas simuladas nas cinco etapas externas, com teste de não exposição de dados. Isso valida o código e o diagnóstico; não comprova a configuração nem a disponibilidade da conta HubSpot em produção.


## Reposicionamento B2B (3 de outubro de 2026)

A página continua única, com a arquitetura Vite/TypeScript/Worker existente. Não foram criados roteamento, scaffolding ou páginas futuras. Hero e conteúdo apresentam Engenharia de Produto, Software e IA Aplicada para empresas em operação. O catálogo foi reduzido a quatro frentes; tecnologia aparece como capacidade secundária. Foram adicionados qualificação, exemplos, método, contratação e FAQ nativo acessível.

Removidos os três números sem comprovação: WhatsApp +20 vendas, landing page +50% e retenção de 20 clientes. Os cases restantes usam apenas o histórico fornecido, com atribuição cuidadosa da conversão. Nenhum depoimento ou endosso foi acrescentado.

### Formulário e compatibilidade

`challengeType` e `investmentRange` são opcionais, validados por listas fechadas no Worker. Todas as faixas, inclusive até R$ 10 mil, são aceitas. Clientes antigos que não enviam esses campos continuam aceitos. A qualificação é anexada ao campo existente `desafio_do_projeto` do Deal; não exige criar propriedades novas no HubSpot. O fluxo Contact → Deal → associação, consentimento, origem, honeypot, limite de corpo e chave no backend foram preservados.

UTMs são capturadas da URL de entrada enquanto a página está aberta. Aceitam apenas slugs de campanha de até 120 caracteres (letras sem acento, números, espaço, ponto, hífen e sublinhado). O referrer é reduzido à origem, sem caminho ou query. Não há persistência entre visitas, cookies novos ou envio desses valores aos eventos personalizados de analytics. Configure campanhas sem dados pessoais; parâmetros fora desse formato são descartados. Informações aceitas seguem somente ao CRM, na descrição do Deal.

### Eventos

Preservados `contact_click`, `journey_click`, `contact_form_start` e `generate_lead`.
Novos: `hero_primary_cta_click`, `hero_results_cta_click`, `solution_view`, `case_view`, `contact_form_submit`, `contact_form_success`, `contact_form_error`, `linkedin_click`.
Visualizações usam somente `content_id` estático e disparam uma vez por carregamento. Eventos do formulário usam `form_provider`. Não são enviados nome, email, telefone, desafio, URL, referrer ou UTMs. `generate_lead` continua sendo a única conversão recomendada; não marque também `contact_form_success` como conversão da mesma ação. Falhas no dataLayer são isoladas do envio. Não existe link de WhatsApp e, portanto, não há disparo fictício de `whatsapp_click`.

GTM-KW3WSNGQ preservado. Criar os triggers desejados no GTM e validar GA4/Ads após publicação pelo proprietário. Não houve alteração externa de tags, credenciais, CRM ou deploy.

### Validação desta entrega

Baseline: TypeScript, 36 testes e build passaram. Após alterações: TypeScript, 48 testes (incluindo qualificação, atribuição, timeout, JSON inválido e analytics indisponível) e build passaram. Não existe script de lint. Verificação de SEO e âncoras é feita sobre o HTML de produção. Nenhuma pontuação Lighthouse foi medida.

Validação manual final: publicar após revisão; enviar o formulário com cada faixa de investimento, conferir qualificação/origem no Deal e associação com Contact; validar sucesso, erro/reenvio, teclado móvel, notificação e confete; conferir eventos pelo Tag Assistant e GA4. A causa do 502 anterior não está confirmada como resolvida. As instruções de diagnóstico acima permanecem aplicáveis. A foto original permanece lazy loaded; não houve nova biblioteca.


## Redesign editorial (7 de outubro de 2026)

Mesma identidade, nova composição. A página tem seis áreas: header, hero, Onde eu entro, Como eu trabalho, Resultados em produção, Investimento + contato e footer/about.

**Paleta.** Todas as cores vêm do site publicado: navy (`#0c1830`, `#14243f`, `#152440`, `#304b75`, `#648bc9`, `#819ac0`, `#c2d3f5`), papel (`#f3f4f5`, `#e9edf2`, `#fff`), neutros (`#606b7c`, `#ced4de`), preto `#191919` e marrom `#2a1e1a` com seus tons (`#f7f0e9`, `#cbb9ad`, `#b6a297`). Valores `rgb()` no CSS são apenas variações de opacidade dessas cores. Removidos: confete (`#a78668`) e o verde de sucesso. Tipografia preservada: Georgia nos títulos, Geist no texto.

**Removido.** FAQ, “Para quem”, “Exemplos”, “Sobre” extenso, lista de stack, mosaico de cards, toast, confete, contadores animados, CTA final gigante e os selects de tipo de desafio e faixa de investimento. `challengeType` e `investmentRange` continuam aceitos pelo Worker para compatibilidade com páginas em cache.

**Formulário.** Quatro campos visíveis + consentimento LGPD. WhatsApp por divulgação progressiva. A preferência é anexada ao `desafio_do_projeto` do Deal como “Preferência de resposta: WhatsApp”. O sucesso aparece no próprio componente, sem redirecionamento.

**Eventos (sem PII).** Novos: `hero_cta_click` (`cta`: primary|results), `capability_view`, `process_step_view`, `case_view`, `investment_view`, `form_start`, `form_submit`, `form_submit_success`, `form_submit_error`, `social_click` (`network`, `placement`), `scroll_25|50|75|90`. Os nomes anteriores continuam sendo enviados em paralelo (`contact_form_start`, `contact_form_submit`, `generate_lead`, `contact_form_success`, `contact_form_error`, `contact_click`, `journey_click`, `hero_primary_cta_click`, `hero_results_cta_click`, `linkedin_click`), então os triggers existentes no GTM continuam funcionando. `solution_view` foi substituído por `capability_view`. `generate_lead` segue como única conversão recomendada.

**Motion.** CSS + SVG + IntersectionObserver, sem biblioteca. Movimento contínuo só no diagrama do hero e nas cenas visíveis. `prefers-reduced-motion` mostra o estado final de cada visual, sem deslocamentos.

**Imagens.** Footer usa `luiz-gois-480.jpg` (38 KB); OG usa `luiz-gois-og.jpg` (1200 px, 170 KB). O original fica em `public/assets/luiz-gois.jpg`, sem uso na página.

Validação: TypeScript, 52 testes e build passaram. Não existe script de lint no projeto.


## Nova estrutura (8 de outubro de 2026)

Sem header. A primeira tela é sempre o hero navy, em três zonas: texto e CTA (“Quero mudar meu cenário” → `#contato`), card de indicadores rotativo e, embaixo, “Projetos realizados com” + anúncio para `https://mentor.wokepeople.com/` com `utm_source=luizgois.com`, `utm_medium=referral`, `utm_campaign=luizgois_site`, `utm_content=hero_announcement`. (`www.mentor.wokepeople.com` não resolve no DNS.)

Seções: Minha expertise (altura de tela, cinco cards), Como eu trabalho (quatro etapas, palco sticky no desktop), Quem está por trás (altura de tela), formulário centralizado e footer “O bom pode ser melhor.”. Removidos: Resultados em produção, bloco de investimento e header.

**Card de indicadores** (`src/metrics.ts`): troca a cada 4,8 s, pausa com mouse/foco/botão e não roda sozinho com `prefers-reduced-motion`. Os seis indicadores também estão em lista para leitores de tela.

**Logos** em `public/assets/logos/`, exibidos em escala de cinza para manter a paleta. Dois aparecem sem nome, por escolha do proprietário.

**Eventos novos:** `hero_metric_select`, `announcement_click`, `team_view`. Saíram `journey_click`, `hero_results_cta_click`, `case_view` e `investment_view`, porque os elementos não existem mais.

## Motion e scroll (8 de outubro de 2026, revisão 2)

- **Scroll suave:** Lenis `1.3.26` (≈6 KB gzip) em `src/scroll.ts`. Atua em roda e trackpad; o toque continua nativo e `prefers-reduced-motion` mantém o scroll nativo. Links internos deslizam até a seção. O rail horizontal mantém o gesto lateral nativo (`data-lenis-prevent-horizontal`).
- **Visuais dos cards e etapas:** SVG com animação SMIL (sem biblioteca). `src/motion.ts` pausa cada SVG fora da tela e as cenas inativas do palco sticky. Com reduced motion, cada visual congela num quadro representativo (`data-still`).
- **“Quero esse serviço”:** cada card leva ao formulário e preenche “O que está acontecendo?” com um texto do contexto (`data-prefill`), sem sobrescrever o que a pessoa já escreveu. Eventos: `contact_click` (`placement: service`) e `service_cta_click` (`content_id`).
- A última etapa de “Como eu trabalho” tem o CTA “Quero mudar meu cenário” (`contact_click`, `placement: process`).
- Logos com as cores originais: Woke, Leads2b, Shop2gether, Workana e Upwork.
