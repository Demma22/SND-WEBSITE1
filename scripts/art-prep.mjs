/**
 * art:prep — turn raw photos of artwork into committable assets.
 *
 * Drop full-size photos into `art-src/` (they stay out of git), run
 * `npm run art:prep`, and each one lands in `src/assets/art/` as a WebP no
 * larger than MAX_EDGE, with EXIF stripped. Astro's image pipeline generates
 * the responsive variants from there — this step exists only so a 5MB phone
 * photo never enters the repo.
 *
 *   art-src/tiger.jpg  ->  src/assets/art/tiger.webp
 *
 * Re-running skips files whose output is already newer than the source, so it
 * is cheap to run after adding a single painting.
 */
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = 'art-src';
const OUT_DIR = 'src/assets/art';
/* The detail page renders at most 1200px wide, so a 2000px master leaves
   comfortable headroom while keeping the committed file well under 1MB —
   these accumulate in git one painting at a time. */
const MAX_EDGE = 2000;
const QUALITY  = 80;

const INPUT_RE = /\.(jpe?g|png|tiff?|webp|heic)$/i;

/** "Tiger Study.JPG" -> "tiger-study" */
const slugify = (name) =>
  path.basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function newer(src, out) {
  try {
    const [a, b] = await Promise.all([stat(src), stat(out)]);
    return b.mtimeMs > a.mtimeMs;
  } catch {
    return false;   // no output yet
  }
}

const files = await readdir(SRC_DIR).catch(() => {
  console.error(`No ${SRC_DIR}/ directory — create it and drop photos in.`);
  process.exit(1);
});

const images = files.filter((f) => INPUT_RE.test(f));
if (!images.length) {
  console.log(`Nothing to do — put artwork photos in ${SRC_DIR}/`);
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });

let done = 0;
let skipped = 0;

for (const file of images) {
  const src = path.join(SRC_DIR, file);
  const out = path.join(OUT_DIR, `${slugify(file)}.webp`);

  if (await newer(src, out)) {
    skipped++;
    continue;
  }

  const info = await sharp(src)
    // rotate() first: phone photos carry EXIF orientation, and in sharp the
    // order of rotate/resize is significant. Also strips the EXIF block.
    .rotate()
    // withoutEnlargement: a photo already under MAX_EDGE is left at its size
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);

  const kb = Math.round(info.size / 1024);
  console.log(`  ${file}  ->  ${out}  (${info.width}x${info.height}, ${kb}KB)`);
  done++;
}

console.log(`\nart:prep — ${done} processed, ${skipped} already current.`);
if (done) console.log(`Reference them in frontmatter as: cover: ../../assets/art/<name>.webp`);
