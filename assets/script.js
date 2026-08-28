/* =========================================================
   CONFIG — edit these two values for your real store
   ========================================================= */
const WHATSAPP_NUMBER = "2340000000000"; // <-- replace with your WhatsApp number, no + or spaces
const STORE_NAME = "Panda Store";

/* =========================================================
   PRODUCT DATA — single source of truth for listing cards
   and the detail panel. Add more objects here to add more
   listings (or later, swap this for data fetched from a
   real backend / sheet).
   ========================================================= */
const PRODUCTS = [
  {
    id: "PS-FF-001",
    game: "FREE FIRE",
    title: "Heroic Rank • Full Wardrobe",
    icon: "🔥",
    thumbClass: "thumb-1",
    meta: ["Lv. 68", "62 skins", "Verified ✅"],
    price: "$28.00",
    rating: "★★★★★ (114)",
    description: "Heroic-ranked Free Fire account with a fully stocked wardrobe: 62 outfit skins, 3 bundle sets, and 2 evolution pets maxed to level 6. Account has never been reported, email fully changeable, and comes with original linked Facebook for extra security."
  },
  {
    id: "PS-COD-002",
    game: "CALL OF DUTY",
    title: "Prestige 8 • Damascus Camo",
    icon: "🎯",
    thumbClass: "thumb-2",
    meta: ["Lv. 300+", "All ops unlocked"],
    price: "$72.50",
    rating: "★★★★★ (89)",
    description: "Prestige 8 Call of Duty Mobile / Warzone account with Damascus camo unlocked on 12 weapons, all operators purchased, and a battle pass history going back 6 seasons. Great for anyone who wants to skip the grind entirely."
  },
  {
    id: "PS-BS-003",
    game: "BLOOD STRIKE",
    title: "Elite Squad • Rare Skins",
    icon: "💥",
    thumbClass: "thumb-3",
    meta: ["Lv. 54", "3 legendary items"],
    price: "$19.99",
    rating: "★★★★★ (37)",
    description: "Blood Strike account sitting in the Elite Squad bracket with 3 legendary weapon skins and a rare character outfit from the launch event. Fast, budget-friendly pickup for new players who want a head start."
  },
  {
    id: "PS-PUBG-004",
    game: "PUBG MOBILE",
    title: "Conqueror • Mythic Outfit",
    icon: "🪖",
    thumbClass: "thumb-4",
    meta: ["Season 14", "Ace tier"],
    price: "$41.00",
    rating: "★★★★☆ (65)",
    description: "PUBG Mobile account that reached Conqueror in Season 14, currently sitting Ace tier this season. Comes with a mythic outfit set, glacier M416 skin, and over 40 crate items in inventory."
  },
  {
    id: "PS-FF-005",
    game: "FREE FIRE",
    title: "OG Account • Rare Bundle",
    icon: "🔥",
    thumbClass: "thumb-5",
    meta: ["Lv. 80", "2018 account"],
    price: "$95.00",
    rating: "★★★★★ (152)",
    description: "One of the oldest accounts on the platform — created in 2018, level 80, with early-access bundles and skins that are no longer obtainable in-game. A genuine collector's account for long-time Free Fire fans."
  },
  {
    id: "PS-VAL-006",
    game: "VALORANT",
    title: "Immortal 2 • Knife Skin",
    icon: "⚔️",
    thumbClass: "thumb-6",
    meta: ["Rank Immortal", "12 agents"],
    price: "$54.20",
    rating: "★★★★★ (41)",
    description: "Valorant account ranked Immortal 2 with 12 agents unlocked, a Prime Vandal skin, and an animated knife skin. Region-locked to NA — message us before buying if you need a different region."
  }
];

/* =========================================================
   FLOATING BACKGROUND EMOJIS
   ========================================================= */
(function initFloaters(){
  const container = document.getElementById('floaters');
  if(!container) return;
  const emojis = ['🎮','🔥','⭐','🐼','🏆','💥','🎯','🪖','💰','✨'];
  const count = window.innerWidth < 700 ? 14 : 26;
  for(let i=0;i<count;i++){
    const el = document.createElement('span');
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.left = Math.random()*100 + 'vw';
    el.style.fontSize = (16 + Math.random()*22) + 'px';
    const duration = 14 + Math.random()*16;
    el.style.animationDuration = duration + 's';
    el.style.animationDelay = (Math.random()*duration) + 's';
    container.appendChild(el);
  }
})();

/* =========================================================
   MARQUEE LOOP
   ========================================================= */
(function initMarquee(){
  const marquee = document.getElementById('marquee');
  if(!marquee) return;
  marquee.innerHTML += marquee.innerHTML;
})();

/* =========================================================
   BUYER FLOW — render listings + open detail panel
   ========================================================= */
function renderListings(){
  const grid = document.getElementById('listingGrid');
  if(!grid) return;
  grid.innerHTML = PRODUCTS.map(p => `
    <div class="listing-card" data-id="${p.id}" onclick="openDetail('${p.id}')">
      <div class="listing-thumb ${p.thumbClass}">${p.icon}</div>
      <div class="listing-body">
        <div class="listing-tag">${p.game}</div>
        <div class="listing-title">${p.title}</div>
        <div class="listing-meta">${p.meta.map(m => `<span>${m}</span>`).join('<span>•</span>')}</div>
        <div class="listing-foot">
          <div><div class="listing-price">${p.price}</div><div class="stars">${p.rating}</div></div>
          <span class="mini-btn">View →</span>
        </div>
      </div>
    </div>
  `).join('');
}

function openDetail(id){
  const p = PRODUCTS.find(x => x.id === id);
  if(!p) return;

  document.getElementById('detailThumb').className = 'detail-thumb ' + p.thumbClass;
  document.getElementById('detailThumb').textContent = p.icon;
  document.getElementById('detailTag').textContent = p.game;
  document.getElementById('detailTitle').textContent = p.title;
  document.getElementById('detailMeta').innerHTML = p.meta.map(m => `<span>${m}</span>`).join('<span>•</span>');
  document.getElementById('detailDesc').textContent = p.description;
  document.getElementById('detailPrice').textContent = p.price;
  document.getElementById('detailRating').textContent = p.rating;
  document.getElementById('orderId').textContent = p.id;

  // build the WhatsApp deep link with a pre-filled message
  const message =
`Hi ${STORE_NAME}! 👋 I'd like to buy this account:

🆔 Order ID: ${p.id}
🎮 Game: ${p.game}
📦 Listing: ${p.title}
💰 Price: ${p.price}

Please tell me how to complete payment. Thanks!`;

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  document.getElementById('waButton').setAttribute('href', waLink);

  document.getElementById('detailOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail(){
  document.getElementById('detailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function copyOrderId(){
  const id = document.getElementById('orderId').textContent;
  navigator.clipboard.writeText(id).then(() => {
    const toast = document.getElementById('copiedToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }).catch(() => {
    // fallback for older browsers
    const range = document.createRange();
    const el = document.getElementById('orderId');
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
  });
}

// close panel on background click or Escape key
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('detailOverlay');
  if(overlay && e.target === overlay) closeDetail();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeDetail();
});

// game filter chips (visual filter over PRODUCTS)
function initFilters(){
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const game = chip.dataset.game;
      document.querySelectorAll('.listing-card').forEach(card => {
        const id = card.dataset.id;
        const product = PRODUCTS.find(p => p.id === id);
        const show = game === 'all' || product.game === game;
        card.style.display = show ? '' : 'none';
      });
    });
  });
}

// scroll reveal
function initReveal(){
  const revealEls = document.querySelectorAll('.step, .listing-card, .review-card, .float-card, .tip');
  revealEls.forEach(el=>{ el.style.opacity=0; el.style.transform = (el.style.transform||'') + ' translateY(18px)'; });
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.style.transition = 'opacity .6s ease, transform .6s ease';
        entry.target.style.opacity = 1;
        entry.target.style.transform = entry.target.style.transform.replace(' translateY(18px)','');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:0.12});
  revealEls.forEach(el=>io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  renderListings();
  initFilters();
  initReveal();
});
