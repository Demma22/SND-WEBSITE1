-- ─────────────────────────────────────────────────────────────────────────
-- SND art shop — content store
--
-- Mirrors the frontmatter schema the site already uses (see the comments in
-- src/content.config.ts, which this replaces as the source of truth). The
-- site fetches these rows at BUILD time and stays fully static, so nothing
-- about how pages render, how prices convert, or how structured data is
-- emitted changes — only where the facts come from.
--
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists pieces (
  id          uuid primary key default gen_random_uuid(),

  -- Becomes /art/<slug>. Unique because it is a URL.
  slug        text not null unique,

  title       text not null,
  year        int  not null,
  medium      text not null,

  -- Size of the physical work, in cm. numeric, not int: A4 is 29.7 tall.
  width       numeric not null check (width  > 0),
  height      numeric not null check (height > 0),

  kind        text not null check (kind in ('original', 'print')),

  -- Groups related work under one heading: 'Volume 1', 'Face Collection'.
  -- Null means the piece stands on its own.
  collection  text,

  status      text not null
              check (status in ('available', 'reserved', 'sold', 'not-for-sale')),

  -- Write ONE of these. price_ugx is for work priced locally: that exact
  -- figure is what UGX visitors see and every other currency is derived
  -- from it. Both null -> "Price on request".
  price_ugx   numeric check (price_ugx > 0),
  price_usd   numeric check (price_usd > 0),

  -- Prints only.
  edition_size   int check (edition_size   > 0),
  edition_number int check (edition_number > 0),

  -- Public Storage URL plus the pixel dimensions, captured at upload.
  -- Storing them means the build never has to download an image just to
  -- learn how big it is.
  cover_url    text not null,
  cover_width  int  not null,
  cover_height int  not null,

  -- Extra views (detail shots, the piece in a room):
  -- [{ "url": "...", "width": 1600, "height": 1600 }]
  gallery      jsonb not null default '[]'::jsonb,

  -- A fixed-amount payment link makes "Buy now" appear for this piece alone.
  payment_link text,

  framed      boolean not null default false,
  featured    boolean not null default false,

  -- Manual ordering within a listing; higher sorts first.
  sort_order  int not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A price that is not for sale is a contradiction; so is an edition on a
-- one-of-one. Catch both here rather than hoping the form is never wrong.
alter table pieces drop constraint if exists pieces_price_requires_sale;
alter table pieces add  constraint pieces_price_requires_sale
  check (status <> 'not-for-sale' or (price_ugx is null and price_usd is null));

alter table pieces drop constraint if exists pieces_edition_is_print_only;
alter table pieces add  constraint pieces_edition_is_print_only
  check (kind = 'print' or (edition_size is null and edition_number is null));

create index if not exists pieces_status_idx     on pieces (status);
create index if not exists pieces_kind_idx       on pieces (kind);
create index if not exists pieces_collection_idx on pieces (collection);

-- Keep updated_at honest without having to remember it in the form.
create or replace function touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists pieces_touch_updated_at on pieces;
create trigger pieces_touch_updated_at
  before update on pieces
  for each row execute function touch_updated_at();

-- ── Row level security ──
-- The dashboard runs in the browser with the anon key, so the anon role must
-- have NO access at all: every write is gated on being signed in. The build
-- reads with the service_role key, which bypasses RLS entirely and is only
-- ever set as a Vercel environment variable — never shipped to the browser.
alter table pieces enable row level security;

drop policy if exists "signed-in users read pieces"  on pieces;
drop policy if exists "signed-in users write pieces" on pieces;

create policy "signed-in users read pieces"
  on pieces for select to authenticated using (true);

create policy "signed-in users write pieces"
  on pieces for all to authenticated using (true) with check (true);
