/**
 * Shared queries over the artworks collection, so every page sorts the same
 * way instead of each one re-deriving it.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Artwork = CollectionEntry<'artworks'>;

/** Manual `order` wins, then newest, then alphabetical as a stable tiebreak. */
const byDisplayOrder = (a: Artwork, b: Artwork) =>
  b.data.order - a.data.order ||
  b.data.year - a.data.year ||
  a.data.title.localeCompare(b.data.title);

/** For sale first, then reserved, then the history. */
const AVAILABILITY_RANK = { available: 0, reserved: 1, sold: 2, 'not-for-sale': 3 } as const;

const byAvailability = (a: Artwork, b: Artwork) =>
  AVAILABILITY_RANK[a.data.status] - AVAILABILITY_RANK[b.data.status] || byDisplayOrder(a, b);

export async function allArtworks(): Promise<Artwork[]> {
  return (await getCollection('artworks')).sort(byDisplayOrder);
}

/**
 * A shop page: one `kind`, available work first. Archive pieces are excluded —
 * sold work stays listed as part of the record, but a sketchbook page that was
 * never for sale does not belong on a page of things to buy.
 */
export async function artworksByKind(kind: 'original' | 'print'): Promise<Artwork[]> {
  return (
    await getCollection('artworks', ({ data }) => data.kind === kind && data.status !== 'not-for-sale')
  ).sort(byAvailability);
}

/** The gallery: the sketchbook pages, and anything else kept but not sold. */
export async function archiveArtworks(): Promise<Artwork[]> {
  return (await getCollection('artworks', ({ data }) => data.status === 'not-for-sale')).sort(byDisplayOrder);
}

/** Work that is, or once was, for sale — what the homepage teaser shows. */
export async function sellableArtworks(): Promise<Artwork[]> {
  return (await getCollection('artworks', ({ data }) => data.status !== 'not-for-sale')).sort(byDisplayOrder);
}

export async function featuredArtworks(limit = 4): Promise<Artwork[]> {
  const sellable = await sellableArtworks();
  const featured = sellable.filter((p) => p.data.featured);
  // Fall back to the newest work if nothing is flagged, so the hub is never bare.
  if (featured.length >= limit) return featured.slice(0, limit);
  return [...featured, ...sellable.filter((p) => !p.data.featured)].slice(0, limit);
}

/** Other pieces to show at the foot of a detail page. */
export async function relatedArtworks(current: Artwork, limit = 4): Promise<Artwork[]> {
  const pool = (await getCollection('artworks',
    ({ id, data }) => id !== current.id && data.status !== 'not-for-sale')).sort(byAvailability);
  const sameKind = pool.filter((p) => p.data.kind === current.data.kind);
  return [...sameKind, ...pool.filter((p) => p.data.kind !== current.data.kind)].slice(0, limit);
}

/** Headline counts for the hub. */
export async function artworkCounts() {
  const all = await getCollection('artworks');
  return {
    total: all.length,
    originals: all.filter((p) => p.data.kind === 'original').length,
    prints: all.filter((p) => p.data.kind === 'print').length,
    available: all.filter((p) => p.data.status === 'available').length,
  };
}

/**
 * Split a listing into standalone pieces and named collections.
 *
 * Singles come first so individual work still leads the page, then each
 * collection in the order its strongest piece sorts. Keeps a set like the
 * Face Collection reading as one body of work rather than four loose items.
 */
export function groupByCollection(pieces: Artwork[]) {
  const singles: Artwork[] = [];
  const groups = new Map<string, Artwork[]>();

  for (const piece of pieces) {
    const name = piece.data.collection;
    if (!name) singles.push(piece);
    else groups.set(name, [...(groups.get(name) ?? []), piece]);
  }

  return { singles, collections: [...groups.entries()].map(([name, items]) => ({ name, items })) };
}
