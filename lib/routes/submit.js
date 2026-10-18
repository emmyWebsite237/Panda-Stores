/**
 * Public submission API — ONE serverless function for both forms.
 *
 * Vercel maps /api/submit/:kind → /api/submit?kind=:kind, so the public URLs
 * stay exactly as they were:
 *
 *   GET  /api/submit/sell      → { formSubmit: bool }
 *   POST /api/submit/sell
 *   GET  /api/submit/contact   → { formSubmit: bool }
 *   POST /api/submit/contact
 *
 * Both relay to FormSubmit when an endpoint env var is present, and otherwise
 * answer with `mode: 'google-form'` (or `'whatsapp'`) so the browser can fall
 * back without losing the lead.
 */

import { readStore } from '../store.js';
import { readBody, str, allowMethods } from '../util.js';

/* ------------------------------------------------------------------ *
 * Sell your account
 * ------------------------------------------------------------------ */

const SELL_FIELDS = [
  ['name', 120],
  ['whatsapp', 40],
  ['game', 80],
  ['rank', 120],
  ['priceRange', 120],
  ['details', 4000],
  ['links', 600],
];

async function handleSell(req, res) {
  if (!allowMethods(req, res, ['POST', 'GET'])) return;

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, formSubmit: Boolean(process.env.FORMSUBMIT_ENDPOINT) });
  }

  const body = readBody(req);
  const payload = {};
  for (const [key, max] of SELL_FIELDS) payload[key] = str(body[key], max);

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

/* ------------------------------------------------------------------ *
 * Contact / support
 * ------------------------------------------------------------------ */

async function handleContact(req, res) {
  if (!allowMethods(req, res, ['POST', 'GET'])) return;

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      formSubmit: Boolean(process.env.FORMSUBMIT_CONTACT_ENDPOINT || process.env.FORMSUBMIT_ENDPOINT),
    });
  }

  const body = readBody(req);

  const payload = {
    name: str(body.name, 120),
    contact: str(body.contact, 120),
    topic: str(body.topic, 80) || 'General enquiry',
    message: str(body.message, 4000),
    game: str(body.game, 80),
  };

  if (!payload.name) return res.status(400).json({ ok: false, error: 'Your name is required' });
  if (!payload.contact) {
    return res.status(400).json({ ok: false, error: 'Add an email or WhatsApp number so we can reply' });
  }
  if (payload.message.length < 10) {
    return res.status(400).json({ ok: false, error: 'Tell us a bit more about what you need' });
  }

  const endpoint = process.env.FORMSUBMIT_CONTACT_ENDPOINT || process.env.FORMSUBMIT_ENDPOINT;

  if (!endpoint) {
    const doc = await readStore();
    const googleFormUrl = doc.settings.googleFormContactUrl || '';
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
    form.append('_subject', `📨 ${payload.topic} — ${payload.name}`);
    form.append('_template', 'table');
    form.append('_captcha', 'false');
    form.append('Type', 'Support / contact');
    form.append('Store', doc.settings.storeName || 'Panda Gaming Store');
    form.append('Name', payload.name);
    form.append('Reply to', payload.contact);
    form.append('Topic', payload.topic);
    form.append('Game', payload.game || '—');
    form.append('Message', payload.message);

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error('[api/submit/contact] FormSubmit rejected:', upstream.status, text);
      return res.status(502).json({
        ok: false,
        error: 'We could not send that message. Please use WhatsApp instead.',
      });
    }

    return res.status(200).json({ ok: true, mode: 'formsubmit' });
  } catch (err) {
    console.error('[api/submit/contact]', err);
    return res.status(500).json({ ok: false, error: 'Message failed to send. Please try again.' });
  }
}

/* ------------------------------------------------------------------ *
 * WhatsApp hand-off log
 *
 * When a buyer accepts the terms we record the enquiry before opening
 * WhatsApp, so the dashboard has an orders/enquiries log even though the
 * actual sale happens in chat. This is fire-and-forget by design: a failed
 * log must never stop the buyer reaching WhatsApp.
 * ------------------------------------------------------------------ */

async function handleOrder(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;

  const body = readBody(req);
  const productId = str(body.productId, 80);

  try {
    const { updateStore } = await import('../store.js');
    const doc = await readStore();
    const product = doc.products.find((p) => p.id === productId);

    const order = {
      id: `ord-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      productId,
      productTitle: product?.title || str(body.productTitle, 160),
      buyerName: str(body.buyerName, 120) || 'WhatsApp enquiry',
      contact: str(body.contact, 120),
      amountUsd: Math.round((Number(product?.priceUsd) || 0) * 100) / 100,
      note: 'Terms accepted — buyer handed off to WhatsApp.',
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    await updateStore((draft) => {
      draft.orders = [order, ...(draft.orders || [])].slice(0, 500);
      return draft;
    });

    return res.status(201).json({ ok: true, orderId: order.id });
  } catch (err) {
    console.error('[api/submit/order]', err);
    // Never block the buyer: acknowledge anyway.
    return res.status(200).json({ ok: false, logged: false });
  }
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

export default async function submit(req, res) {
  const kind = String(req.query?.kind || '').trim();

  if (kind === 'sell') return handleSell(req, res);
  if (kind === 'contact') return handleContact(req, res);
  if (kind === 'order') return handleOrder(req, res);

  return res.status(404).json({ ok: false, error: `Unknown submission type: ${kind || '(none)'}` });
}
