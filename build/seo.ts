import type { Plugin } from 'vite';

export function publicSiteUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.hostname.includes('.') || url.hostname === 'localhost') {
    throw new Error('SITE_URL must be an HTTPS public origin without a path, credentials, query or fragment.');
  }
  return url.origin + '/';
}

export function seoPlugin(siteUrl?: string): Plugin {
  const url = publicSiteUrl(siteUrl);
  return {
    name: 'landing-seo',
    transformIndexHtml() {
      const tags: import('vite').HtmlTagDescriptor[] = [
        { tag: 'meta', attrs: { name: 'robots', content: url ? 'index, follow, max-image-preview:large' : 'noindex, nofollow' }, injectTo: 'head' },
      ];
      if (!url) return tags;
      const image = url + 'assets/luiz-gois.jpg';
      tags.push(
        { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Luiz Gois, engenheiro de software e especialista em IA aplicada' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: 'Retrato de Luiz Gois' }, injectTo: 'head' },
        { tag: 'script', attrs: { type: 'application/ld+json' }, injectTo: 'head', children: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Person', '@id': url + '#luiz', name: 'Luiz Gois', url, image, jobTitle: 'Senior Software Engineer', description: 'Engenharia de software, IA aplicada e desenvolvimento de produtos digitais.', sameAs: ['https://www.linkedin.com/in/euluizgois/', 'https://x.com/euluizgois', 'https://www.instagram.com/euluizgois/'] },
            { '@type': 'WebSite', '@id': url + '#website', url, name: 'Luiz Gois | Software e IA', alternateName: 'Luiz Gois', inLanguage: 'pt-BR', publisher: { '@id': url + '#luiz' } },
            { '@type': 'WebPage', '@id': url + '#webpage', url, name: 'Luiz Gois | Software e IA', inLanguage: 'pt-BR', isPartOf: { '@id': url + '#website' }, about: { '@id': url + '#luiz' }, description: 'Software personalizado, agentes de IA e automações para melhorar engajamento, conversão e retenção.' },
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
