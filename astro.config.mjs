// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://sndstudio-ug.com',
  // /studio is the private dashboard — keep it out of the sitemap as well as
  // out of search (it also carries a noindex meta).
  integrations: [sitemap({ filter: (page) => !page.includes('/studio') })],
  // The collections moved up to the root when they went into the main nav.
  // /art itself stays put — that link is in the studio's Instagram bio.
  redirects: {
    '/art/originals': '/originals',
    '/art/prints': '/prints',
    '/art/commissions': '/commissions',
    '/art/gallery': '/gallery',
  },
  image: {
    /* Artwork photos live in Supabase Storage, so they are remote images.
       Astro will only optimise a remote image whose host is allowed here —
       without this it passes the original straight through, which would mean
       shipping a 3MB phone photo to every visitor instead of a WebP set. */
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});