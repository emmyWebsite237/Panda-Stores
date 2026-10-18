/**
 * GET /api/health — serverless function #1.
 * Thin entry point; the implementation lives in api/_lib/routes/health.js
 * (anything under api/_lib is a shared module, NOT a deployed function).
 */

import health from '../lib/routes/health.js';

export default health;
