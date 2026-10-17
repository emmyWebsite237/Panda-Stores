/**
 * POST /api/admin/cloudinary-signature
 *
 * Returns everything the browser needs to upload straight to Cloudinary.
 *   • unsigned preset configured → hands back cloud name + preset
 *   • otherwise                 → signs a short-lived upload with the API secret
 *
 * The API secret never leaves the server.
 */

import crypto from 'node:crypto';
import { requireAdmin } from '../_lib/auth.js';
import { readBody, allowMethods } from '../_lib/util.js';

export default requireAdmin(async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return res.status(400).json({
      ok: false,
      error:
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME (and CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) on Vercel.',
    });
  }

  const folder = process.env.CLOUDINARY_FOLDER || 'panda-gaming-store';
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (preset) {
    return res.status(200).json({
      ok: true,
      mode: 'unsigned',
      cloudName,
      preset,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({
      ok: false,
      error:
        'Cloudinary needs either CLOUDINARY_UPLOAD_PRESET (unsigned) or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (signed).',
    });
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signatures are built from every param except file/api_key,
  // sorted alphabetically.
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');

  return res.status(200).json({
    ok: true,
    mode: 'signed',
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  });
});
