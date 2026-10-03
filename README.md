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
| `contact_click` | CTA da abertura ou do rodapé | `placement`: hero/footer |
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

O scroll usa `scroll-snap` nativo: seções de no mínimo uma tela e encaixe obrigatório no desktop; aproximação no celular para permitir leitura de seções longas e preenchimento com teclado aberto. Conteúdo que ultrapassa uma tela continua acessível. `prefers-reduced-motion` desativa o encaixe e animações. Não existe captura de eventos wheel nem bloqueio de rolagem.

Somente LinkedIn, X e Instagram aparecem como links externos na página, todos no rodapé. A imagem nova é preservada em sua versão original; o recorte é responsivo via CSS. A fonte Geist é servida localmente sob a licença incluída.

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
