import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Artworks — one markdown file per piece in src/content/artworks/.
 * Frontmatter carries the facts; the body (optional) is the piece's story,
 * rendered on its detail page.
 *
 * Prices are authored once, in USD, and every other currency is derived at
 * build time (see src/lib/money.ts). Omit `priceUSD` and the piece reads
 * "Price on request" rather than showing an invented number.
 *
 * Images live here in src/ (not public/) so Astro's image pipeline can
 * generate responsive WebP variants from them automatically.
 */
const artworks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/artworks' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      year: z.number(),
      medium: z.string(),

      // Physical size of the work itself, in cm
      width: z.number(),
      height: z.number(),

      kind: z.enum(['original', 'print']),

      /**
       * Groups related work under one name, e.g. "Face Collection". Pieces
       * that share a collection are listed together under its heading;
       * anything without one is listed on its own.
       */
      collection: z.string().optional(),
      status: z.enum(['available', 'reserved', 'sold', 'not-for-sale']),

      /**
       * Price. Write ONE of these.
       *
       * priceUGX is the one to use for work priced locally: the figure you
       * write is shown to UGX visitors exactly, and every other currency is
       * derived from it. priceUSD does the same the other way round.
       *
       * Omit both → "Price on request".
       */
      priceUSD: z.number().positive().optional(),
      priceUGX: z.number().positive().optional(),

      /** Prints only: edition size, and this piece's number within it. */
      edition: z
        .object({
          size: z.number().int().positive(),
          number: z.number().int().positive().optional(),
        })
        .optional(),

      cover: image(),
      /** Extra views — detail shots, the piece in a room, framing. */
      gallery: z.array(image()).default([]),

      /**
       * Paste a Flutterwave (or any) fixed-amount payment link here and a
       * "Buy now" button appears for this piece alone. Absent → enquiry only.
       */
      paymentLink: z.string().url().optional(),

      framed: z.boolean().default(false),
      featured: z.boolean().default(false),

      /** Manual ordering within a collection; higher sorts first. */
      order: z.number().default(0),
    }),
});

export const collections = { artworks };
