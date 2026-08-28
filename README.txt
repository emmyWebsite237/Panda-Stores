Panda Store — Full Site (Buyer + Seller Flow)
=================================================

FILES
-----
index.html          → landing page + marketplace + buyer detail panel
sell.html           → seller page with embedded Google Form
assets/style.css    → all shared styling (single theme for both pages)
assets/script.js    → product data, buyer detail panel, WhatsApp + copy logic

-------------------------------------------------------------------
BUYER FLOW (how it works)
-------------------------------------------------------------------
1. Buyer clicks a listing card on index.html.
2. A detail panel opens with full description, price, and reviews.
3. At the BOTTOM of that panel is an "Order ID" box (e.g. PS-FF-001)
   with a Copy button.
4. Below it, a green "Send order on WhatsApp" button opens WhatsApp
   with a message already filled in, containing the Order ID, game,
   listing name and price.
5. You receive that message on your WhatsApp number and take it from
   there (confirm availability, send payment details, etc).

TO SET THIS UP:
- Open assets/script.js
- Change WHATSAPP_NUMBER at the top to your real WhatsApp number,
  in international format with no "+", spaces or dashes.
  Example: "2348012345678"
- Edit the PRODUCTS array in the same file to add/remove/edit
  listings. Each product needs a unique "id" — that id is what
  becomes the Order ID buyers copy and send you.

-------------------------------------------------------------------
SELLER FLOW (how it works)
-------------------------------------------------------------------
1. Seller clicks "Sell an account" and lands on sell.html.
2. Inside a Panda-Store-styled card sits an embedded Google Form
   (iframe) where they fill in: name, WhatsApp number, game, rank/
   level, a price range, and a long paragraph field where they
   describe the account's features in their own words.
3. When they submit, the page detects the form reloading inside the
   iframe and automatically swaps it out for a custom message:
   "We'll take a look at your account's features and price range,
   and contact you soon."
   (There's also a manual "Already submitted?" fallback link in case
   a browser blocks the auto-detection.)

TO SET THIS UP:
1. Go to https://forms.google.com and create a new form with fields
   such as:
     - Your name (short answer)
     - WhatsApp number (short answer)
     - Game (dropdown: Free Fire / COD / Blood Strike / PUBG / other)
     - Account level or rank (short answer)
     - Price range you're hoping for (short answer or dropdown)
     - Describe your account & its features (PARAGRAPH — this is the
       long free-text box for skins, rank history, rare items, etc.)
   Turn on "Collect email addresses" only if you want it — not required.

2. Click Send (top right) → the "<>" embed icon → copy the iframe
   src URL. It looks like:
   https://docs.google.com/forms/d/e/1FAIpQLS.../viewform?embedded=true

3. Open sell.html, find the <iframe id="sellerForm" ...> tag, and
   replace the placeholder src with your real URL.

4. OPTIONAL BUT RECOMMENDED — make it feel less "Google Forms":
   In the Forms editor, click the palette/theme icon (top right),
   and set a dark background colour + a green accent colour so the
   form's own internal theme matches Panda Store. The surrounding
   dark card, browser-bar mockup, and loading spinner in sell.html
   are already styled to match — customizing the form's own colors
   is the last piece that ties it together.

-------------------------------------------------------------------
GENERAL
-------------------------------------------------------------------
- Add more games any time by adding a new object to the PRODUCTS
  array in assets/script.js, and a new filter chip in the
  .games-filter block in index.html (use data-game="YOUR GAME NAME"
  matching the "game" value in PRODUCTS exactly).
- Everything is plain HTML/CSS/JS — upload the whole folder to any
  static host (Netlify, Vercel, GitHub Pages, cPanel, etc). No build
  step required.

Have fun running Panda Store! 🐼🎮
