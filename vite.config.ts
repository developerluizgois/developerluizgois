import { defineConfig, loadEnv } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { seoPlugin } from './build/seo.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SITE_');
  return {
    plugins: [cloudflare(), seoPlugin(mode === 'production' ? (env.SITE_URL || 'https://luizgois.com/') : undefined)],
    // Two pages, same CSS and scripts: companies at / and professionals at /mentoria/.
    environments: { client: { build: { rollupOptions: { input: { main: 'index.html', mentoria: 'mentoria/index.html' } } } } },
  };
});
