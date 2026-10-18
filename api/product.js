/**
 * GET /api/product?id=… — serverless function #5.
 *
 * Serves the old /api/products/:id URL through a rewrite in vercel.json, so
 * the public endpoint contract is unchanged while the deployment only counts
 * ONE function for it.
 */

import productDetail from '../lib/routes/product-detail.js';

export default productDetail;
