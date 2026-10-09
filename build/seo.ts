import type { Plugin } from 'vite';

export function publicSiteUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.hostname.includes('.') || url.hostname === 'localhost') {
    throw new Error('SITE_URL must be an HTTPS public origin without a path, credentials, query or fragment.');
  }
  return url.origin + '/';
}

const decode = (text: string) => text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plain = (html: string) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// Reads the visible FAQ so the structured data can never drift from the page text.
export function faqFromHtml(html: string): { question: string; answer: string }[] {
  return [...html.matchAll(/<details class="faq-item"[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map(([, question, answer]) => ({ question: plain(question), answer: plain(answer) }));
}

// Services as named on the page's capability panels; no prices, ratings or results.
const services = [
  ['Ativação e onboarding', 'Análise de comportamento, UX e perfil de quem se cadastra, do signup ao onboarding, para mais usuários chegarem ao primeiro valor do produto.'],
  ['Conversão e monetização', 'Correção das fricções que impedem o lead de converter e estratégias de monetização para quem usa e ainda não paga.'],
  ['Retenção e churn', 'Rotinas de comunicação in-app, por email e WhatsApp, personalizadas pelo comportamento de cada cliente, para agir antes do cancelamento.'],
  ['Integrações e dados', 'Conexão de CRM, base de dados, conversas com clientes e documentos da operação em um único ambiente.'],
  ['Atendimento e automação no WhatsApp', 'Canal que responde em linguagem natural, faz follow-up, tira dúvidas, vende e agenda.'],
  ['Agentes de IA', 'Agentes de IA treinados com a dinâmica do negócio, que mostram onde agir primeiro.'],
] as const;

// Real pixel sizes; keep in sync if the files change. The 1200×630 card is for link previews;
// the portrait stays as the Person image, where Google expects a photo of the person.
const ogImage = { path: 'assets/luiz-gois-social.jpg', width: 1200, height: 630, type: 'image/jpeg', alt: 'Luiz Gois: mais usuários ativando, pagando e ficando. Growth e engenharia de produto para SaaS.' };
const portrait = 'assets/luiz-gois-og.jpg';

export function seoPlugin(siteUrl?: string): Plugin {
  const url = publicSiteUrl(siteUrl);
  return {
    name: 'landing-seo',
    transformIndexHtml(html) {
      const tags: import('vite').HtmlTagDescriptor[] = [
        { tag: 'meta', attrs: { name: 'robots', content: url ? 'index, follow, max-image-preview:large' : 'noindex, nofollow' }, injectTo: 'head' },
      ];
      if (!url) return tags;
      const image = url + ogImage.path;
      const faq = faqFromHtml(html);
      tags.push(
        { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:width', content: String(ogImage.width) }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:height', content: String(ogImage.height) }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:type', content: ogImage.type }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: ogImage.alt }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: ogImage.alt }, injectTo: 'head' },
        { tag: 'script', attrs: { type: 'application/ld+json' }, injectTo: 'head', children: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Person', '@id': url + '#luiz', name: 'Luiz Gois', url, image: url + portrait, jobTitle: 'Engenheiro de produto e growth', description: 'Engenheiro de produto e growth há mais de 6 anos, construindo ativação, conversão e retenção para empresas de software.', sameAs: ['https://www.linkedin.com/in/euluizgois/', 'https://x.com/euluizgois', 'https://www.instagram.com/euluizgois/'],
              knowsAbout: ['Engenharia de produto', 'Growth', 'Ativação de usuários', 'Onboarding', 'Conversão', 'Monetização', 'Retenção', 'Churn', 'Inteligência artificial', 'Automação de WhatsApp'],
              makesOffer: services.map(([name, description]) => ({ '@type': 'Offer', areaServed: { '@type': 'Country', name: 'Brasil' }, itemOffered: { '@type': 'Service', name, description, provider: { '@id': url + '#luiz' } } })) },
            { '@type': 'WebSite', '@id': url + '#website', url, name: 'Luiz Gois', alternateName: 'luizgois.com', inLanguage: 'pt-BR', publisher: { '@id': url + '#luiz' } },
            { '@type': 'WebPage', '@id': url + '#webpage', url, name: 'Luiz Gois | Estrutura de venda para software e produtos digitais', inLanguage: 'pt-BR', isPartOf: { '@id': url + '#website' }, about: { '@id': url + '#luiz' }, primaryImageOfPage: { '@type': 'ImageObject', url: image, width: ogImage.width, height: ogImage.height }, description: 'Qualquer um constrói um site. Uso engenharia, dados e IA para construir a estrutura que faz seu site, seu produto e sua comunicação venderem, engajarem e reterem clientes.' },
            ...(faq.length ? [{ '@type': 'FAQPage', '@id': url + '#perguntas', url: url + '#perguntas', inLanguage: 'pt-BR', isPartOf: { '@id': url + '#webpage' }, mainEntity: faq.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }] : []),
          ],
        }).replace(/</g, '\\u003c') },
      );
      return tags;
    },
    generateBundle() {
      if (this.environment.name !== 'client') return;
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: url
        ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${url}sitemap.xml\n`
        : 'User-agent: *\nAllow: /\n# Preview: HTML is marked noindex until SITE_URL is configured.\n' });
      if (url) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url}</loc></url></urlset>\n` });
    },
  };
}
