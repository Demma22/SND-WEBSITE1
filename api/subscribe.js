/**
 * POST /api/subscribe — add an address to the studio's list.
 *
 * Deliberately minimal: no accounts, no database, no third-party tracker. The
 * address is emailed to the studio, which owns the list outright.
 *
 * If RESEND_API_KEY is not configured this returns an honest error so the form
 * can tell the visitor to email instead. Silently accepting a signup and
 * dropping it would be worse than failing.
 */

const STUDIO_EMAIL = 'sndstudio.ug@gmail.com';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Never interpolate visitor input into HTML unescaped. */
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().slice(0, 254);

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn('[subscribe] RESEND_API_KEY is not set — signup not recorded');
      return res.status(503).json({
        error: 'Signups are not switched on yet. Please email the studio directly.',
      });
    }

    const safe = escapeHtml(email);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: STUDIO_EMAIL,
        reply_to: email,
        subject: `New community signup — ${email}`,
        html:
          `<p>Someone joined the SND community list.</p>` +
          `<p><strong>${safe}</strong></p>` +
          `<p>Added ${escapeHtml(new Date().toISOString())}</p>`,
      }),
    });

    if (!response.ok) {
      console.error('[subscribe] resend failed:', response.status, await response.text());
      return res.status(502).json({ error: 'Could not add you just now. Please email the studio.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[subscribe] error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please email the studio.' });
  }
}
