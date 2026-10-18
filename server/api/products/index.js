/**
 * GET /api/products            → all public products
 * GET /api/products?game=Free Fire
 *
 * Only fields the storefront needs are exposed; delivery codes stay out
 * of this endpoint and are released by /api/products/[id].
 */

import { readStore } from '../_lib/store.js';

export function summarize(product) {
  return {
    id: product.id,
    title: product.title,
    game: product.game,
    priceUsd: Number(product.priceUsd) || 0,
    stock: Number(product.stock) || 0,
    images: Array.isArray(product.images) ? product.images : [],
    cover: product.cover || (product.images || [])[0] || '',
    featured: Boolean(product.featured),
    inStock: Number(product.stock) > 0,
    createdAt: product.createdAt,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const doc = await readStore();
    const game = String(req.query?.game || '').trim();

    let items = doc.products;
    if (game) items = items.filter((p) => String(p.game).toLowerCase() === game.toLowerCase());

    items = [...items].sort((a, b) => {
      if (Boolean(b.featured) !== Boolean(a.featured)) return b.featured ? 1 : -1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
    return res.status(200).json({
      ok: true,
      products: items.map(summarize),
      games: [...new Set(doc.products.map((p) => p.game).filter(Boolean))],
      usdToNgn: Number(doc.settings?.usdToNgn) || 0,
    });
  } catch (err) {
    console.error('[api/products]', err);
    return res.status(500).json({ ok: false, error: 'Could not load products' });
  }
}
