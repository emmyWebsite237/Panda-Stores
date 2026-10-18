/**
 * POST /api/submit/contact
 *
 * Complaints, account requests and general support. Routes through FormSubmit
 * when FORMSUBMIT_CONTACT_ENDPOINT (or the shared FORMSUBMIT_ENDPOINT) is set,
 * otherwise tells the client to use the Google Form fallback.
 */

import { readStore } from '../_lib/store.js';
import { readBody, str, allowMethods } from '../_lib/util.js';

export default async function handler(req, res) {
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
