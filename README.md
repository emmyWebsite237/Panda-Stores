# 🐼 Panda Gaming Store

A complete gaming-account store: a public storefront (browse → terms → WhatsApp handover), a seller submission flow, and a password-protected admin dashboard that drives every piece of content on the site.

Runs on **Vercel** as static HTML + serverless functions. No build step, no bundler, no framework.

---

## Table of contents

- [What's included](#whats-included)
- [Project structure](#project-structure)
- [Local development](#local-development)
- [Admin dashboard](#admin-dashboard)
- [Environment variables](#environment-variables)
- [Deploying to Vercel](#deploying-to-vercel)
- [Persistence modes](#persistence-modes)
- [Cloudinary setup](#cloudinary-setup)
- [FormSubmit setup](#formsubmit-setup)
- [How the buy flow works](#how-the-buy-flow-works)
- [Troubleshooting](#troubleshooting)

---

## What's included

### Public pages
Every navigation link is a real page with its own URL, `<title>`, meta + Open Graph tags and active nav state — no more `#section` anchors.

| Page | Route | What it does |
|---|---|---|
| Home | `/` | Hero, trust badges, featured rail, your favourites rail, how-it-works, live stats, reviews, CTA |
| Shop | `/shop` | Full catalogue with search, game/price/availability filters, wishlist-only toggle and 5 sort modes |
| Product detail | `/account/:id` · `/product/:id` | Swipeable gallery, Naira + USD pricing, rating, terms-gated WhatsApp buy, share, save, reviews, related + recently viewed |
| How it works | `/how-it-works` | Buying and selling processes as numbered flows |
| Reviews | `/reviews` | Rating summary with distribution bars and every published review |
| About | `/about` | The store's story and operating rules |
| FAQ | `/faq` | Accordion FAQ, one panel open at a time |
| Sell your account | `/sell` · `/sell-account` | Submission form with image upload, FormSubmit delivery, Google Form → WhatsApp fallback |
| Contact & support | `/contact` · `/support` | Complaint / account-request form plus direct contact lines and socials |
| Terms | `/terms` | Full purchase & selling terms, driven by admin settings |
| Privacy | `/privacy` | Privacy policy, driven by admin settings |
| 404 | any unknown URL | Branded not-found page answering a real 404 |
| SEO | `/sitemap.xml` · `/robots.txt` | Sitemap of every public page; robots blocks the admin |

All pages are responsive (breakpoints at 1080 / 920 / 720 / 560 / 400px), share `assets/style.css` + `assets/pages.css`, and render their header, footer and floating buttons from one runtime so navigation can never drift.

### Storefront features
- **Search + filters + sorting** — live title search (debounced), game chips, USD price range, in-stock / featured / favourites-only toggles, and sort by price, newest or rating. Filter state is written to the URL, so `/shop?game=Free%20Fire&sort=price-asc` is shareable.
- **Wishlist** — the heart on any card or product page saves to `localStorage`; a "Your favourites" rail appears on the home page.
- **Recently viewed** — the last 12 product pages you opened, shown as a swipeable rail on every product page.
- **Ratings & reviews** — every card shows an average star rating; the product page lists that listing's reviews, and `/reviews` has the full picture with distribution bars.
- **Share** — native share sheet on mobile, clipboard copy on desktop, with a fallback for browsers that support neither.
- **Related products** — same game first, then anything else in stock.

### Floating action buttons
Two fixed circular buttons (call + WhatsApp) sit bottom-right on every public page, generated from admin settings. The stack gap is sized so the WhatsApp pulse ring never touches the call button, and the layout reserves bottom padding on mobile so they never cover content.

### Admin dashboard
- **Password login** — `ADMIN_PASSWORD`, HMAC-signed HttpOnly session cookie, 7-day lifetime (survives refreshes and redeploys).
- **Dashboard stats** — in stock, sold out, total inventory value (USD and Naira at the store rate), new enquiries, review count.
- **Products** — create / edit / delete, title, description, game/category, USD price, stock, delivery code, 2–5 images, featured flag.
- **Bulk stock** — tick any number of listings and set in stock, mark sold out, or nudge stock up/down in one request.
- **Reviews manager** — add, edit and delete reviews; the storefront averages them live.
- **Enquiries log** — every accepted order lands here automatically; track each one through `new → contacted → paid → delivered` (or cancelled).
- **Image uploads** — straight to Cloudinary from the browser. Click any tile to make it the **cover**; the rest become the gallery.
- **Store settings** — store name, tagline, hero copy, announcement, WhatsApp, phone, email, Instagram, TikTok, Telegram, support hours, response time, location, **USD → NGN rate**, currency note, terms text, privacy text, delivery-code toggle, and the two Google Form fallback URLs.
- **Setup & status tab** — shows which integrations are live and which env vars are still missing.

Nothing personal is hardcoded in the HTML: the storefront calls `GET /api/config` on load and renders the name, numbers, socials, rate, terms and privacy text from that response.

---

## Serverless functions (Vercel Hobby limit: 12)

This project ships **7 functions**, comfortably inside the 12-function Hobby allowance. `npm run build` prints the count and **fails the build above 12**, so this can never regress silently.

| Function | Serves |
|---|---|
| `api/health.js` | `GET /api/health` |
| `api/config.js` | `GET /api/config` |
| `api/cloudinary-public.js` | `GET /api/cloudinary-public` |
| `api/products.js` | `GET /api/products` |
| `api/product.js` | `GET /api/products/:id` (via rewrite) |
| `api/admin.js` | **every** admin route: login, logout, session, products, settings, cloudinary-signature, stats, reviews, orders, bulk-stock |
| `api/submit.js` | sell, contact and order logging |

Shared code lives in **`lib/`**, not `api/` — Vercel turns every file under `api/` into a deployed function, but anything outside it is just a module. `vercel.json` rewrites keep each public URL exactly as it was (`/api/admin/products`, `/api/products/:id`, `/api/submit/sell`), so the front-end contract never changed.

**Adding an endpoint?** Add a handler to `lib/routes/admin.js` (or `submit.js`) and a route case, then add the rewrite to `vercel.json`. Do not add a new file under `api/` unless you can afford another function.

---

## Project structure

```
.
├── index.html                     # home
├── shop.html                      # /shop
├── product.html                   # /account/:id, /product/:id
├── about.html                     # /about
├── how-it-works.html              # /how-it-works
├── reviews.html                   # /reviews
├── faq.html                       # /faq
├── sell.html                      # /sell, /sell-account
├── contact.html                   # /contact, /support
├── terms.html                     # /terms
├── privacy.html                   # /privacy
├── 404.html                       # 404 page
├── sitemap.xml · robots.txt
├── pandaviki001stores.html        # admin dashboard
├── assets/
│   ├── style.css                  # design system
│   ├── pages.css                  # components for the expanded page set
│   ├── app.js                     # shared runtime: config, chrome, wishlist, cards
│   ├── style.legacy.css           # original stylesheet, kept for reference
│   └── script.legacy.js           # original script, kept for reference
├── images/products/               # seed cover images
├── api/                           # 7 serverless functions (thin entry points)
│   ├── admin.js · submit.js · config.js · health.js
│   ├── product.js · products.js · cloudinary-public.js
├── lib/                           # shared modules — NOT deployed as functions
│   ├── auth.js · store.js · util.js · seed.js · rating.js
│   └── routes/
│       ├── admin.js               # all admin actions
│       ├── submit.js              # sell / contact / order
│       ├── config.js · health.js · cloudinary-public.js
│       ├── products-list.js · product-detail.js
├── scripts/
│   ├── dev-server.js              # local Vercel emulator (reads vercel.json rewrites)
│   └── build-check.js             # pre-deploy verification + function-count guard
├── vercel.json                    # rewrites + security headers
├── .env.example                   # every variable, documented
├── .nvmrc · .node-version         # Node 24 pins
├── .gitignore                     # keeps secrets out, keeps .env.example in
└── package.json
```

---

## Local development

```bash
npm install          # no dependencies, but sets up the workspace
cp .env.example .env.local
# edit .env.local — at minimum set ADMIN_PASSWORD
npm run dev          # http://localhost:3000
```

`npm run dev` starts `scripts/dev-server.js`, which emulates Vercel: it applies the same rewrites, serves static files, and routes `/api/*` to the serverless handlers with the same `(req, res)` signature (plus `res.status()` / `res.json()` helpers).

Verify before every deploy:

```bash
npm run build        # runs scripts/build-check.js
```

The check parses every JS file, confirms every `/asset` reference resolves (including rewrite routes), validates all JSON, and asserts the admin route is wired. It exits non-zero on failure.

---

## Admin dashboard

**URL:** `/pandaviki001stores`

**Password:** whatever you set in `ADMIN_PASSWORD`.

- **If `ADMIN_PASSWORD` is not set**, the store falls back to the demo password `panda-demo-2026` and the login screen shows a warning. **Set it before going live.**
- Sessions are signed with `ADMIN_SESSION_SECRET` (or derived from the password if unset) and stored in an HttpOnly cookie, so a refresh keeps you signed in. Changing the password invalidates all existing sessions.
- Sign out clears the cookie.

> ⚠️ Changing `ADMIN_PASSWORD` logs out every device — the signing secret is derived from it.

---

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (or `.env.local` locally). `.env.example` has the same list with comments.

### Required

| Variable | Example | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | `a-long-random-string` | Admin login password. Without it the demo fallback is used. |

### Session

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_SESSION_SECRET` | derived from password | HMAC key for the session cookie. Set independently if you want to change the password without logging everyone out. |
| `ADMIN_SESSION_DAYS` | `7` | Session lifetime in days. |

### Store defaults (first run only)

| Variable | Default | Purpose |
|---|---|---|
| `DEFAULT_STORE_NAME` | `Panda Gaming Store` | Initial store name. Editable afterwards in Settings. |
| `DEFAULT_WHATSAPP_NUMBER` | `2348000000000` | Initial WhatsApp number, digits only, with country code. |
| `DEFAULT_USD_TO_NGN` | `1600` | Initial USD → NGN rate. |

### Persistence — pick ONE (both optional, see [Persistence modes](#persistence-modes))

**Supabase:**

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-side only — never expose it) |
| `SUPABASE_TABLE` | Table name, default `panda_store` |

Run this once in the Supabase SQL editor:

```sql
create table if not exists panda_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
```

**Upstash Redis:**

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | REST endpoint from the Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | REST token |

### Cloudinary

| Variable | Purpose |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Your cloud name |
| `CLOUDINARY_UPLOAD_PRESET` | Unsigned preset name (simplest path) |
| `CLOUDINARY_API_KEY` | Used for signed uploads when no preset is set |
| `CLOUDINARY_API_SECRET` | Signs uploads server-side — never reaches the browser |
| `CLOUDINARY_FOLDER` | Folder for uploads, default `panda-gaming-store` |

If `CLOUDINARY_UPLOAD_PRESET` is set, uploads are unsigned (browser → Cloudinary directly). Otherwise the server returns a short-lived signature and the browser posts with `api_key` + `signature`. **Unsigned presets are also used by the public seller form** via `/api/cloudinary-public`; if only signed credentials exist, the public form degrades gracefully to text-only submissions.

### FormSubmit

| Variable | Purpose |
|---|---|
| `FORMSUBMIT_ENDPOINT` | Sell-form endpoint, e.g. `https://formsubmit.co/ajax/you@email.com` |
| `FORMSUBMIT_CONTACT_ENDPOINT` | Contact-form endpoint. Falls back to `FORMSUBMIT_ENDPOINT` when unset. |

Both forms post to `/api/submit/*`, which forwards to FormSubmit server-side (so the email address never appears in the page source). If neither is set, the pages swap in the Google Form URLs configured in **Admin → Store settings → Fallback forms**.

---

## Deploying to Vercel

### 1. Push the project

```bash
git init && git add -A && git commit -m "Panda Gaming Store"
git remote add origin <your-repo-url> && git push -u origin main
```

### 2. Import on Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repo.
2. **Framework preset:** Other (leave build & output settings empty — `vercel.json` sets `framework: null`).
3. **Root directory:** the folder containing `index.html` (repo root if you pushed this folder directly).

### 3. Add environment variables

Project → **Settings → Environment Variables** → add each one from the table above for **Production, Preview and Development**. Then redeploy so the functions pick them up.

### 4. Verify

- `https://your-domain/api/health` → should return `{"ok":true,...}` with your storage mode.
- `https://your-domain/pandaviki001stores` → log in, check **Setup & status** shows everything as Ready.
- Open the storefront, add a product, refresh and confirm it appears.

`vercel.json` also sets `cleanUrls`, so `/pandaviki001stores` works without `.html`, plus security headers (`nosniff`, `SAMEORIGIN`, referrer policy) and long-lived caching for `/images/*`.

---

## Persistence modes

The store picks the first available adapter at runtime:

| Priority | Condition | Behaviour |
|---|---|---|
| 1 | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Permanent. Survives redeploys. |
| 2 | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Permanent. Survives redeploys. |
| 3 | neither set | **Demo mode** — seeded data, edits work in-memory per function instance. |

Demo mode is deliberate: the site is fully clickable out of the box, but products and settings reset when the serverless function recycles. The admin dashboard labels this clearly (`Demo mode` pill + warning on the Setup tab) so it can't be mistaken for a working production store.

The whole store (settings + products) lives in **one JSON document** (`panda-store-doc-v1`), so reads are a single round trip and a write can never leave products and settings out of sync. On first run against an empty database the seed is written automatically.

---

## Cloudinary setup

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Copy **Cloud name** → `CLOUDINARY_CLOUD_NAME`.
3. *Option A — unsigned (easiest):* Settings → Upload → **Add upload preset** → Signing mode **Unsigned** → name it, then set `CLOUDINARY_UPLOAD_PRESET`.
4. *Option B — signed (stricter):* Settings → API Keys → copy **API Key** and **API Secret** into `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`. Leave `CLOUDINARY_UPLOAD_PRESET` empty.

Uploads are capped at 5MB per image in the UI and 2–5 images per product (enforced again server-side).

---

## FormSubmit setup

1. Go to [formsubmit.co](https://formsubmit.co) and enter the email that should receive submissions.
2. Activate the address via the confirmation email.
3. Use the AJAX endpoint: `https://formsubmit.co/ajax/you@email.com` → `FORMSUBMIT_ENDPOINT`.
4. Optionally use a second address for support → `FORMSUBMIT_CONTACT_ENDPOINT`.

The API forwards submissions as multipart form data with `Accept: application/json`, so submitting never leaves the site.

---

## How the buy flow works

1. Buyer opens `/account/:id`. Price shows in Naira (rate from admin settings) with the USD price underneath.
2. **Buy on WhatsApp** opens the terms modal. The **I Agree** button stays disabled for **3 seconds** and until the checkbox is ticked — both conditions required.
3. Tapping it opens `wa.me` with a prefilled message containing the store name, game, listing title, Naira + USD price, and (if enabled) the delivery code.
4. Nothing is charged or delivered automatically — you confirm payment and hand over credentials in WhatsApp.

Sold-out listings disable the buy button and show "ask for a similar account" instead.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Admin says "Demo mode" | No persistence env vars set. Add Supabase or Upstash (see above). |
| Image upload fails in admin | `CLOUDINARY_CLOUD_NAME` missing, or neither `CLOUDINARY_UPLOAD_PRESET` nor the API key/secret pair is set. Check **Setup & status**. |
| Seller form has no image uploader | Public uploads need the **unsigned** preset. Add `CLOUDINARY_UPLOAD_PRESET`. |
| Sell/contact form says "not configured" | Set `FORMSUBMIT_ENDPOINT`, or add Google Form URLs in Settings. |
| Logged out after redeploy | `ADMIN_SESSION_SECRET` isn't set and the password changed — the derived key changed. Set a fixed secret. |
| Products disappear after a while | Demo mode (see above). |
| `/pandaviki001stores` 404s | `vercel.json` wasn't picked up — make sure it's at the project root and redeploy. |

---

## Notes on the original project

The original was a two-page static site with products hardcoded in `assets/script.js` and a Google Form iframe on the sell page. Both original files are preserved as `assets/style.legacy.css` and `assets/script.legacy.js` (plus `_original_backup/`), but are no longer referenced — the new design system and data-driven storefront replace them, keeping the dark gaming palette, bamboo-green accent, emoji-floater background and marquee from the original look.

**License:** UNLICENSED — private project.
