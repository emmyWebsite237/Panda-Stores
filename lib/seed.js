/**
 * Default store document.
 * Used to create the store on first run and as the demo-mode dataset.
 * Everything here is editable from the admin dashboard afterwards.
 */

const IMG = (n) => `/images/products/cover-${n}.jpg`;

export const DEFAULT_SETTINGS = {
  storeName: process.env.DEFAULT_STORE_NAME || 'Panda Gaming Store',
  tagline: 'Verified gaming accounts. Delivered in minutes.',
  heroHeadline: 'Level up without the grind.',
  heroSubline:
    'Hand-checked gaming accounts with real inventories, instant WhatsApp delivery and a support team that actually replies.',
  whatsappNumber: (process.env.DEFAULT_WHATSAPP_NUMBER || '2348000000000').replace(/\D/g, ''),
  phoneNumber: process.env.DEFAULT_PHONE_NUMBER || '+234 800 000 0000',
  email: 'hello@pandagamingstore.com',
  instagram: 'https://instagram.com/pandagamingstore',
  tiktok: 'https://tiktok.com/@pandagamingstore',
  telegram: 'https://t.me/pandagamingstore',
  usdToNgn: Number(process.env.DEFAULT_USD_TO_NGN || 1600),
  supportHours: 'Mon – Sat · 9:00am – 9:00pm WAT',
  responseTime: 'Usually replies in under 10 minutes',
  address: 'Lagos, Nigeria · 100% online delivery',
  termsText: `Panda Gaming Store — Purchase Terms

1. Accounts are sold as described. Every listing is checked and screenshotted before it goes live.
2. Prices are listed in USD and charged in Naira at the rate shown on the store. The rate is set by the store and can change without notice.
3. Payment is confirmed on WhatsApp before any account details are released.
4. After delivery you get 24 hours of support to secure the account (email, password and recovery details).
5. Accounts are sold once. Do not share the delivery code or credentials with anyone.
6. Refunds are only issued if an account cannot be delivered or does not match its listing. Change of mind is not a valid reason for a refund.
7. Chargebacks and payment reversals after delivery will be disputed with full evidence.
8. By continuing you confirm you are 18+ or have permission from a parent/guardian, and that you accept these terms.`,
  googleFormSellUrl: '',
  googleFormContactUrl: '',
  showCodeInMessage: true,
  currencyNote: 'Naira price is calculated at the store rate. Final amount is confirmed on WhatsApp.',
  announcement: 'Fresh drops every week · Instant WhatsApp delivery',
};

export const SEED_PRODUCTS = [
  {
    id: 'ff-heroic-01',
    title: 'Free Fire · Heroic Rank, Full Wardrobe',
    game: 'Free Fire',
    priceUsd: 28,
    stock: 3,
    deliveryCode: 'FF-HEROIC-7K2Q',
    description:
      'Heroic-ranked Free Fire account with a fully stocked wardrobe: 62 outfit skins, 3 complete bundle sets and 2 evolution pets maxed to level 6. Never reported, email fully changeable, and it ships with the original linked Facebook for extra security.',
    images: [IMG(1), IMG(3), IMG(5)],
    cover: IMG(1),
    featured: true,
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  },
  {
    id: 'cod-prestige-02',
    title: 'Call of Duty · Prestige 8, Damascus Camo',
    game: 'Call of Duty',
    priceUsd: 72.5,
    stock: 2,
    deliveryCode: 'COD-PRS8-9XM4',
    description:
      'Prestige 8 Call of Duty Mobile / Warzone account with Damascus camo unlocked on 12 weapons, every operator purchased and a battle-pass history going back six seasons. Built for players who want the endgame without the grind.',
    images: [IMG(2), IMG(4), IMG(1)],
    cover: IMG(2),
    featured: true,
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  },
  {
    id: 'bs-elite-03',
    title: 'Blood Strike · Elite Squad Starter',
    game: 'Blood Strike',
    priceUsd: 19.99,
    stock: 5,
    deliveryCode: 'BS-ELITE-3TR8',
    description:
      'Blood Strike account sitting in the Elite Squad bracket with three legendary weapon skins and a rare launch-event character outfit. The fastest, most budget-friendly way for a new player to start ahead of the lobby.',
    images: [IMG(3), IMG(5), IMG(2)],
    cover: IMG(3),
    featured: false,
    createdAt: '2026-09-06T10:00:00.000Z',
    updatedAt: '2026-09-06T10:00:00.000Z',
  },
  {
    id: 'pubg-conq-04',
    title: 'PUBG Mobile · Conqueror Season 14',
    game: 'PUBG Mobile',
    priceUsd: 41,
    stock: 1,
    deliveryCode: 'PUBG-CQ14-6YN2',
    description:
      'PUBG Mobile account that reached Conqueror in Season 14 and currently sits in Ace tier. Comes with a mythic outfit set, the glacier M416 skin and more than 40 crate items still in inventory.',
    images: [IMG(4), IMG(6), IMG(3)],
    cover: IMG(4),
    featured: true,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
  },
  {
    id: 'ff-og-05',
    title: 'Free Fire · 2018 OG Collector',
    game: 'Free Fire',
    priceUsd: 95,
    stock: 1,
    deliveryCode: 'FF-OG18-5HW9',
    description:
      'One of the oldest accounts on the platform — created in 2018, level 80, with early-access bundles and skins that can no longer be obtained in-game. A genuine collector piece for long-time Free Fire players.',
    images: [IMG(5), IMG(1), IMG(6)],
    cover: IMG(5),
    featured: false,
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z',
  },
  {
    id: 'val-immortal-06',
    title: 'Valorant · Immortal 2, Animated Knife',
    game: 'Valorant',
    priceUsd: 54.2,
    stock: 2,
    deliveryCode: 'VAL-IMM2-8KQ3',
    description:
      'Valorant account ranked Immortal 2 with 12 agents unlocked, a Prime Vandal skin and an animated knife skin. Region-locked to NA — message us before buying if you need a different region.',
    images: [IMG(6), IMG(2), IMG(4)],
    cover: IMG(6),
    featured: false,
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:00:00.000Z',
  },
];

/* ---------------------------------------------------------------- *
 * Seeded product reviews.
 * Admins can edit or delete any of these from the dashboard; the
 * storefront averages them into a live rating per listing.
 * ---------------------------------------------------------------- */
export const SEED_REVIEWS = [
  {
    id: 'rev-001',
    productId: 'ff-heroic-01',
    name: 'Kayzo_FF',
    rating: 5,
    body: 'Paid on WhatsApp and had the credentials in under ten minutes. The wardrobe was exactly what the screenshots showed.',
    verified: true,
    createdAt: '2026-09-19T09:12:00.000Z',
  },
  {
    id: 'rev-002',
    productId: 'ff-heroic-01',
    name: 'Tunde_Ade',
    rating: 4,
    body: 'Account was clean and the email changed without a fight. Only gripe is I wanted two more skins in the bundle.',
    verified: true,
    createdAt: '2026-09-24T16:40:00.000Z',
  },
  {
    id: 'rev-003',
    productId: 'cod-prestige-02',
    name: 'NovaStrikes',
    rating: 5,
    body: 'Damascus on all twelve weapons, exactly as listed. They stayed on chat while I locked down the login details.',
    verified: true,
    createdAt: '2026-09-21T11:05:00.000Z',
  },
  {
    id: 'rev-004',
    productId: 'bs-elite-03',
    name: 'Ifeanyi_BS',
    rating: 5,
    body: 'Cheapest Elite Squad starter I found, and it arrived in two minutes. Solid first buy.',
    verified: true,
    createdAt: '2026-09-27T18:22:00.000Z',
  },
  {
    id: 'rev-005',
    productId: 'pubg-conq-04',
    name: 'Ribbit_PUBG',
    rating: 5,
    body: 'Conqueror badge and the glacier M416 were both there. Support answered every question before I paid.',
    verified: true,
    createdAt: '2026-09-29T08:31:00.000Z',
  },
  {
    id: 'rev-006',
    productId: 'val-immortal-06',
    name: 'Zephyr_VAL',
    rating: 4,
    body: 'Immortal 2 with the animated knife, all good. Took a little longer than promised but they kept me updated.',
    verified: true,
    createdAt: '2026-10-02T20:10:00.000Z',
  },
];

export const SEED_ORDERS = [];

export const seedDoc = () => ({
  settings: { ...DEFAULT_SETTINGS },
  products: SEED_PRODUCTS.map((p) => ({ ...p, images: [...p.images] })),
  reviews: SEED_REVIEWS.map((r) => ({ ...r })),
  orders: [],
  updatedAt: new Date().toISOString(),
});
