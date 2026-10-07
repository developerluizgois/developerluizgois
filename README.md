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
HUBSPOT_PIPELINE_ID=default
HUBSPOT_STAGE_NEW_ID=appointmentscheduled
```

O binding secreto obrigatório `HUBSPOT_SERVICE_KEY` é lido **somente pelo Worker**. Conforme informado, ele já está cadastrado em Production. Seu valor não está no repositório, no frontend ou no README. Não declare esse binding como `VITE_*` nem em `vars` do Wrangler.

Para testes locais feitos pelo proprietário, copie `.dev.vars.example` para `.dev.vars` e preencha o valor apenas no arquivo local. `.dev.vars`, suas variantes, `.env`, `.wrangler`, `node_modules` e `dist` estão ignorados. Este trabalho não usou nem solicitou a chave real.

Deploy manual, quando autorizado pelo proprietário:

```sh
npm run deploy
```

Esse comando executa build e `wrangler deploy`. **Não foi executado nesta implementação.** Não é um deploy de Cloudflare Pages; não envie apenas `dist/client`, pois a API precisa acompanhar os assets.

Para conectar posteriormente GitHub → **Cloudflare Workers Builds** no Worker existente:

- Repositório: `developerluizgois/developerluizgois`; diretório raiz: `/`.
- Selecione a branch aprovada pelo proprietário. Não foi feito merge ou alteração de configuração de produção.
- Instalação: `npm ci` (lockfile incluído).
- Build: `npm run build`.
- Deploy: `npx wrangler deploy` (o build já foi executado; `npm run deploy` também funciona, mas recompila).
- Confirme o secret no ambiente de destino e as permissões da conexão GitHub/Cloudflare. Não é necessário disponibilizar a chave de serviço ao processo de build do frontend.

## Fluxo de contato

O visitante preenche o formulário na própria página. O frontend envia JSON somente para `POST /api/lead`, sem iframe ou redirecionamento.

Campos: nome, e-mail, WhatsApp opcional, empresa/produto, desafio e consentimento. O Worker:

1. Restringe método, origem, Content-Type, tamanho do body (16 KiB), campos e limites; rejeita honeypot preenchido e consentimento ausente.
2. Captura o instante real de recebimento e consulta a definição existente de `data_do_consentimento_pelo_site`.
3. Localiza o Contact pelo e-mail usando `idProperty=email`; atualiza quando existe ou cria quando não existe. Um conflito de criação concorrente é recuperado com nova leitura por e-mail.
4. Grava `firstname`, `email`, `consentimento_pelo_site=true` e a data do consentimento. Só inclui `mobilephone` quando há WhatsApp; nunca limpa telefone existente por ausência desse campo.
5. Cria sempre um novo Deal com `pipeline=default`, `dealstage=appointmentscheduled`, `empresa_ou_produto`, `desafio_do_projeto`, `origem_do_lead=Site` e nome legível.
6. Associa Deal → Contact pela associação padrão da API v4, sem IDs numéricos de tipo hardcoded.
7. Responde `{ "success": true }` apenas depois da associação concluída. Falhas retornam mensagens públicas genéricas e não expõem resposta do provedor, IDs ou segredo.

A API é same-origin e não abre CORS. Requisições sem `Origin` são aceitas para clientes HTTP legítimos; navegadores com origem diferente são rejeitados. Não existe autenticação de visitante. A proteção básica reduz abuso comum, mas não substitui rate limiting/WAF caso necessário no futuro.

Timeout global do processamento externo: 20 segundos; timeout do frontend: 30 segundos. Não há retry automático de operações de escrita. Nenhum body, e-mail, telefone, mensagem, ID de contato/negócio ou chave é enviado aos logs pelo código da aplicação.

## Propriedades e permissões do HubSpot

Nenhuma propriedade, pipeline ou estágio é criado por este projeto. A chave precisa permitir leitura/escrita de contatos, criação de negócios, associação e leitura do schema de propriedades de contatos (incluindo o escopo aplicável de schema, como `crm.schemas.contacts.read`).

A data usa ISO 8601 segundo o tipo retornado pela API:

- `datetime`: instante completo de recebimento em UTC, com milissegundos.
- `date`: apenas `YYYY-MM-DD` UTC, como exige a propriedade. **Uma propriedade de tipo date não armazena hora.** Se deseja preservar o instante completo, confirme que a propriedade existente é `datetime`; o código não altera seu schema.
- Outro tipo ou schema indisponível: erro seguro, sem tentar adivinhar o formato.

## GTM e privacidade

Container preservado: `GTM-KW3WSNGQ`, com script e fallback `noscript`.

| Evento | Condição | Dados |
| --- | --- | --- |
| `journey_click` | CTA do hero para resultados | `placement`: hero; `destination`: resultados |
| `contact_click` | CTA do rodapé para o formulário | `placement`: footer |
| `contact_form_start` | Primeiro preenchimento do formulário | `form_provider`: hubspot |
| `generate_lead` | HTTP 200 com `success: true` da API | `form_provider`: hubspot |

Não há dados pessoais, respostas ou IDs de CRM nesses eventos. Tags/consentimento adicionais dentro do container são administrados pelo proprietário no GTM. Não foram criadas ou publicadas tags nessa conta.

O botão é bloqueado durante envio, inclusive contra submissões concorrentes. Em falha, os campos são preservados; em sucesso, são limpos e a mensagem de recebimento aparece na mesma seção.

## Visual e arquivos

- `index.html`: única página, metadados, conteúdo, formulário e redes sociais do rodapé.
- `src/main.ts`, `src/contact.ts`, `src/analytics.ts`: interações, envio e tracking sem PII.
- `src/styles/main.css`: design editorial preservado com a mudança solicitada para azul-marinho, telas com encaixe nativo de rolagem e adaptação móvel.
- `worker/index.ts`, `worker/validation.ts`, `worker/hubspot.ts`: roteamento, validação e integração.
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

O domínio principal é **https://luizgois.com/**. O título é **Luiz Gois | Engenharia de Produto, Software e IA Aplicada**. O build normal de produção gera:

- Descrição de busca, idioma pt-BR, título e descrição para compartilhamento, Open Graph e Twitter Card com o retrato de Luiz.
- Canonical absoluto e `og:url` apontando para a raiz, sem parâmetros UTM nem fragmentos das seções.
- JSON-LD com Person, WebSite e WebPage, nome, serviços descritos, retrato e perfis sociais reais. Não inclui números ilustrativos, avaliações ou resultados inventados.
- `robots.txt` permitindo rastreamento da landing e informando o sitemap; `/api/` fica fora do rastreamento.
- `sitemap.xml` contendo apenas a página canônica. Não há datas de atualização fictícias nem URLs separadas para cada seção.
- Conteúdo e metadados no HTML entregue pelo servidor, sem depender da execução de JavaScript pelo buscador. Um H1, títulos de seção, formulário com labels e retrato com dimensões e texto alternativo.
- Fonte local com preload; CSS/JS versionados pelo Vite. O retrato continua lazy loaded. O componente de exemplos fictícios foi removido. O mosaico usa apenas os resultados fornecidos por Luiz; o texto final está no HTML antes da animação.
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


## Ajustes editoriais e de rolagem — 4 de outubro de 2026

Removidos os textos acima dos títulos das seções, os complementos do hero, a faixa de prova repetida e o modelo de contratação. Títulos, método e apresentação pessoal seguem a nova redação. FAQ informa investimento médio em torno de R$ 8 mil, condicionado ao diagnóstico e escopo. Experiência técnica ampliada sem copiar avaliações ou recomendações do LinkedIn.

Rolagem: capítulos de pelo menos uma viewport no desktop com encaixe nativo obrigatório; seções maiores continuam com leitura interna natural. Em telas pequenas ou baixas, aproximação suave e altura livre. Movimento reduzido desativa o encaixe. Não há captura de wheel, biblioteca de scroll ou alteração do formulário.
