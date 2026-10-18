/**
 * Admin API — ONE serverless function serving every admin action.
 *
 * Vercel maps /api/admin/:action → /api/admin?action=:action (replaced in
 * vercel.json), so the public URLs are unchanged:
 *
 *   GET    /api/admin/login                  → { authed, usingDefaultPassword }
 *   POST   /api/admin/login                  { password }
 *   POST   /api/admin/logout
 *   GET    /api/admin/session
 *   GET    /api/admin/products
 *   POST   /api/admin/products
 *   PUT    /api/admin/products
 *   DELETE /api/admin/products?id=…
 *   GET    /api/admin/settings
 *   PUT    /api/admin/settings
 *   POST   /api/admin/cloudinary-signature
 *   GET    /api/admin/stats                  → dashboard numbers
 *   GET    /api/admin/reviews
 *   POST   /api/admin/reviews
 *   PUT    /api/admin/reviews
 *   DELETE /api/admin/reviews?id=…
 *   GET    /api/admin/orders
 *   POST   /api/admin/orders
 *   PUT    /api/admin/orders
 *   DELETE /api/admin/orders?id=…
 *   POST   /api/admin/bulk-stock             { ids: [], stock | adjust }
 */

import crypto from 'node:crypto';
import {
  adminPassword,
  setSessionCookie,
  clearSessionCookie,
  isAuthed,
  usingDefaultPassword,
  timingSafeEqualStrings,
  requireAdmin,
} from '../auth.js';
import { readStore, updateStore, storageMode } from '../store.js';
import {
  readBody,
  str,
  num,
  bool,
  slugify,
  uniqueId,
  safeImageUrl,
  allowMethods,
  normalizeSocial,
} from '../util.js';
import { ratingFor } from '../rating.js';

const MIN_IMAGES = 2;
const MAX_IMAGES = 5;

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

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

async function handleProducts(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PUT', 'DELETE'])) return;

  if (req.method === 'GET') {
    const doc = await readStore();
    return res.status(200).json({ ok: true, products: doc.products });
  }

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

  // DELETE
  const id = str(req.query?.id || readBody(req).id, 60);
  if (!id) return res.status(400).json({ ok: false, error: 'Missing product id' });

  const doc = await readStore({ fresh: true });
  if (!doc.products.some((p) => p.id === id)) {
    return res.status(404).json({ ok: false, error: 'Product not found' });
  }

  await updateStore((draft) => {
    draft.products = draft.products.filter((p) => p.id !== id);
    // Drop the reviews that belonged to the deleted listing.
    draft.reviews = (draft.reviews || []).filter((r) => r.productId !== id);
    return draft;
  });

  return res.status(200).json({ ok: true, deleted: id });
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

const TEXT_KEYS = [
  ['storeName', 80],
  ['tagline', 160],
  ['heroHeadline', 160],
  ['heroSubline', 400],
  ['email', 160],
  ['phoneNumber', 40],
  ['supportHours', 120],
  ['responseTime', 160],
  ['address', 200],
  ['currencyNote', 300],
  ['announcement', 200],
  ['googleFormSellUrl', 500],
  ['googleFormContactUrl', 500],
  ['aboutText', 4000],
  ['privacyContact', 200],
];

const SOCIAL_KEYS = [
  ['instagram', 'https://instagram.com/'],
  ['tiktok', 'https://tiktok.com/@'],
  ['telegram', 'https://t.me/'],
];

async function handleSettings(req, res) {
  if (!allowMethods(req, res, ['GET', 'PUT'])) return;

  if (req.method === 'GET') {
    const doc = await readStore();
    return res.status(200).json({ ok: true, settings: doc.settings });
  }

  const body = readBody(req);
  const patch = {};

  for (const [key, max] of TEXT_KEYS) {
    if (body[key] !== undefined) patch[key] = str(body[key], max);
  }

  if (body.termsText !== undefined) patch.termsText = str(body.termsText, 12000);
  if (body.privacyText !== undefined) patch.privacyText = str(body.privacyText, 12000);

  if (body.whatsappNumber !== undefined) {
    patch.whatsappNumber = str(body.whatsappNumber, 24).replace(/\D/g, '');
  }

  for (const [key, base] of SOCIAL_KEYS) {
    if (body[key] !== undefined) patch[key] = normalizeSocial(body[key], base);
  }

  if (body.usdToNgn !== undefined) {
    const rate = num(body.usdToNgn, 0);
    if (!(rate > 0)) {
      return res.status(400).json({ ok: false, error: 'The USD → NGN rate must be greater than 0' });
    }
    patch.usdToNgn = rate;
  }

  if (body.showCodeInMessage !== undefined) {
    patch.showCodeInMessage = bool(body.showCodeInMessage);
  }

  if (patch.heroHeadline && patch.heroHeadline.length > 160) {
    return res.status(400).json({ ok: false, error: 'Headline is too long' });
  }

  const updated = await updateStore((draft) => {
    draft.settings = { ...draft.settings, ...patch };
    return draft;
  });

  return res.status(200).json({ ok: true, settings: updated.settings });
}

/* ------------------------------------------------------------------ *
 * Cloudinary signing
 * ------------------------------------------------------------------ */

async function handleCloudinarySignature(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return res.status(400).json({
      ok: false,
      error:
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME (and CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) on Vercel.',
    });
  }

  const folder = process.env.CLOUDINARY_FOLDER || 'panda-gaming-store';
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (preset) {
    return res.status(200).json({
      ok: true,
      mode: 'unsigned',
      cloudName,
      preset,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({
      ok: false,
      error:
        'Cloudinary needs either CLOUDINARY_UPLOAD_PRESET (unsigned) or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (signed).',
    });
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signatures are built from every param except file/api_key,
  // sorted alphabetically.
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');

  return res.status(200).json({
    ok: true,
    mode: 'signed',
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  });
}

/* ------------------------------------------------------------------ *
 * Dashboard stats
 * ------------------------------------------------------------------ */

async function handleStats(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;

  const doc = await readStore();
  const products = doc.products || [];
  const rate = Number(doc.settings?.usdToNgn) || 0;
  const inStock = products.filter((p) => Number(p.stock) > 0);
  const outOfStock = products.filter((p) => Number(p.stock) === 0);
  const inventoryValueUsd = inStock.reduce(
    (sum, p) => sum + (Number(p.priceUsd) || 0) * (Number(p.stock) || 0),
    0
  );

  const reviews = doc.reviews || [];
  const orders = doc.orders || [];

  return res.status(200).json({
    ok: true,
    stats: {
      total: products.length,
      inStock: inStock.length,
      outOfStock: outOfStock.length,
      featured: products.filter((p) => p.featured).length,
      units: inStock.reduce((s, p) => s + (Number(p.stock) || 0), 0),
      inventoryValueUsd: Math.round(inventoryValueUsd * 100) / 100,
      inventoryValueNgn: Math.round(inventoryValueUsd * rate),
      avgRating:
        reviews.length > 0
          ? Math.round(
              (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length) * 10
            ) / 10
          : 0,
      reviewCount: reviews.length,
      newEnquiries: orders.filter((o) => o.status === 'new').length,
      orderCount: orders.length,
      byGame: [...new Set(products.map((p) => p.game).filter(Boolean))].map((game) => ({
        game,
        count: products.filter((p) => p.game === game).length,
      })),
      rate,
      storage: storageMode(),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Reviews
 * ------------------------------------------------------------------ */

function normalizeReview(body) {
  const errors = [];
  const productId = str(body.productId, 80);
  if (!productId) errors.push('Pick the listing this review belongs to');

  const name = str(body.name, 60) || 'Gamer';
  const rating = Math.min(5, Math.max(1, Math.round(num(body.rating, 5))));
  const text = str(body.body, 1200);
  if (text.length < 4) errors.push('Write a short review');

  return {
    errors,
    value: {
      productId,
      name,
      rating,
      body: text,
      verified: body.verified === undefined ? true : bool(body.verified),
    },
  };
}

async function handleReviews(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PUT', 'DELETE'])) return;

  if (req.method === 'GET') {
    const doc = await readStore();
    return res.status(200).json({
      ok: true,
      reviews: (doc.reviews || []).map((r) => ({ ...ratingFor(doc.reviews, r.productId), ...r })),
    });
  }

  if (req.method === 'POST') {
    const { errors, value } = normalizeReview(readBody(req));
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    const doc = await readStore({ fresh: true });
    if (!doc.products.some((p) => p.id === value.productId)) {
      return res.status(400).json({ ok: false, error: 'That product does not exist' });
    }

    const now = new Date().toISOString();
    const review = {
      ...value,
      id: `rev-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
    };

    await updateStore((draft) => {
      draft.reviews = [review, ...(draft.reviews || [])];
      return draft;
    });

    return res.status(201).json({ ok: true, review });
  }

  if (req.method === 'PUT') {
    const body = readBody(req);
    const id = str(body.id, 80);
    if (!id) return res.status(400).json({ ok: false, error: 'Missing review id' });

    const doc = await readStore({ fresh: true });
    const existing = (doc.reviews || []).find((r) => r.id === id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Review not found' });

    const { errors, value } = normalizeReview({ ...existing, ...body });
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    const updated = { ...existing, ...value, id: existing.id, createdAt: existing.createdAt };

    await updateStore((draft) => {
      const i = (draft.reviews || []).findIndex((r) => r.id === id);
      if (i > -1) draft.reviews[i] = updated;
      return draft;
    });

    return res.status(200).json({ ok: true, review: updated });
  }

  // DELETE
  const id = str(req.query?.id || readBody(req).id, 80);
  if (!id) return res.status(400).json({ ok: false, error: 'Missing review id' });

  await updateStore((draft) => {
    draft.reviews = (draft.reviews || []).filter((r) => r.id !== id);
    return draft;
  });

  return res.status(200).json({ ok: true, deleted: id });
}

/* ------------------------------------------------------------------ *
 * Orders / enquiries log
 * ------------------------------------------------------------------ */

const ORDER_STATUS = ['new', 'contacted', 'paid', 'delivered', 'cancelled'];

async function handleOrders(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PUT', 'DELETE'])) return;

  if (req.method === 'GET') {
    const doc = await readStore();
    return res.status(200).json({ ok: true, orders: doc.orders || [] });
  }

  if (req.method === 'POST') {
    const body = readBody(req);
    const now = new Date().toISOString();
    const order = {
      id: `ord-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      productId: str(body.productId, 80),
      productTitle: str(body.productTitle, 160),
      buyerName: str(body.buyerName, 120),
      contact: str(body.contact, 120),
      amountUsd: Math.round(num(body.amountUsd, 0) * 100) / 100,
      note: str(body.note, 1000),
      status: 'new',
      createdAt: now,
    };

    await updateStore((draft) => {
      draft.orders = [order, ...(draft.orders || [])].slice(0, 500);
      return draft;
    });

    return res.status(201).json({ ok: true, order });
  }

  if (req.method === 'PUT') {
    const body = readBody(req);
    const id = str(body.id, 80);
    if (!id) return res.status(400).json({ ok: false, error: 'Missing order id' });

    const doc = await readStore({ fresh: true });
    const existing = (doc.orders || []).find((o) => o.id === id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Order not found' });

    const status = str(body.status, 20);
    const updated = {
      ...existing,
      status: ORDER_STATUS.includes(status) ? status : existing.status,
      note: body.note !== undefined ? str(body.note, 1000) : existing.note,
    };

    await updateStore((draft) => {
      const i = (draft.orders || []).findIndex((o) => o.id === id);
      if (i > -1) draft.orders[i] = updated;
      return draft;
    });

    return res.status(200).json({ ok: true, order: updated });
  }

  // DELETE
  const id = str(req.query?.id || readBody(req).id, 80);
  if (!id) return res.status(400).json({ ok: false, error: 'Missing order id' });

  await updateStore((draft) => {
    draft.orders = (draft.orders || []).filter((o) => o.id !== id);
    return draft;
  });

  return res.status(200).json({ ok: true, deleted: id });
}

/* ------------------------------------------------------------------ *
 * Bulk stock toggle
 * ------------------------------------------------------------------ */

async function handleBulkStock(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;

  const body = readBody(req);
  const ids = Array.isArray(body.ids) ? body.ids.map((v) => str(v, 80)).filter(Boolean) : [];
  const stockValue = body.stock !== undefined ? Math.max(0, Math.round(num(body.stock, 0))) : null;
  const adjust = body.adjust !== undefined ? Math.round(num(body.adjust, 0)) : null;

  if (!ids.length) return res.status(400).json({ ok: false, error: 'Select at least one account' });
  if (stockValue === null && adjust === null) {
    return res.status(400).json({ ok: false, error: 'Provide a stock value or an adjustment' });
  }

  const doc = await readStore({ fresh: true });
  const found = doc.products.filter((p) => ids.includes(p.id));
  if (!found.length) return res.status(404).json({ ok: false, error: 'None of those accounts exist' });

  const updated = await updateStore((draft) => {
    draft.products = draft.products.map((p) => {
      if (!ids.includes(p.id)) return p;
      const next = stockValue !== null ? stockValue : Math.max(0, (Number(p.stock) || 0) + adjust);
      return { ...p, stock: next, updatedAt: new Date().toISOString() };
    });
    return draft;
  });

  return res.status(200).json({
    ok: true,
    updated: updated.products.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, stock: p.stock })),
  });
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

export default async function admin(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const action = String(req.query?.action || '').trim();

  try {
    /* ---- public session endpoints (no auth required) ---- */
    if (action === 'login') {
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

      const password = str(readBody(req).password, 200);
      if (!password) return res.status(400).json({ ok: false, error: 'Enter the admin password' });

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

    if (action === 'logout') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
      }
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (action === 'session') {
      return res.status(200).json({
        ok: true,
        authed: isAuthed(req),
        usingDefaultPassword: usingDefaultPassword(),
        storage: storageMode(),
        env: {
          cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
          cloudinaryUnsigned: Boolean(
            process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET
          ),
          cloudinarySigned: Boolean(
            process.env.CLOUDINARY_CLOUD_NAME &&
              process.env.CLOUDINARY_API_KEY &&
              process.env.CLOUDINARY_API_SECRET
          ),
          formSubmit: Boolean(process.env.FORMSUBMIT_ENDPOINT),
          formSubmitContact: Boolean(
            process.env.FORMSUBMIT_CONTACT_ENDPOINT || process.env.FORMSUBMIT_ENDPOINT
          ),
        },
      });
    }

    /* ---- everything below requires a signed-in admin ---- */
    const guarded = {
      products: handleProducts,
      settings: handleSettings,
      'cloudinary-signature': handleCloudinarySignature,
      stats: handleStats,
      reviews: handleReviews,
      orders: handleOrders,
      'bulk-stock': handleBulkStock,
    };

    const handler = guarded[action];
    if (!handler) {
      return res.status(404).json({ ok: false, error: `Unknown admin action: ${action || '(none)'}` });
    }

    if (!isAuthed(req)) {
      return res.status(401).json({ ok: false, error: 'Not signed in' });
    }

    return await handler(req, res);
  } catch (err) {
    console.error('[api/admin]', action, err);
    return res.status(500).json({ ok: false, error: err.message || 'Request failed' });
  }
}
