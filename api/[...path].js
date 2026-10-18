/**
 * Single Vercel serverless function for all Panda Stores API endpoints.
 * This keeps the project within Vercel Hobby's 12-function deployment limit.
 */
import adminCloudinarySignature from '../server/api/admin/cloudinary-signature.js';
import adminLogin from '../server/api/admin/login.js';
import adminLogout from '../server/api/admin/logout.js';
import adminProducts from '../server/api/admin/products.js';
import adminSession from '../server/api/admin/session.js';
import adminSettings from '../server/api/admin/settings.js';
import cloudinaryPublic from '../server/api/cloudinary-public.js';
import config from '../server/api/config.js';
import health from '../server/api/health.js';
import productDetail from '../server/api/products/[id].js';
import products from '../server/api/products/index.js';
import submitContact from '../server/api/submit/contact.js';
import submitSell from '../server/api/submit/sell.js';

const routes = {
  'admin/cloudinary-signature': adminCloudinarySignature,
  'admin/login': adminLogin,
  'admin/logout': adminLogout,
  'admin/products': adminProducts,
  'admin/session': adminSession,
  'admin/settings': adminSettings,
  'cloudinary-public': cloudinaryPublic,
  config,
  health,
  products,
  'submit/contact': submitContact,
  'submit/sell': submitSell,
};

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname).replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const query = { ...(req.query || {}) };
  delete query.path;
  for (const [key, value] of url.searchParams.entries()) {
    if (!(key in query)) query[key] = value;
  }

  let target = routes[pathname];
  const productMatch = pathname.match(/^products\/([^/]+)$/);
  if (productMatch) {
    target = productDetail;
    query.id = productMatch[1];
  }

  if (typeof target !== 'function') {
    return res.status(404).json({ ok: false, error: `No API route for /api/${pathname}` });
  }

  req.query = query;
  return target(req, res);
}
