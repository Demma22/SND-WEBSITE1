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

/** A collection page: one `kind`, available work surfaced first. */
export async function artworksByKind(kind: 'original' | 'print'): Promise<Artwork[]> {
  return (await getCollection('artworks', ({ data }) => data.kind === kind)).sort(byAvailability);
}

export async function featuredArtworks(limit = 4): Promise<Artwork[]> {
  const featured = (await getCollection('artworks', ({ data }) => data.featured)).sort(byDisplayOrder);
  // Fall back to the newest work if nothing is flagged, so the hub is never bare.
  if (featured.length >= limit) return featured.slice(0, limit);
  const rest = (await allArtworks()).filter((p) => !p.data.featured);
  return [...featured, ...rest].slice(0, limit);
}

/** Other pieces to show at the foot of a detail page. */
export async function relatedArtworks(current: Artwork, limit = 4): Promise<Artwork[]> {
  const pool = (await getCollection('artworks', ({ id }) => id !== current.id)).sort(byAvailability);
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
