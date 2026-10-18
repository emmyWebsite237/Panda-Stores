/**
 * GET /api/cloudinary-public
 *
 * Public upload config for the "Sell your account" form only.
 * Exposes the UNSIGNED preset (safe by design — Cloudinary restricts what an
 * unsigned preset may do). Never exposes the API key or secret. When only
 * signed credentials exist, we deliberately return ok:false so the public
 * form falls back to text-only submissions.
 */

export default async function cloudinaryPublic(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    return res.status(200).json({ ok: false, reason: 'unsigned-upload-not-configured' });
  }

  return res.status(200).json({
    ok: true,
    cloudName,
    preset,
    folder: process.env.CLOUDINARY_FOLDER || 'panda-gaming-store',
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  });
}
