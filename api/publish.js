/**
 * POST /api/publish — rebuild the live site.
 *
 * The dashboard saves straight to Supabase, but the site is static and only
 * shows those rows once it rebuilds. This is that trigger.
 *
 * It exists so the deploy hook URL does not have to. A hook URL is a password:
 * anyone holding it can start builds. Reaching it from the dashboard directly
 * would mean a PUBLIC_ variable, and PUBLIC_ variables are compiled into the
 * page, where any visitor to /studio could read it out of the source and spend
 * the account's build minutes. Here the URL stays on the server and the caller
 * has to prove it is signed in first.
 *
 * Needs DEPLOY_HOOK_URL — no PUBLIC_ prefix, which is the point.
 */

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hook = process.env.DEPLOY_HOOK_URL;
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!hook || !supabaseUrl || !anonKey) {
    console.warn('[publish] missing env:', {
      DEPLOY_HOOK_URL: Boolean(hook),
      PUBLIC_SUPABASE_URL: Boolean(supabaseUrl),
      PUBLIC_SUPABASE_ANON_KEY: Boolean(anonKey),
    });
    return res.status(503).json({ error: 'Publishing is not configured yet.' });
  }

  try {
    /* Ask Supabase whether this token belongs to a real, current session.
       Verifying the signature here instead would mean holding the JWT secret
       and reimplementing expiry and revocation checks; one request to the
       issuer answers all of it, and a signed-out or expired token fails. */
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in first.' });

    const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!who.ok) {
      return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    }

    const build = await fetch(hook, { method: 'POST' });
    if (!build.ok) {
      console.error('[publish] deploy hook failed:', build.status, await build.text());
      return res.status(502).json({ error: 'Could not start the build. Try again shortly.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[publish] error:', err);
    return res.status(500).json({ error: 'Something went wrong starting the build.' });
  }
}
