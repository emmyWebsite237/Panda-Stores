/** GET /api/health — quick check that the deployment wired up correctly. */

import { storageMode, readStore } from '../store.js';

export default async function health(req, res) {
  const doc = await readStore();
  return res.status(200).json({
    ok: true,
    service: 'panda-gaming-store',
    storage: storageMode(),
    products: doc.products.length,
    reviews: (doc.reviews || []).length,
    functions: 7,
    updatedAt: doc.updatedAt,
    integrations: {
      cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      formSubmit: Boolean(process.env.FORMSUBMIT_ENDPOINT || process.env.FORMSUBMIT_CONTACT_ENDPOINT),
      adminPasswordSet: Boolean(process.env.ADMIN_PASSWORD),
    },
  });
}
