/**
 * Admin session handling.
 *
 * A compact HMAC-signed token in an HttpOnly cookie — no session table
 * needed, and it survives redeploys as long as the secret does.
 */

import crypto from 'node:crypto';

export const COOKIE_NAME = 'panda_admin';
const DEFAULT_PASSWORD = 'panda-demo-2026';

export function adminPassword() {
  return (process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD).trim();
}

export function usingDefaultPassword() {
  return !process.env.ADMIN_PASSWORD;
}

function secret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    crypto.createHash('sha256').update(`panda::${adminPassword()}`).digest('hex')
  );
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function sessionDays() {
  const n = Number(process.env.ADMIN_SESSION_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

export function createToken() {
  const exp = Date.now() + sessionDays() * 24 * 60 * 60 * 1000;
  const payload = b64url(JSON.stringify({ sub: 'admin', exp }));
  const sig = b64url(crypto.createHmac('sha256', secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret()).update(payload).digest());
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.sub === 'admin' && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(req) {
  const raw = req.headers?.cookie || '';
  return raw.split(';').reduce((acc, part) => {
    const i = part.indexOf('=');
    if (i > -1) acc[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    return acc;
  }, {});
}

export function isAuthed(req) {
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

export function setSessionCookie(res) {
  const maxAge = sessionDays() * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${createToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Wrap a handler so it only runs for signed-in admins. */
export function requireAdmin(handler) {
  return async (req, res) => {
    if (!isAuthed(req)) {
      res.status(401).json({ ok: false, error: 'Not signed in' });
      return;
    }
    return handler(req, res);
  };
}

export function timingSafeEqualStrings(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // still burn a comparison so length isn't a timing oracle
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}
