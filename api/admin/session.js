/** GET /api/admin/session — who am I, and what mode is the store in? */

import { isAuthed, usingDefaultPassword } from '../_lib/auth.js';
import { storageMode } from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    authed: isAuthed(req),
    usingDefaultPassword: usingDefaultPassword(),
    storage: storageMode(),
    env: {
      cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      cloudinaryUnsigned: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET
      ),
      cloudinarySigned: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
      ),
      formSubmit: Boolean(process.env.FORMSUBMIT_ENDPOINT),
      formSubmitContact: Boolean(
        process.env.FORMSUBMIT_CONTACT_ENDPOINT || process.env.FORMSUBMIT_ENDPOINT
      ),
    },
  });
}
