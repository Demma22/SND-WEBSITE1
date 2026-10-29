/**
 * Supabase clients.
 *
 * Two of them, and the distinction matters:
 *
 *   serverClient()  — service_role key. Bypasses row level security, so it
 *                     must only ever run where the user cannot see it: the
 *                     build, and api/ functions. Importing this into anything
 *                     that ships to the browser would hand every visitor full
 *                     write access to the database.
 *
 *   browserClient() — anon key, safe to publish. The dashboard runs on this,
 *                     and RLS (see supabase/migrations/0001_pieces.sql) means
 *                     it can read and write only once signed in.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/** Thrown with the variable name, because "fetch failed" is a useless build log. */
function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env for local builds and to the Vercel ` +
      `project's environment variables for deploys.`
    );
  }
  return value;
}

let cached: SupabaseClient | null = null;

/** Build-time / server-side only. Never import from a client script. */
export function serverClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    required(url, 'PUBLIC_SUPABASE_URL'),
    required(import.meta.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    // No session to persist or refresh in a build process.
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return cached;
}

/** For the dashboard. Safe to run in the browser. */
export function browserClient(): SupabaseClient {
  return createClient(
    required(url, 'PUBLIC_SUPABASE_URL'),
    required(anonKey, 'PUBLIC_SUPABASE_ANON_KEY')
  );
}

/** Public URL of a file in the `art` bucket. */
export function artUrl(path: string): string {
  return `${required(url, 'PUBLIC_SUPABASE_URL')}/storage/v1/object/public/art/${path}`;
}
