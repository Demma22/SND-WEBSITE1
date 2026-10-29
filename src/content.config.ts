import { defineCollection, z } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { serverClient } from './lib/supabase';

/**
 * Artworks — one row per piece in the Supabase `pieces` table, fetched once
 * at BUILD time. The site stays fully static: pages, price conversion and
 * structured data all work exactly as they did when this was a folder of
 * markdown files. Only the source of the facts moved.
 *
 * Publishing is therefore: save in the dashboard -> deploy hook -> rebuild.
 * Roughly a minute from pressing the button to the piece being live.
 *
 * The column names are snake_case because that is Postgres convention; they
 * are mapped here to the camelCase shape the rest of the site already speaks,
 * so no page or component had to learn anything new.
 */

/** A photo in Supabase Storage. Dimensions are recorded at upload, so the
 *  build never downloads an image just to find out how big it is. */
const remoteImage = z.object({
  src: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

interface PieceRow {
  slug: string;
  title: string;
  year: number;
  medium: string;
  width: string | number;
  height: string | number;
  kind: 'original' | 'print';
  collection: string | null;
  status: 'available' | 'reserved' | 'sold' | 'not-for-sale';
  price_ugx: string | number | null;
  price_usd: string | number | null;
  edition_size: number | null;
  edition_number: number | null;
  cover_url: string;
  cover_width: number;
  cover_height: number;
  gallery: { url: string; width: number; height: number }[] | null;
  payment_link: string | null;
  framed: boolean;
  featured: boolean;
  sort_order: number;
}

/* Postgres `numeric` arrives as a string, so every one of these goes through
   Number() — a price that stayed a string would fail schema validation and,
   worse, would sort and convert as text if it ever slipped through. */
const num = (v: string | number | null | undefined) =>
  v === null || v === undefined ? undefined : Number(v);

const toArtwork = (r: PieceRow) => ({
  title: r.title,
  year: r.year,
  medium: r.medium,
  width: Number(r.width),
  height: Number(r.height),
  kind: r.kind,
  collection: r.collection ?? undefined,
  status: r.status,
  priceUSD: num(r.price_usd),
  priceUGX: num(r.price_ugx),
  edition: r.edition_size
    ? { size: r.edition_size, number: r.edition_number ?? undefined }
    : undefined,
  cover: { src: r.cover_url, width: r.cover_width, height: r.cover_height },
  gallery: (r.gallery ?? []).map((g) => ({ src: g.url, width: g.width, height: g.height })),
  paymentLink: r.payment_link ?? undefined,
  framed: r.framed,
  featured: r.featured,
  order: r.sort_order,
});

function piecesLoader(): Loader {
  return {
    name: 'supabase-pieces',
    load: async ({ store, parseData, logger }) => {
      const { data, error } = await serverClient()
        .from('pieces')
        .select('*')
        .order('sort_order', { ascending: false });

      /* Throw, never fall back to an empty collection. A build that fails
         leaves the last good deploy serving; a build that "succeeds" with
         zero pieces would quietly replace the shop with an empty one. */
      if (error) {
        throw new Error(`Could not load artworks from Supabase: ${error.message}`);
      }

      store.clear();
      for (const row of data as PieceRow[]) {
        store.set({ id: row.slug, data: await parseData({ id: row.slug, data: toArtwork(row) }) });
      }

      if (!data.length) {
        logger.warn('No pieces in Supabase — the shop and gallery will build empty.');
      } else {
        logger.info(`Loaded ${data.length} pieces from Supabase.`);
      }
    },
  };
}

const artworks = defineCollection({
  loader: piecesLoader(),
  schema: z.object({
    title: z.string(),
    year: z.number(),
    medium: z.string(),

    /** Physical size of the work itself, in cm. */
    width: z.number(),
    height: z.number(),

    kind: z.enum(['original', 'print']),

    /** Groups related work under one heading, e.g. "Volume 1". */
    collection: z.string().optional(),
    status: z.enum(['available', 'reserved', 'sold', 'not-for-sale']),

    /** One or the other. Whichever is set is the exact figure shown in that
     *  currency; every other currency is derived from it. Neither set reads
     *  "Price on request". */
    priceUSD: z.number().positive().optional(),
    priceUGX: z.number().positive().optional(),

    /** Prints only. */
    edition: z
      .object({ size: z.number().int().positive(), number: z.number().int().positive().optional() })
      .optional(),

    cover: remoteImage,
    gallery: z.array(remoteImage).default([]),

    paymentLink: z.string().url().optional(),
    framed: z.boolean().default(false),
    featured: z.boolean().default(false),

    /** Manual ordering within a listing; higher sorts first. */
    order: z.number().default(0),
  }),
});

export const collections = { artworks };
