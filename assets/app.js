/* ============================================================
   PANDA GAMING STORE — shared storefront runtime
   Loads settings from /api/config so nothing personal is hardcoded.
   Navigation points at real pages (no more #section anchors).
   ============================================================ */

const PandaApp = (() => {
  const state = {
    settings: null,
    products: [],
    reviews: [],
    siteRating: { rating: 0, reviewCount: 0 },
    counts: { products: 0, inStock: 0 },
    loaded: false,
    error: null,
  };

  /* --------------------------- site map --------------------------- */
  // One source of truth for navigation, so header/footer/drawer never drift.
  const PAGES = [
    { key: 'home', href: '/', label: 'Home' },
    { key: 'shop', href: '/shop', label: 'Shop' },
    { key: 'how', href: '/how-it-works', label: 'How it works' },
    { key: 'reviews', href: '/reviews', label: 'Reviews' },
    { key: 'about', href: '/about', label: 'About' },
    { key: 'faq', href: '/faq', label: 'FAQ' },
  ];

  const FOOTER_STORE = [
    { href: '/shop', label: 'All accounts' },
    { href: '/how-it-works', label: 'How it works' },
    { href: '/sell', label: 'Sell your account' },
    { href: '/reviews', label: 'Customer reviews' },
  ];

  const FOOTER_HELP = [
    { href: '/contact', label: 'Contact & support' },
    { href: '/faq', label: 'FAQ' },
    { href: '/terms', label: 'Purchase terms' },
    { href: '/privacy', label: 'Privacy policy' },
  ];

  /* ----------------------------- helpers ----------------------------- */

  const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
  }

  function money(naira) {
    const n = Math.round(Number(naira) || 0);
    return `₦${n.toLocaleString('en-NG')}`;
  }

  function usd(n) {
    const v = Number(n) || 0;
    return `$${v.toFixed(2)}`;
  }

  /** USD → NGN using the admin rate. */
  function nairaFrom(usdPrice) {
    const rate = Number(state.settings?.usdToNgn) || 0;
    return money((Number(usdPrice) || 0) * rate);
  }

  function digits(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function waLink(message = '') {
    const num = digits(state.settings?.whatsappNumber);
    if (!num) return '';
    const base = `https://wa.me/${num}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  }

  function telLink() {
    const raw = state.settings?.phoneNumber || '';
    const clean = raw.replace(/[^\d+]/g, '');
    return clean ? `tel:${clean}` : '';
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-json response */
    }
    if (!res.ok) {
      const message = data?.error || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ------------------------ localStorage kit ------------------------ */
  // Everything here is wrapped: private-mode Safari throws on setItem.

  const LS = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };

  const WISH_KEY = 'panda:wishlist:v1';
  const RECENT_KEY = 'panda:recently-viewed:v1';

  function wishlist() {
    const list = LS.get(WISH_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function inWishlist(id) {
    return wishlist().includes(id);
  }

  function toggleWishlist(id) {
    const list = wishlist();
    const i = list.indexOf(id);
    if (i > -1) list.splice(i, 1);
    else list.unshift(id);
    LS.set(WISH_KEY, list.slice(0, 60));
    document.dispatchEvent(new CustomEvent('panda:wishlist', { detail: { id, list } }));
    return list.includes(id);
  }

  function recentlyViewed() {
    const list = LS.get(RECENT_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function rememberViewed(id) {
    if (!id) return;
    const list = recentlyViewed().filter((x) => x !== id);
    list.unshift(id);
    LS.set(RECENT_KEY, list.slice(0, 12));
  }

  /** Resolve stored ids against the catalogue we just loaded. */
  function productsByIds(ids) {
    const map = new Map(state.products.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  /* ----------------------------- chrome ----------------------------- */

  const ICONS = {
    instagram:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.9.25 2.4.44.6.24 1.1.55 1.6 1.05.5.5.8 1 1.05 1.6.19.5.38 1.2.44 2.4.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.9-.44 2.4-.24.6-.55 1.1-1.05 1.6-.5.5-1 .8-1.6 1.05-.5.19-1.2.38-2.4.44-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.9-.25-2.4-.44a4.4 4.4 0 0 1-1.6-1.05c-.5-.5-.8-1-1.05-1.6-.19-.5-.38-1.2-.44-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.9.44-2.4.24-.6.55-1.1 1.05-1.6.5-.5 1-.8 1.6-1.05.5-.19 1.2-.38 2.4-.44C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.07-1 .04-1.5.2-1.9.35-.4.16-.7.35-1 .65-.3.3-.5.6-.65 1-.15.4-.3.9-.35 1.9-.06 1.2-.07 1.6-.07 4.7s0 3.5.07 4.7c.04 1 .2 1.5.35 1.9.16.4.35.7.65 1 .3.3.6.5 1 .65.4.15.9.3 1.9.35 1.2.06 1.6.07 4.7.07s3.5 0 4.7-.07c1-.04 1.5-.2 1.9-.35.4-.16.7-.35 1-.65.3-.3.5-.6.65-1 .15-.4.3-.9.35-1.9.06-1.2.07-1.6.07-4.7s0-3.5-.07-4.7c-.04-1-.2-1.5-.35-1.9-.16-.4-.35-.7-.65-1-.3-.3-.6-.5-1-.65-.4-.15-.9-.3-1.9-.35-1.2-.06-1.6-.07-4.7-.07Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Zm5.1-2.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/></svg>',
    tiktok:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.6 2h-3.1v13.4a2.9 2.9 0 1 1-2.4-2.9v-3.2a6.1 6.1 0 1 0 5.5 6v-6a8 8 0 0 0 4.5 1.4V7.6a4.8 4.8 0 0 1-4.5-4.7V2Z"/></svg>',
    telegram:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.7 3.4 2.9 10.7c-1.2.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.5c.2.6.4.7 1 .7.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8l3-14.2c.3-1.2-.4-1.7-1.5-1.3ZM8.6 13.5l9.3-5.9c.4-.3.8-.1.5.2l-7.9 7.2-.3 3.1-1.6-4.6Z"/></svg>',
    whatsapp:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 0 1 6.9 12.6l-.4.6.6 2.3-2.4-.6-.6.3A8.2 8.2 0 1 1 12 3.8Zm-3 3.5c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.2 3.8 2 .8 2.4.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2 0-.1-.2-.2-.4-.3l-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.3.1-.4l.4-.5c.2-.2.2-.3.3-.5v-.5l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.2Z"/></svg>',
    phone:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 2.5c.5 0 1 .3 1.2.8l1.5 3c.2.5.1 1.1-.3 1.5l-1 1c-.2.2-.2.5-.1.7a12 12 0 0 0 5.6 5.6c.2.1.5.1.7-.1l1-1c.4-.4 1-.5 1.5-.3l3 1.5c.5.2.8.7.8 1.2v2.3c0 1.1-.9 2-2 1.9C9.9 20.2 3.8 14.1 3.4 5.5c0-1.1.8-2 1.9-2h1.3Z"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.6 3.9 12.5a5.1 5.1 0 0 1 0-7.2 5.1 5.1 0 0 1 7.2 0l.9.9.9-.9a5.1 5.1 0 0 1 7.2 0 5.1 5.1 0 0 1 0 7.2L12 20.6Z"/></svg>',
    share:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.1c-.8 0-1.5.3-2 .8l-7.1-4.1c.1-.2.1-.5.1-.8s0-.6-.1-.8l7-4.1c.5.5 1.3.9 2.1.9a2.9 2.9 0 1 0-2.9-2.9c0 .3 0 .6.1.8L8.2 9.8a2.9 2.9 0 1 0 0 4.4l7.1 4.2c0 .2-.1.5-.1.7A2.9 2.9 0 1 0 18 16.1Z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.3 1.3-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 1.8a5.7 5.7 0 1 0 0 11.4 5.7 5.7 0 0 0 0-11.4Z"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9 2.9-6Z"/></svg>',
  };

  function socialLinks() {
    const s = state.settings || {};
    const list = [
      ['instagram', s.instagram, 'Instagram'],
      ['tiktok', s.tiktok, 'TikTok'],
      ['telegram', s.telegram, 'Telegram'],
    ];
    const wa = waLink();
    if (wa) list.unshift(['whatsapp', wa, 'WhatsApp']);

    return list
      .filter(([, url]) => Boolean(url))
      .map(
        ([key, url, label]) =>
          `<a class="social-btn" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${label}" title="${label}">${ICONS[key]}</a>`
      )
      .join('');
  }

  function navLink(page, active) {
    return `<a href="${page.href}" class="${page.key === active ? 'active' : ''}"${
      page.key === active ? ' aria-current="page"' : ''
    }>${page.label}</a>`;
  }

  function mountChrome({ active = '' } = {}) {
    const s = state.settings || {};
    const storeName = s.storeName || 'Panda Gaming Store';

    /* ------------------------------ header ------------------------------ */
    const headerHost = document.querySelector('[data-header]');
    if (headerHost) {
      headerHost.innerHTML = `
        <header class="site-header" id="siteHeader">
          <nav class="site-nav" aria-label="Main navigation">
            <a href="/" class="brand">
              <span class="brand-badge" aria-hidden="true">🐼</span>
              <span>${esc(storeName)}<small>Accounts · Verified</small></span>
            </a>
            <div class="nav-links">
              ${PAGES.map((p) => navLink(p, active)).join('')}
            </div>
            <div class="nav-actions">
              <a href="/shop" class="nav-search-btn" aria-label="Search accounts" title="Search accounts">${ICONS.search}</a>
              <a href="/sell" class="btn btn-ghost">Sell an account</a>
              <a href="${esc(waLink())}" target="_blank" rel="noopener" class="btn btn-primary">Chat on WhatsApp</a>
              <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">☰</button>
            </div>
          </nav>
        </header>
        <div class="drawer-scrim" id="drawerScrim"></div>
        <aside class="nav-drawer" id="navDrawer" aria-hidden="true" aria-label="Mobile navigation">
          <div class="drawer-head">
            <span class="brand"><span class="brand-badge">🐼</span> ${esc(storeName)}</span>
            <button class="modal-x" id="drawerClose" aria-label="Close menu">✕</button>
          </div>
          ${PAGES.map((p) => navLink(p, active)).join('')}
          <a href="/sell">Sell your account</a>
          <a href="/contact">Contact &amp; support</a>
          <div class="drawer-cta">
            <a href="/shop" class="btn btn-ghost btn-block">Browse accounts</a>
            <a href="${esc(waLink())}" target="_blank" rel="noopener" class="btn btn-primary btn-block">WhatsApp us</a>
          </div>
        </aside>`;

      const toggle = document.getElementById('navToggle');
      const drawer = document.getElementById('navDrawer');
      const scrim = document.getElementById('drawerScrim');
      const close = () => {
        drawer?.classList.remove('open');
        scrim?.classList.remove('open');
        toggle?.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      };
      toggle?.addEventListener('click', () => {
        drawer?.classList.add('open');
        scrim?.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      });
      document.getElementById('drawerClose')?.addEventListener('click', close);
      scrim?.addEventListener('click', close);
      document.addEventListener('keydown', (e) => e.key === 'Escape' && close());

      const header = document.getElementById('siteHeader');
      const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 12);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ------------------------------ footer ------------------------------ */
    const footerHost = document.querySelector('[data-footer]');
    if (footerHost) {
      const games = [...new Set(state.products.map((p) => p.game).filter(Boolean))].slice(0, 4);
      footerHost.innerHTML = `
        <footer class="site-footer">
          <div class="wrap">
            <div class="foot-grid">
              <div class="foot-brand">
                <a href="/" class="brand">
                  <span class="brand-badge" aria-hidden="true">🐼</span>
                  <span>${esc(storeName)}<small>Accounts · Verified</small></span>
                </a>
                <p>${esc(s.tagline || 'Verified gaming accounts, delivered in minutes.')}</p>
                <div class="socials">${socialLinks()}</div>
              </div>
              <div class="foot-col">
                <h4>Shop by game</h4>
                ${(games.length ? games : ['Free Fire', 'Call of Duty', 'PUBG Mobile', 'Valorant'])
                  .map((g) => `<a href="/shop?game=${encodeURIComponent(g)}">${esc(g)}</a>`)
                  .join('')}
                <a href="/shop">All accounts →</a>
              </div>
              <div class="foot-col">
                <h4>Store</h4>
                ${FOOTER_STORE.map((l) => `<a href="${l.href}">${l.label}</a>`).join('')}
              </div>
              <div class="foot-col">
                <h4>Help &amp; legal</h4>
                ${FOOTER_HELP.map((l) => `<a href="${l.href}">${l.label}</a>`).join('')}
              </div>
            </div>
            <div class="foot-bottom">
              <span>© ${new Date().getFullYear()} ${esc(storeName)}. All rights reserved.</span>
              <span>${esc(s.supportHours || 'Mon – Sat · 9:00am – 9:00pm')} · ${esc(
        s.responseTime || 'Fast replies'
      )}</span>
            </div>
          </div>
        </footer>`;
    }

    /* -------------------------- floating buttons -------------------------- */
    const floatHost = document.querySelector('[data-floaters]');
    if (floatHost) {
      const tel = telLink();
      const wa = waLink('Hi! I would like to buy a gaming account.');
      floatHost.innerHTML = `
        <div class="float-actions">
          ${tel ? `<a class="fab fab-call" href="${esc(tel)}" aria-label="Call the store" title="Call us">${ICONS.phone}</a>` : ''}
          ${wa ? `<a class="fab fab-wa" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp" title="WhatsApp">${ICONS.whatsapp}</a>` : ''}
        </div>`;
    }

    /* --------------------------- data bindings --------------------------- */

    document.querySelectorAll('[data-wa]').forEach((el) => {
      const prefix = el.getAttribute('data-wa') || '';
      el.setAttribute('href', waLink(prefix || ''));
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    });

    document.querySelectorAll('[data-tel]').forEach((el) => {
      const tel = telLink();
      if (tel) {
        el.setAttribute('href', tel);
        el.textContent = s.phoneNumber || tel;
      } else {
        el.removeAttribute('href');
      }
    });

    document.querySelectorAll('[data-store-name]').forEach((el) => {
      el.textContent = storeName;
    });

    document.querySelectorAll('[data-email]').forEach((el) => {
      if (s.email) {
        el.setAttribute('href', `mailto:${s.email}`);
        el.textContent = s.email;
      } else {
        el.closest('.contact-line')?.remove();
      }
    });

    document.querySelectorAll('[data-open-terms]').forEach((el) => {
      el.addEventListener('click', (e) => {
        // Real page now — the anchor is a genuine link to /terms.
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        openTerms();
      });
    });

    document.querySelectorAll('[data-announcement]').forEach((el) => {
      if (s.announcement) el.textContent = s.announcement;
      else el.style.display = 'none';
    });

    document.querySelectorAll('[data-hero-headline]').forEach((el) => {
      if (s.heroHeadline) el.textContent = s.heroHeadline;
    });

    document.querySelectorAll('[data-hero-subline]').forEach((el) => {
      if (s.heroSubline) el.textContent = s.heroSubline;
    });

    document.querySelectorAll('[data-tagline]').forEach((el) => {
      if (s.tagline) el.textContent = s.tagline;
    });

    document.querySelectorAll('[data-about-text]').forEach((el) => {
      if (s.aboutText) el.textContent = s.aboutText;
    });

    document.querySelectorAll('[data-support-hours]').forEach((el) => {
      el.textContent = s.supportHours || 'Mon – Sat · 9:00am – 9:00pm';
    });

    document.querySelectorAll('[data-response-time]').forEach((el) => {
      el.textContent = s.responseTime || 'Usually replies in under 10 minutes';
    });

    document.querySelectorAll('[data-address]').forEach((el) => {
      el.textContent = s.address || 'Lagos, Nigeria · 100% online delivery';
    });

    document.querySelectorAll('[data-currency-note]').forEach((el) => {
      el.textContent = s.currencyNote || '';
    });
  }

  /* --------------------------- terms modal --------------------------- */

  let termsWired = false;

  function openTerms() {
    const scrim = document.getElementById('termsModal');
    if (!scrim) {
      window.location.href = '/terms';
      return;
    }
    scrim.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeTerms() {
    const scrim = document.getElementById('termsModal');
    if (!scrim) return;
    scrim.classList.remove('open');
    document.body.style.overflow = '';
  }

  function wireTermsModal() {
    if (termsWired) return;
    termsWired = true;
    const scrim = document.getElementById('termsModal');
    if (!scrim) return;
    const body = document.getElementById('termsBody');
    if (body) body.textContent = state.settings?.termsText || 'Terms are being updated.';
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) closeTerms();
    });
    document.querySelectorAll('[data-close-terms]').forEach((b) =>
      b.addEventListener('click', closeTerms)
    );
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeTerms());
  }

  /* ----------------------------- floaters ---------------------------- */

  function initFloaters() {
    const container = document.getElementById('floaters');
    if (!container) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const emojis = ['🎮', '🔥', '⭐', '🐼', '🏆', '💥', '🎯', '🛡️', '💰', '✨'];
    const count = window.innerWidth < 700 ? 10 : 20;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement('span');
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = `${Math.random() * 100}vw`;
      el.style.fontSize = `${14 + Math.random() * 20}px`;
      const duration = 16 + Math.random() * 16;
      el.style.animationDuration = `${duration}s`;
      el.style.animationDelay = `${Math.random() * duration}s`;
      frag.appendChild(el);
    }
    container.appendChild(frag);
  }

  function initMarquee() {
    const track = document.getElementById('marquee');
    if (!track) return;
    track.innerHTML += track.innerHTML;
  }

  /* ------------------------------ toast ------------------------------ */

  let toastTimer = null;
  function toast(message, isError = false) {
    let el = document.getElementById('appToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appToast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('err', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* --------------------------- rating bits --------------------------- */

  function stars(rating) {
    const r = Math.round((Number(rating) || 0) * 2) / 2;
    const full = Math.floor(r);
    const half = r % 1 >= 0.5;
    return '★'.repeat(full) + (half ? '⯨' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
  }

  function ratingHtml(p) {
    if (!p.reviewCount) return '';
    return `<span class="rating-inline" title="${p.rating} out of 5 from ${p.reviewCount} review${
      p.reviewCount === 1 ? '' : 's'
    }"><span class="stars">${stars(p.rating)}</span><span class="rating-num">${esc(
      String(p.rating)
    )}</span><span class="rating-count">(${p.reviewCount})</span></span>`;
  }

  /* --------------------------- product card -------------------------- */

  function productCard(p) {
    const cover = p.cover || (p.images || [])[0] || '';
    const stock = Number(p.stock) || 0;
    const stockClass = stock === 0 ? 'out' : stock <= 2 ? 'low' : '';
    const stockLabel = stock === 0 ? 'Sold out' : stock <= 2 ? `Only ${stock} left` : `${stock} in stock`;
    const saved = inWishlist(p.id);

    return `
      <article class="product-card">
        <div class="product-media">
          <a href="/account/${encodeURIComponent(p.id)}" class="product-media-link" aria-label="${esc(
      p.title
    )}">
            ${
              cover
                ? `<img src="${esc(cover)}" alt="${esc(p.title)}" loading="eager" decoding="async">`
                : `<div class="ph">🎮</div>`
            }
          </a>
          <div class="badge-row">
            <span class="badge">${esc(p.game || 'Gaming')}</span>
            ${p.featured ? '<span class="badge badge-featured">Featured</span>' : stock === 0 ? '<span class="badge badge-out">Sold out</span>' : ''}
          </div>
          <button class="wish-btn ${saved ? 'saved' : ''}" data-wish="${esc(p.id)}" aria-label="${
      saved ? 'Remove from favourites' : 'Save to favourites'
    }" aria-pressed="${saved}" title="${saved ? 'Remove from favourites' : 'Save to favourites'}">${ICONS.heart}</button>
        </div>
        <div class="product-body">
          <div class="product-game">${esc(p.game || 'Gaming account')}</div>
          <h3 class="product-title"><a href="/account/${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>
          ${ratingHtml(p)}
          <div class="product-price">
            <span class="price-ngn">${nairaFrom(p.priceUsd)}</span>
            <span class="price-usd">${usd(p.priceUsd)}</span>
          </div>
          <div class="product-foot">
            <span class="stock-pill ${stockClass}"><span class="dot"></span>${stockLabel}</span>
            <a class="view-link" href="/account/${encodeURIComponent(p.id)}">View →</a>
          </div>
        </div>
      </article>`;
  }

  /** Delegated so every card/link on the page works, including re-renders. */
  function wireWishlistButtons(root = document) {
    root.querySelectorAll('[data-wish]').forEach((btn) => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.wish;
        const saved = toggleWishlist(id);
        btn.classList.toggle('saved', saved);
        btn.setAttribute('aria-pressed', String(saved));
        toast(saved ? 'Saved to favourites' : 'Removed from favourites');
      });
    });
  }

  /* ------------------------- reviews rendering ------------------------- */

  function reviewCard(r) {
    return `
      <div class="review-card">
        <div class="review-top">
          <div class="avatar">${esc((r.name || 'G').trim().charAt(0).toUpperCase())}</div>
          <div>
            <div class="review-name">${esc(r.name || 'Gamer')}</div>
            <div class="review-sub">${esc(
              new Date(r.createdAt || Date.now()).toLocaleDateString('en-GB', {
                month: 'short',
                year: 'numeric',
              })
            )}</div>
          </div>
        </div>
        <div class="stars stars-static">${stars(r.rating)}</div>
        <p class="review-body">${esc(r.body || '')}</p>
        ${r.verified ? '<span class="review-verified">✓ VERIFIED PURCHASE</span>' : ''}
      </div>`;
  }

  /* ------------------------------ share ------------------------------ */

  async function shareProduct(product, buttonEl) {
    const url = `${window.location.origin}/account/${encodeURIComponent(product.id)}`;
    const text = `${product.title} — ${nairaFrom(product.priceUsd)} on ${
      state.settings?.storeName || 'Panda Gaming Store'
    }`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('Link copied — share it anywhere');
      if (buttonEl) buttonEl.classList.add('copied');
    } catch (err) {
      // User dismissed the share sheet: not an error worth shouting about.
      if (err?.name === 'AbortError') return;
      window.prompt('Copy this link:', `${text}\n${url}`);
    }
  }

  /* ------------------------------ init ------------------------------- */

  async function loadConfig({ force = false } = {}) {
    if (state.loaded && !force) return state;
    try {
      const data = await api('/api/config', { method: 'GET' });
      state.settings = data.settings || {};
      state.products = data.products || [];
      state.reviews = data.reviews || [];
      state.siteRating = data.siteRating || { rating: 0, reviewCount: 0 };
      state.counts = data.counts || { products: 0, inStock: 0 };
      state.error = null;
    } catch (err) {
      state.error = err;
      state.settings = state.settings || {};
      state.products = state.products || [];
      console.error('[panda] config load failed', err);
    } finally {
      state.loaded = true;
    }
    return state;
  }

  async function init(options = {}) {
    await loadConfig();
    initFloaters();
    initMarquee();
    mountChrome(options);
    wireTermsModal();
    wireWishlistButtons();
    document.dispatchEvent(new CustomEvent('panda:ready', { detail: state }));
    return state;
  }

  return {
    state,
    init,
    loadConfig,
    api,
    esc,
    money,
    usd,
    nairaFrom,
    waLink,
    telLink,
    socialLinks,
    productCard,
    reviewCard,
    stars,
    ratingHtml,
    toast,
    openTerms,
    closeTerms,
    // wishlist + recently viewed
    wishlist,
    inWishlist,
    toggleWishlist,
    wireWishlistButtons,
    recentlyViewed,
    rememberViewed,
    productsByIds,
    shareProduct,
    PAGES,
    ICONS,
  };
})();

window.PandaApp = PandaApp;
