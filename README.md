# Luiz Gois — landing page de serviços

Página única em português para apresentar serviços de engenharia de produto e IA aplicada, resultados da atuação na Woke, trajetória e contato. HTML, CSS e JavaScript nativos, sem dependências npm de produção ou etapa de instalação.

## Desenvolvimento e publicação

Requer Node.js 22 ou superior.

```sh
npm run dev     # http://127.0.0.1:4173
npm run check   # sintaxe, testes e build
npm run build  # arquivos públicos em dist/
```

Publique **somente `dist/`** em uma hospedagem estática. Os caminhos são relativos e funcionam em subdiretórios. O servidor de desenvolvimento é local e não expõe `.git`, testes ou arquivos de configuração privados. Não há pipeline de deploy automático ou promoção de produção nesta entrega.

## Ativar Typeform dentro da página

O cliente poderá preencher o formulário incorporado na seção de contato, sem sair da landing page. As respostas serão consultadas na conta do proprietário do formulário, em **Results → Responses**. Isso é uma caixa de respostas; para um funil comercial completo, considere posteriormente conectar um CRM.

1. Na sua conta Typeform, crie e publique um formulário com nome, e-mail, empresa/produto, descrição do desafio e aceite para uso dos dados na resposta ao contato. Não inclua inscrição em marketing por padrão.
2. Use português e configure o tema com fundo `#eeede7`, texto `#20231e` e botões `#20231e`. O conteúdo dentro do iframe usa o tema do Typeform; o CSS da landing page não o altera. Branding e limites dependem do plano contratado.
3. Cole o link público `https://SUA-CONTA.typeform.com/to/ID` em `contactConfig.typeformUrl`, no arquivo `config.js`. Use o link público padrão, não o link do editor, nem uma chave de API.
4. Habilite notificações de novas respostas na conta Typeform, se desejar recebê-las por e-mail.
5. Gere `dist/` novamente e, após publicar, faça um envio identificado como teste. Confirme a resposta em **Results → Responses**, a notificação (se ativada) e o evento `generate_lead` no Tag Assistant.

O SDK oficial é carregado de `https://embed.typeform.com/next/embed.js` somente quando existe uma URL válida. Essa é uma dependência externa de execução, além do GTM. Nenhuma credencial é necessária no cliente. O site mantém alternativa por e-mail em caso de falha no carregamento do embed e um link para abrir o formulário em outra aba.

**Estado inicial:** o link Typeform ainda não foi fornecido. O formulário local apenas prepara um rascunho no aplicativo de e-mail do visitante, com indicação explícita de que o envio precisa ser confirmado lá. Ele não salva respostas, não envia automaticamente e não gera uma conversão de lead. É uma alternativa provisória, não a integração Typeform ativa.

## Google Tag Manager

Container `GTM-KW3WSNGQ`, com script no `<head>` e fallback `noscript` no início do `<body>`.

Eventos personalizados em `window.dataLayer`:

| Evento | Quando | Parâmetros |
| --- | --- | --- |
| `contact_click` | Clique em um CTA de contato | `placement`: header, hero ou email |
| `contact_form_start` | Primeiro preenchimento ou callback de início do Typeform | `form_provider`: email ou typeform |
| `contact_email_draft` | Preparação de rascunho; **não é um envio** | `form_provider`: email |
| `generate_lead` | Callback oficial de envio bem-sucedido do Typeform | `form_provider`: typeform |

Respostas repetidas com o mesmo ID são deduplicadas em memória para evitar dupla conversão na mesma página. Não são enviados nomes, e-mails, empresas, mensagens ou IDs de respostas nesses eventos. Regras de tags e consentimento dentro do container são administradas na conta GTM; incluir o snippet não cria tags GA4 nem publica mudanças nessa conta.

## Design e conteúdo

- [bernardo.vc](https://bernardo.vc/): hierarquia editorial, estrutura numerada e apresentação pessoal.
- [Decade](https://decade.com/): ritmo de leitura, composição clara e métricas como evidência.
- [Pax](https://pax.ai/): escala tipográfica, contraste e comunicação direta de impacto.
- Textos e indicadores adaptados exclusivamente dos dados fornecidos por Luiz Gois. Nenhum depoimento ou cliente inventado.
- Foto obtida do perfil público `developerluizgois` no GitHub. Substitua `assets/luiz-gois.jpg` para usar um retrato de maior resolução.
- Fonte Geist distribuída localmente sob SIL Open Font License, incluída em `assets/OFL-Geist.txt`.

## Validação e pendências

Testes automatizados cobrem URLs permitidas para Typeform, codificação do rascunho de e-mail, callbacks de conversão, deduplicação e exclusão de dados pessoais dos eventos personalizados.

Ainda é necessária a validação ponta a ponta com um formulário Typeform real após preencher `typeformUrl`. Valide também as tags e conversões no container GTM após o deploy no domínio definitivo. A política de privacidade descreve o comportamento do código entregue; revise-a se adicionar novas tags ou integrações.

Documentação: [embed inline](https://www.typeform.com/developers/embed/inline/), [callbacks](https://www.typeform.com/developers/embed/callbacks/), [painel de respostas](https://help.typeform.com/hc/en-us/articles/360029253732-Working-with-your-responses), [notificações](https://help.typeform.com/hc/en-us/articles/53791144736148-Receive-email-notifications-from-form-responses).
