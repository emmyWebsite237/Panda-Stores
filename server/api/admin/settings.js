/**
 * GET /api/admin/settings  → full settings document
 * PUT /api/admin/settings  → partial update (only known keys are stored)
 */

import { requireAdmin } from '../_lib/auth.js';
import { readStore, updateStore } from '../_lib/store.js';
import { readBody, str, num, bool, normalizeSocial, allowMethods } from '../_lib/util.js';

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
];

const SOCIAL_KEYS = [
  ['instagram', 'https://instagram.com/'],
  ['tiktok', 'https://tiktok.com/@'],
  ['telegram', 'https://t.me/'],
];

export default requireAdmin(async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'PUT'])) return;

  try {
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
  } catch (err) {
    console.error('[api/admin/settings]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Could not save settings' });
  }
});
