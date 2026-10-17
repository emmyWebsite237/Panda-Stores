/**
 * Admin product management.
 *
 *   GET    /api/admin/products        → full records (incl. delivery codes)
 *   POST   /api/admin/products        → create
 *   PUT    /api/admin/products        → update  { id, ...fields }
 *   DELETE /api/admin/products?id=…   → delete
 */

import { requireAdmin } from '../_lib/auth.js';
import { readStore, updateStore } from '../_lib/store.js';
import { readBody, str, num, bool, slugify, uniqueId, safeImageUrl, allowMethods } from '../_lib/util.js';

const MIN_IMAGES = 2;
const MAX_IMAGES = 5;

/** Validate + normalise whatever the admin form posted. */
function normalizePayload(body, existing = null) {
  const errors = [];

  const title = str(body.title, 140);
  if (!title) errors.push('Give the listing a title');

  const game = str(body.game, 60) || 'Other';
  const priceUsd = num(body.priceUsd, -1);
  if (!(priceUsd >= 0)) errors.push('Enter a valid USD price');

  const stock = Math.max(0, Math.round(num(body.stock, 0)));

  let images = (Array.isArray(body.images) ? body.images : [])
    .map(safeImageUrl)
    .filter(Boolean)
    .slice(0, MAX_IMAGES);

  // De-duplicate while preserving order
  images = images.filter((url, i) => images.indexOf(url) === i);

  if (images.length < MIN_IMAGES) {
    errors.push(`Add at least ${MIN_IMAGES} images (up to ${MAX_IMAGES})`);
  }

  const cover = safeImageUrl(body.cover) || images[0] || '';
  if (cover && !images.includes(cover)) images.unshift(cover);

  return {
    errors,
    value: {
      title,
      game,
      priceUsd: Math.round(priceUsd * 100) / 100,
      stock,
      description: str(body.description, 4000),
      deliveryCode: str(body.deliveryCode, 300),
      images,
      cover: cover || images[0] || '',
      featured: bool(body.featured),
      ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
    },
  };
}

export default requireAdmin(async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PUT', 'DELETE'])) return;

  try {
    /* ---------------- list ---------------- */
    if (req.method === 'GET') {
      const doc = await readStore();
      return res.status(200).json({ ok: true, products: doc.products });
    }

    /* ---------------- create ---------------- */
    if (req.method === 'POST') {
      const body = readBody(req);
      const { errors, value } = normalizePayload(body);
      if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

      const doc = await readStore({ fresh: true });
      const base = slugify(`${value.game}-${value.title}`, 'account');
      const id = str(body.id, 60) || uniqueId(base, doc.products.map((p) => p.id));

      const now = new Date().toISOString();
      const product = {
        ...value,
        id: uniqueId(id, doc.products.map((p) => p.id)),
        createdAt: now,
        updatedAt: now,
      };

      await updateStore((draft) => {
        draft.products.unshift(product);
        return draft;
      });

      return res.status(201).json({ ok: true, product });
    }

    /* ---------------- update ---------------- */
    if (req.method === 'PUT') {
      const body = readBody(req);
      const id = str(body.id, 60);
      if (!id) return res.status(400).json({ ok: false, error: 'Missing product id' });

      const doc = await readStore({ fresh: true });
      const existing = doc.products.find((p) => p.id === id);
      if (!existing) return res.status(404).json({ ok: false, error: 'Product not found' });

      const { errors, value } = normalizePayload(body, existing);
      if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

      const updated = {
        ...existing,
        ...value,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };

      await updateStore((draft) => {
        const i = draft.products.findIndex((p) => p.id === id);
        if (i > -1) draft.products[i] = updated;
        return draft;
      });

      return res.status(200).json({ ok: true, product: updated });
    }

    /* ---------------- delete ---------------- */
    if (req.method === 'DELETE') {
      const id = str(req.query?.id || readBody(req).id, 60);
      if (!id) return res.status(400).json({ ok: false, error: 'Missing product id' });

      const doc = await readStore({ fresh: true });
      if (!doc.products.some((p) => p.id === id)) {
        return res.status(404).json({ ok: false, error: 'Product not found' });
      }

      await updateStore((draft) => {
        draft.products = draft.products.filter((p) => p.id !== id);
        return draft;
      });

      return res.status(200).json({ ok: true, deleted: id });
    }
  } catch (err) {
    console.error('[api/admin/products]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Request failed' });
  }
});
