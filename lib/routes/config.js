/**
 * GET /api/config
 * Public bootstrap payload: settings + products + which integrations are live.
 * Used by every page so nothing personal is hardcoded in the HTML.
 */

import { readStore, publicSettings, storageMode } from '../store.js';
import { ratingFor, siteRating } from '../rating.js';

export default async function config(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const doc = await readStore();
    const reviews = doc.reviews || [];

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
    return res.status(200).json({
      ok: true,
      mode: storageMode(),
      settings: publicSettings(doc.settings),
      products: doc.products.map((p) => ({
        id: p.id,
        title: p.title,
        game: p.game,
        priceUsd: Number(p.priceUsd) || 0,
        stock: Number(p.stock) || 0,
        images: Array.isArray(p.images) ? p.images : [],
        cover: p.cover || (p.images || [])[0] || '',
        featured: Boolean(p.featured),
        inStock: Number(p.stock) > 0,
        createdAt: p.createdAt,
        ...ratingFor(reviews, p.id),
      })),
      reviews: reviews.slice(0, 12),
      counts: {
        products: doc.products.length,
        inStock: doc.products.filter((p) => Number(p.stock) > 0).length,
      },
      siteRating: siteRating(reviews),
      integrations: {
        formSubmit: Boolean(process.env.FORMSUBMIT_ENDPOINT),
        formSubmitContact: Boolean(process.env.FORMSUBMIT_CONTACT_ENDPOINT || process.env.FORMSUBMIT_ENDPOINT),
        cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
        cloudinaryUnsigned: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET),
      },
    });
  } catch (err) {
    console.error('[api/config]', err);
    return res.status(500).json({ ok: false, error: 'Could not load store configuration' });
  }
}
