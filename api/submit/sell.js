/**
 * POST /api/submit/sell
 *
 * Primary path: relay the submission to FormSubmit (FORMSUBMIT_ENDPOINT).
 * Fallback:     respond { mode: 'google-form' } and let the browser hand
 *               the user to the Google Form configured in settings.
 *
 * Image attachments are uploaded to Cloudinary from the browser first; we
 * only pass their URLs through to the notification email.
 */

import { readStore } from '../_lib/store.js';
import { readBody, str, allowMethods } from '../_lib/util.js';

const FIELDS = [
  ['name', 120],
  ['whatsapp', 40],
  ['game', 80],
  ['rank', 120],
  ['priceRange', 120],
  ['details', 4000],
  ['links', 600],
];

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST', 'GET'])) return;

  if (req.method === 'GET') {
    const endpoint = process.env.FORMSUBMIT_ENDPOINT || '';
    return res.status(200).json({ ok: true, formSubmit: Boolean(endpoint) });
  }

  const body = readBody(req);
  const payload = {};

  for (const [key, max] of FIELDS) {
    payload[key] = str(body[key], max);
  }

  const images = Array.isArray(body.images)
    ? body.images.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, 6)
    : [];

  if (!payload.name) return res.status(400).json({ ok: false, error: 'Your name is required' });
  if (!payload.whatsapp) return res.status(400).json({ ok: false, error: 'A WhatsApp number is required' });
  if (!payload.game) return res.status(400).json({ ok: false, error: 'Pick the game' });
  if (payload.details.length < 20) {
    return res.status(400).json({ ok: false, error: 'Tell us a little more about the account' });
  }

  const endpoint = process.env.FORMSUBMIT_ENDPOINT;

  // No FormSubmit configured → tell the client to use the Google Form instead,
  // or the WhatsApp hand-off when no Google Form is set either.
  if (!endpoint) {
    const doc = await readStore();
    const googleFormUrl = doc.settings.googleFormSellUrl || '';
    return res.status(200).json({
      ok: true,
      mode: googleFormUrl ? 'google-form' : 'whatsapp',
      googleFormUrl,
      whatsappNumber: doc.settings.whatsappNumber || '',
    });
  }

  try {
    const doc = await readStore();
    const form = new FormData();
    form.append('_subject', `🎮 New account submission — ${payload.name} (${payload.game})`);
    form.append('_template', 'table');
    form.append('_captcha', 'false');
    form.append('Type', 'Sell your account');
    form.append('Store', doc.settings.storeName || 'Panda Gaming Store');
    form.append('Name', payload.name);
    form.append('WhatsApp', payload.whatsapp);
    form.append('Game', payload.game);
    form.append('Rank / level', payload.rank || '—');
    form.append('Price range', payload.priceRange || '—');
    form.append('Account details', payload.details);
    form.append('Proof links', payload.links || '—');
    form.append('Images', images.length ? images.join('\n') : 'No images attached');

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error('[api/submit/sell] FormSubmit rejected:', upstream.status, text);
      return res.status(502).json({
        ok: false,
        error: 'We could not forward your submission. Please message us on WhatsApp instead.',
      });
    }

    return res.status(200).json({ ok: true, mode: 'formsubmit' });
  } catch (err) {
    console.error('[api/submit/sell]', err);
    return res.status(500).json({ ok: false, error: 'Submission failed. Please try again.' });
  }
}
