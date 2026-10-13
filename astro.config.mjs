// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://sndstudio-ug.com',
  integrations: [sitemap()],
  // The collections moved up to the root when they went into the main nav.
  // /art itself stays put — that link is in the studio's Instagram bio.
  redirects: {
    '/art/originals': '/originals',
    '/art/prints': '/prints',
    '/art/commissions': '/commissions',
    '/art/gallery': '/gallery',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});