-- ─────────────────────────────────────────────────────────────────────────
-- Artwork image storage
--
-- Photos live here instead of in git. That is the main reason for moving off
-- markdown: a committed image is permanent in git history, so at ~600KB a
-- painting the repo would grow forever and could never be shrunk back.
--
-- The bucket is PUBLIC on purpose — these URLs are served to every visitor,
-- and Astro downloads them at build time to generate the responsive WebP
-- variants. Public read, signed-in write.
--
-- Run this after 0001 in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'art', 'art', true,
  15728640,  -- 15MB: a phone photo straight out of the camera fits
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone can view art"        on storage.objects;
drop policy if exists "signed-in users write art"  on storage.objects;

create policy "anyone can view art"
  on storage.objects for select
  using (bucket_id = 'art');

create policy "signed-in users write art"
  on storage.objects for all to authenticated
  using      (bucket_id = 'art')
  with check (bucket_id = 'art');
