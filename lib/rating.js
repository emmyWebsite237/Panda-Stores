/**
 * Rating helpers shared by the storefront responses.
 *
 * Reviews live in the same store document as products, so aggregating them
 * is a pure in-memory operation and never costs an extra round trip.
 */

export function ratingFor(reviews, productId) {
  const list = (reviews || []).filter((r) => r && r.productId === productId);
  if (!list.length) return { rating: 0, reviewCount: 0 };
  const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  return {
    rating: Math.round((total / list.length) * 10) / 10,
    reviewCount: list.length,
  };
}

/** Site-wide average across every review, used on the home page badges. */
export function siteRating(reviews) {
  const list = (reviews || []).filter((r) => Number(r.rating) > 0);
  if (!list.length) return { rating: 0, reviewCount: 0 };
  const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  return {
    rating: Math.round((total / list.length) * 10) / 10,
    reviewCount: list.length,
  };
}
