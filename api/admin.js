/**
 * Admin API — serverless function #6.
 *
 * ONE function behind every admin action. vercel.json rewrites
 * /api/admin/:action → /api/admin?action=:action so existing URLs keep working:
 *   /api/admin/login  /api/admin/logout  /api/admin/session
 *   /api/admin/products  /api/admin/settings  /api/admin/cloudinary-signature
 *   /api/admin/stats  /api/admin/reviews  /api/admin/orders  /api/admin/bulk-stock
 */

import admin from '../lib/routes/admin.js';

export default admin;
