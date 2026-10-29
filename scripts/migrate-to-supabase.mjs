/**
 * One-off: move the markdown artworks into Supabase.
 *
 * Reads every src/content/artworks/*.md, uploads its images to the `art`
 * storage bucket, and upserts a row per piece. Safe to re-run — it keys on
 * the slug and overwrites, so a half-finished run just gets finished.
 *
 *   node --env-file=.env scripts/migrate-to-supabase.mjs --dry-run
 *   node --env-file=.env scripts/migrate-to-supabase.mjs
 *
 * The markdown files are left alone. Delete them only once the site has
 * built green off Supabase — they are the only copy of this content until
 * then.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const CONTENT_DIR = 'src/content/artworks';
const DRY = process.argv.includes('--dry-run');

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Run with: node --env-file=.env scripts/migrate-to-supabase.mjs');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/** Frontmatter only — the body is the piece's story and nothing reads it. */
function frontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error('no frontmatter');
  return parseYaml(m[1]);
}

/** Upload one image and return what the database needs to render it. */
async function putImage(slug, relPath) {
  const local = path.resolve(CONTENT_DIR, relPath);
  const buf = await readFile(local);
  const { width, height } = await sharp(buf).metadata();
  const key = `${slug}/${path.basename(local)}`;

  if (!DRY) {
    const { error } = await db.storage.from('art').upload(key, buf, {
      contentType: `image/${path.extname(local).slice(1).replace('jpg', 'jpeg')}`,
      upsert: true,
    });
    if (error) throw new Error(`upload ${key}: ${error.message}`);
  }
  return { url: `${url}/storage/v1/object/public/art/${key}`, width, height };
}

const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md')).sort();
console.log(`${files.length} pieces${DRY ? ' (dry run — nothing will be written)' : ''}\n`);

let ok = 0;
for (const file of files) {
  const slug = path.basename(file, '.md');
  try {
    const fm = frontmatter(await readFile(path.join(CONTENT_DIR, file), 'utf8'));

    const cover = await putImage(slug, fm.cover);
    const gallery = [];
    for (const g of fm.gallery ?? []) gallery.push(await putImage(slug, g));

    const row = {
      slug,
      title: fm.title,
      year: fm.year,
      medium: fm.medium,
      width: fm.width,
      height: fm.height,
      kind: fm.kind,
      collection: fm.collection ?? null,
      status: fm.status,
      price_ugx: fm.priceUGX ?? null,
      price_usd: fm.priceUSD ?? null,
      edition_size: fm.edition?.size ?? null,
      edition_number: fm.edition?.number ?? null,
      cover_url: cover.url,
      cover_width: cover.width,
      cover_height: cover.height,
      gallery,
      payment_link: fm.paymentLink ?? null,
      framed: fm.framed ?? false,
      featured: fm.featured ?? false,
      sort_order: fm.order ?? 0,
    };

    if (!DRY) {
      const { error } = await db.from('pieces').upsert(row, { onConflict: 'slug' });
      if (error) throw new Error(error.message);
    }

    const extra = gallery.length ? ` +${gallery.length} view${gallery.length > 1 ? 's' : ''}` : '';
    console.log(`  ok   ${slug.padEnd(22)} ${fm.status.padEnd(13)} ${cover.width}x${cover.height}${extra}`);
    ok++;
  } catch (err) {
    console.error(`  FAIL ${slug.padEnd(22)} ${err.message}`);
  }
}

console.log(`\n${ok}/${files.length} migrated.`);
process.exit(ok === files.length ? 0 : 1);
