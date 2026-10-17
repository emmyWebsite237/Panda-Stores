/**
 * POST /api/admin/login   { password }
 * GET  /api/admin/login   → { authed, usingDefaultPassword }
 */

import { adminPassword, setSessionCookie, isAuthed, usingDefaultPassword, timingSafeEqualStrings } from '../_lib/auth.js';
import { readBody, str } from '../_lib/util.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      authed: isAuthed(req),
      usingDefaultPassword: usingDefaultPassword(),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = readBody(req);
  const password = str(body.password, 200);

  if (!password) {
    return res.status(400).json({ ok: false, error: 'Enter the admin password' });
  }

  // A tiny delay makes brute-force attempts meaningfully slower.
  await new Promise((r) => setTimeout(r, 250));

  if (!timingSafeEqualStrings(password, adminPassword())) {
    return res.status(401).json({ ok: false, error: 'Wrong password. Try again.' });
  }

  setSessionCookie(res);
  return res.status(200).json({
    ok: true,
    authed: true,
    usingDefaultPassword: usingDefaultPassword(),
  });
}
