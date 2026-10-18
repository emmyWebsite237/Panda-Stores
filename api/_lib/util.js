/** Small shared helpers for the API layer. */

/**
 * Cloudinary cloud name.
 *
 * Accepts CLOUDINARY_CLOUD_NAME (canonical) or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 * (the name used by earlier setups), so either variable set on Vercel works.
 * The cloud name is public by design — it appears in every image URL.
 */
export function cloudinaryCloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
}

export function readBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function str(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

export function num(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function slugify(text, fallback = 'account') {
  const s = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || fallback;
}

export function randomId(prefix = '') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

export function uniqueId(base, existing) {
  const taken = new Set(existing || []);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** Only allow http(s) urls or site-relative paths as image sources. */
export function safeImageUrl(url) {
  const value = str(url, 800);
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (/^https?:\/\/[^\s"'<>]+$/i.test(value)) return value;
  return '';
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` });
  return false;
}

/** Normalise a handle or full URL into a usable social link. */
export function normalizeSocial(value, base) {
  const v = str(value, 400);
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '').replace(/\s+/g, '');
  return handle ? `${base}${handle}` : '';
}
