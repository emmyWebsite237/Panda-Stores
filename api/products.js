/**
 * GET /api/products — serverless function #4.
 * Public listing index (optionally filtered with ?game=).
 * The detail route is /api/product?id=… (see vercel.json rewrite).
 */

import productsList from '../lib/routes/products-list.js';

export default productsList;
