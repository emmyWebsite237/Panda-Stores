/**
 * GET /api/products/:id
 * Full product detail including the delivery code that goes into the
 * WhatsApp message once the buyer accepts the terms.
 */

import { readStore } from '../_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const id = decodeURIComponent(String(req.query?.id || '').trim());
  if (!id) return res.status(400).json({ ok: false, error: 'Missing product id' });

  try {
    const doc = await readStore();
    const product = doc.products.find((p) => p.id === id);

    if (!product) {
      return res.status(404).json({ ok: false, error: 'That account is no longer listed' });
    }

    const related = doc.products
      .filter((p) => p.id !== product.id && p.game === product.game)
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        title: p.title,
        game: p.game,
        priceUsd: Number(p.priceUsd) || 0,
        cover: p.cover || (p.images || [])[0] || '',
      }));

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
    return res.status(200).json({
      ok: true,
      product: {
        id: product.id,
        title: product.title,
        game: product.game,
        description: product.description || '',
        priceUsd: Number(product.priceUsd) || 0,
        stock: Number(product.stock) || 0,
        inStock: Number(product.stock) > 0,
        images: Array.isArray(product.images) ? product.images : [],
        cover: product.cover || (product.images || [])[0] || '',
        deliveryCode: product.deliveryCode || '',
        featured: Boolean(product.featured),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
      settings: {
        storeName: doc.settings?.storeName || 'Panda Gaming Store',
        whatsappNumber: doc.settings?.whatsappNumber || '',
        usdToNgn: Number(doc.settings?.usdToNgn) || 0,
        termsText: doc.settings?.termsText || '',
        currencyNote: doc.settings?.currencyNote || '',
        showCodeInMessage: doc.settings?.showCodeInMessage !== false,
      },
      related,
    });
  } catch (err) {
    console.error('[api/products/:id]', err);
    return res.status(500).json({ ok: false, error: 'Could not load that account' });
  }
}
