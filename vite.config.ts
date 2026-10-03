import { defineConfig, loadEnv } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { seoPlugin } from './build/seo.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SITE_');
  return { plugins: [cloudflare(), seoPlugin(mode === 'production' ? (env.SITE_URL || 'https://luizgois.com/') : undefined)] };
});
