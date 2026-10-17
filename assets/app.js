/* ============================================================
   PANDA GAMING STORE — shared storefront runtime
   Loads settings from /api/config so nothing personal is hardcoded.
   ============================================================ */

const PandaApp = (() => {
  const state = {
    settings: null,
    products: [],
    loaded: false,
    error: null,
  };

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

  /* --------------------------- bootstrap ---------------------------- */

  async function loadConfig({ force = false } = {}) {
    if (state.loaded && !force) return state;
    try {
      const data = await api('/api/config', { method: 'GET' });
      state.settings = data.settings || {};
      state.products = data.products || [];
      state.error = null;
    } catch (err) {
      state.error = err;
      // Keep the site usable: fall back to a neutral shape.
      state.settings = state.settings || {};
      state.products = state.products || [];
      console.error('[panda] config load failed', err);
    } finally {
      state.loaded = true;
    }
    return state;
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

  function mountChrome({ active = '' } = {}) {
    const s = state.settings || {};

    // Header + drawer, injected so every page shares one source of truth.
    const headerHost = document.querySelector('[data-header]');
    if (headerHost) {
      headerHost.innerHTML = `
        <header class="site-header" id="siteHeader">
          <nav class="site-nav" aria-label="Main navigation">
            <a href="/" class="brand">
              <span class="brand-badge" aria-hidden="true">🐼</span>
              <span>${esc(s.storeName || 'Panda Gaming Store')}<small>Accounts · Verified</small></span>
            </a>
            <div class="nav-links">
              <a href="/#marketplace" class="${active === 'marketplace' ? 'active' : ''}">Marketplace</a>
              <a href="/#how" class="${active === 'how' ? 'active' : ''}">How it works</a>
              <a href="/support" class="${active === 'support' ? 'active' : ''}">Support</a>
              <a href="/#faq">FAQ</a>
            </div>
            <div class="nav-actions">
              <a href="/sell-account" class="btn btn-ghost">Sell an account</a>
              <a href="${esc(waLink())}" target="_blank" rel="noopener" class="btn btn-primary">Chat on WhatsApp</a>
              <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">☰</button>
            </div>
          </nav>
        </header>
        <div class="drawer-scrim" id="drawerScrim"></div>
        <aside class="nav-drawer" id="navDrawer" aria-hidden="true">
          <div class="drawer-head">
            <span class="brand"><span class="brand-badge">🐼</span> ${esc(s.storeName || 'Panda Store')}</span>
            <button class="modal-x" id="drawerClose" aria-label="Close menu">✕</button>
          </div>
          <a href="/">Home</a>
          <a href="/#marketplace">Marketplace</a>
          <a href="/#how">How it works</a>
          <a href="/#reviews">Reviews</a>
          <a href="/#faq">FAQ</a>
          <a href="/support">Support</a>
          <div class="drawer-cta">
            <a href="/sell-account" class="btn btn-ghost btn-block">Sell an account</a>
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

    // Footer
    const footerHost = document.querySelector('[data-footer]');
    if (footerHost) {
      const games = [...new Set(state.products.map((p) => p.game).filter(Boolean))].slice(0, 4);
      footerHost.innerHTML = `
        <footer class="site-footer" id="faq">
          <div class="wrap">
            <div class="foot-grid">
              <div class="foot-brand">
                <a href="/" class="brand">
                  <span class="brand-badge" aria-hidden="true">🐼</span>
                  <span>${esc(s.storeName || 'Panda Gaming Store')}<small>Accounts · Verified</small></span>
                </a>
                <p>${esc(s.tagline || 'Verified gaming accounts, delivered in minutes.')}</p>
                <div class="socials">${socialLinks()}</div>
              </div>
              <div class="foot-col">
                <h4>Marketplace</h4>
                ${(games.length ? games : ['Free Fire', 'Call of Duty', 'PUBG Mobile', 'Valorant'])
                  .map((g) => `<a href="/#marketplace" data-game-link="${esc(g)}">${esc(g)}</a>`)
                  .join('')}
              </div>
              <div class="foot-col">
                <h4>Store</h4>
                <a href="/#how">How it works</a>
                <a href="/#reviews">Reviews</a>
                <a href="/sell-account">Sell your account</a>
                <a href="/support">Contact & support</a>
              </div>
              <div class="foot-col">
                <h4>Policies</h4>
                <a href="/#terms" data-open-terms>Purchase terms</a>
                <a href="/support">Report an issue</a>
                <a href="/support">Request an account</a>
                <a href="/#faq">FAQ</a>
              </div>
            </div>
            <div class="foot-bottom">
              <span>© ${new Date().getFullYear()} ${esc(s.storeName || 'Panda Gaming Store')}. All rights reserved.</span>
              <span>${esc(s.supportHours || 'Mon – Sat · 9:00am – 9:00pm')} · ${esc(s.responseTime || 'Fast replies')}</span>
            </div>
          </div>
        </footer>`;
    }

    // Floating call + WhatsApp buttons
    const floatHost = document.querySelector('[data-floaters]');
    if (floatHost) {
      const tel = telLink();
      floatHost.innerHTML = `
        <div class="float-actions">
          ${tel ? `<a class="fab fab-call" href="${esc(tel)}" aria-label="Call the store" title="Call us">${ICONS.phone}</a>` : ''}
          <a class="fab fab-wa" href="${esc(waLink())}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp" title="WhatsApp">${ICONS.whatsapp}</a>
        </div>`;
    }

    // Any element with data-wa gets the live WhatsApp link
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
      el.textContent = s.storeName || 'Panda Gaming Store';
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
        e.preventDefault();
        openTerms();
      });
    });

    // announcement strip
    document.querySelectorAll('[data-announcement]').forEach((el) => {
      if (s.announcement) {
        el.textContent = s.announcement;
      } else {
        el.style.display = 'none';
      }
    });
  }

  /* --------------------------- terms modal --------------------------- */

  let termsWired = false;

  function openTerms() {
    const scrim = document.getElementById('termsModal');
    if (!scrim) {
      // No modal on this page — go to the storefront FAQ/terms section.
      window.location.href = '/#terms';
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
    const count = window.innerWidth < 700 ? 12 : 24;
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
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('err', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* --------------------------- product card -------------------------- */

  function productCard(p) {
    const cover = p.cover || (p.images || [])[0] || '';
    const stock = Number(p.stock) || 0;
    const stockClass = stock === 0 ? 'out' : stock <= 2 ? 'low' : '';
    const stockLabel = stock === 0 ? 'Sold out' : stock <= 2 ? `Only ${stock} left` : `${stock} in stock`;

    return `
      <a class="product-card" href="/account/${encodeURIComponent(p.id)}" aria-label="${esc(p.title)}">
        <div class="product-media">
          ${cover ? `<img src="${esc(cover)}" alt="${esc(p.title)}" loading="lazy" decoding="async">` : `<div class="ph">🎮</div>`}
          <div class="badge-row">
            <span class="badge">${esc(p.game || 'Gaming')}</span>
            ${p.featured ? '<span class="badge badge-featured">Featured</span>' : stock === 0 ? '<span class="badge badge-out">Sold out</span>' : ''}
          </div>
        </div>
        <div class="product-body">
          <div class="product-game">${esc(p.game || 'Gaming account')}</div>
          <h3 class="product-title">${esc(p.title)}</h3>
          <div class="product-price">
            <span class="price-ngn">${nairaFrom(p.priceUsd)}</span>
            <span class="price-usd">${usd(p.priceUsd)}</span>
          </div>
          <div class="product-foot">
            <span class="stock-pill ${stockClass}"><span class="dot"></span>${stockLabel}</span>
            <span class="view-link">View →</span>
          </div>
        </div>
      </a>`;
  }

  /* ------------------------------ init ------------------------------- */

  async function init(options = {}) {
    await loadConfig();
    initFloaters();
    initMarquee();
    mountChrome(options);
    wireTermsModal();
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
    toast,
    openTerms,
    closeTerms,
    ICONS,
  };
})();

window.PandaApp = PandaApp;
