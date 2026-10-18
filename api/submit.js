/**
 * Public form submissions — serverless function #7.
 *
 * vercel.json rewrites /api/submit/:kind → /api/submit?kind=:kind:
 *   /api/submit/sell  /api/submit/contact  /api/submit/order
 */

import submit from '../lib/routes/submit.js';

export default submit;
