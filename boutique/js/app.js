// BelleaV — point d'entrée de la boutique (routeur, en-tête, panier, recherche)
import { $, $$, esc, debounce, productImages, norm } from './utils.js';
import { I } from './icons.js';
import { cat, loadCatalog, query } from './catalog.js';
import { cart, wishlist, on, searches } from './store.js';
import { fmt, go, toast, openPanel, closeAll } from './ui.js';
import { cartDrawerHtml, bindLines, href, priceHtml, waLink } from './components.js';
import * as V from './views.js';
import { firebaseConfig } from './config.js';

const routes = [
  [/^$/, V.home],
  [/^boutique$/, V.shop],
  [/^produit\/(.+)$/, V.product],
  [/^panier$/, V.cartPage],
  [/^commande$/, V.checkout],
  [/^merci\/(.+)$/, V.thanks],
  [/^favoris$/, V.wishlistPage],
  [/^suivi(?:\/(.+))?$/, V.track],
  [/^contact$/, V.contact],
  [/^page\/(.+)$/, V.page],
];

function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { path: path.replace(/^\/+|\/+$/g, ''), params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

let current = { fn: null, inst: null, path: null };
function render() {
  const { path, params } = parseHash();
  let fn = V.notFound, m = null;
  for (const [re, f] of routes) { const mm = path.match(re); if (mm) { fn = f; m = mm; break; } }
  const ctx = { path, params, m };
  if (current.fn === fn && current.path === path && current.inst?.update) { current.inst.update(ctx); return; }
  current.inst?.destroy?.();
  closeAll(false);
  const inst = fn(ctx);
  current = { fn, inst, path };
  window.scrollTo({ top: 0, behavior: 'instant' });
  const h = location.hash || '#/';
  $$('.main-nav a, .bottom-nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === h));
  $('#view').focus({ preventScroll: true });
}

/* ---------------- En-tête, menu, pied de page ---------------- */
function buildChrome() {
  const s = cat.settings;
  const cats = [...cat.cats.values()];
  const femme = cats.filter((c) => c.group !== 'enfant');
  const hasPromo = cat.products.some((p) => p._disc && p._stock);
  if (s.announcement) {
    const parts = s.announcement.split('·').map((x) => x.trim()).filter(Boolean);
    $('#announce').innerHTML = `<div class="announce-track">${[...parts, ...parts].map((p) => `<span>${esc(p)}</span>`).join('')}</div>`;
    $('#announce').hidden = false;
  }
  $('#mainNav').innerHTML = `<a href="#/boutique?new=1">Nouveautés</a>${femme.map((c) => `<a href="#/boutique?cat=${c.id}">${esc(c.name)}</a>`).join('')}<a href="#/boutique?group=enfant" class="nav-kids">Fillettes</a>${hasPromo ? '<a href="#/boutique?promo=1" class="nav-promo">Promos</a>' : ''}`;
  $('#menuDrawer').innerHTML = `<div class="drawer-head"><a href="#/" class="logo" data-close>Bellea<span>V</span></a><button class="icon-btn" data-close aria-label="Fermer">${I.close}</button></div>
    <div class="drawer-body menu">
      <a href="#/boutique?new=1" data-close>Nouveautés ${I.chevron}</a>
      ${hasPromo ? `<a href="#/boutique?promo=1" class="nav-promo" data-close>Promotions ${I.chevron}</a>` : ''}
      <p class="menu-title">Femme</p>
      ${femme.map((c) => `<a href="#/boutique?cat=${c.id}" data-close>${esc(c.name)} ${I.chevron}</a>`).join('')}
      <p class="menu-title">Fillettes</p>
      ${cats.filter((c) => c.group === 'enfant').map((c) => `<a href="#/boutique?cat=${c.id}" data-close>${esc(c.name.replace(/^Fillettes\s*—\s*/, ''))} ${I.chevron}</a>`).join('')}
      <p class="menu-title">Mon espace</p>
      <a href="#/favoris" data-close>${I.heart} Mes favoris</a>
      <a href="#/suivi" data-close>${I.box} Suivi de commande</a>
      <a href="#/contact" data-close>${I.mail} Contact</a>
      <a href="${waLink('Bonjour BelleaV !')}" target="_blank" rel="noopener" class="btn btn-accent btn-block mt">${I.whatsapp} Écrire sur WhatsApp</a>
      <button class="btn btn-ghost btn-block install-btn" hidden>${I.download} Installer l'application</button>
    </div>`;
  $('#footer').innerHTML = `<div class="container">
    <div class="foot-grid">
      <div><a href="#/" class="logo light">Bellea<span>V</span></a><p>${esc(s.tagline || '')}</p>
        <div class="socials">${s.instagram ? `<a class="icon-btn round" href="${esc(s.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${I.insta}</a>` : ''}${s.facebook ? `<a class="icon-btn round" href="${esc(s.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${I.fb}</a>` : ''}${s.tiktok ? `<a class="icon-btn round" href="${esc(s.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${I.tiktok}</a>` : ''}${s.whatsapp ? `<a class="icon-btn round" href="${waLink('Bonjour !')}" target="_blank" rel="noopener" aria-label="WhatsApp">${I.whatsapp}</a>` : ''}</div></div>
      <div><h4>Boutique</h4>${femme.slice(0, 6).map((c) => `<a href="#/boutique?cat=${c.id}">${esc(c.name)}</a>`).join('')}<a href="#/boutique?group=enfant">Fillettes</a></div>
      <div><h4>Aide</h4><a href="#/suivi">Suivi de commande</a><a href="#/page/livraison">Livraison</a><a href="#/page/retours">Retours & échanges</a><a href="#/page/guide-tailles">Guide des tailles</a><a href="#/page/faq">FAQ</a></div>
      <div><h4>BelleaV</h4><a href="#/page/a-propos">À propos</a><a href="#/contact">Contact</a>${s.phone ? `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a>` : ''}${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}<button class="link install-btn" hidden>${I.download} Installer l'application</button></div>
    </div>
    <div class="foot-bottom"><span>© ${new Date().getFullYear()} ${esc(s.storeName || 'BelleaV')} — Tous droits réservés</span><span>${I.cash} Paiement à la livraison · ${I.truck} 58 wilayas</span></div>
  </div>`;
  if (!firebaseConfig && !document.querySelector('.demo-flag')) document.body.insertAdjacentHTML('beforeend', '<div class="demo-flag" title="Firebase non configuré : catalogue local et commandes enregistrées dans ce navigateur">Mode démo</div>');
  updateBadges();
}

function updateBadges() {
  const c = cart.count();
  $$('[data-count="cart"]').forEach((b) => { b.textContent = c || ''; b.classList.toggle('show', c > 0); });
  const w = wishlist.ids.filter((id) => cat.byId.has(id)).length;
  $$('[data-count="wish"]').forEach((b) => { b.textContent = w || ''; b.classList.toggle('show', w > 0); });
}

function drawCart() {
  $('#cartDrawer').innerHTML = cartDrawerHtml();
}

/* ---------------- Recherche instantanée ---------------- */
function drawSearch(q = '') {
  const panel = $('#searchPanel');
  if (!panel.dataset.ready) {
    panel.innerHTML = `<div class="container"><div class="search-bar">${I.search}<input type="search" id="sq" placeholder="Rechercher : abaya, hijab crêpe, robe fillette…" autocomplete="off" enterkeyhint="search" aria-label="Rechercher"><button class="icon-btn" data-close aria-label="Fermer">${I.close}</button></div><div id="sres" class="search-res"></div></div>`;
    panel.dataset.ready = 1;
    const input = $('#sq');
    input.addEventListener('input', debounce(() => drawSearch(input.value), 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) { searches.push(input.value); go('/boutique?q=' + encodeURIComponent(input.value.trim())); }
    });
  }
  const res = $('#sres');
  const nq = norm(q);
  if (!nq) {
    const pop = query({ sort: 'populaires', stock: 1 }).slice(0, 4);
    res.innerHTML = `${searches.list.length ? `<div class="s-block"><h5>Recherches récentes <button class="link" id="clearS">Effacer</button></h5><div class="chips">${searches.list.map((x) => `<a class="chip" href="#/boutique?q=${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div></div>` : ''}
      <div class="s-block"><h5>Catégories</h5><div class="chips">${[...cat.cats.values()].map((c) => `<a class="chip" href="#/boutique?cat=${c.id}">${esc(c.name)}</a>`).join('')}</div></div>
      <div class="s-block"><h5>Tendances</h5><div class="s-list">${pop.map(sItem).join('')}</div></div>`;
    $('#clearS')?.addEventListener('click', () => { searches.clear(); drawSearch(''); });
    return;
  }
  const list = query({ q });
  const cats = [...cat.cats.values()].filter((c) => norm(c.name).includes(nq));
  res.innerHTML = list.length || cats.length
    ? `${cats.length ? `<div class="chips">${cats.map((c) => `<a class="chip" href="#/boutique?cat=${c.id}">${esc(c.name)}</a>`).join('')}</div>` : ''}
       <div class="s-list">${list.slice(0, 6).map(sItem).join('')}</div>
       ${list.length ? `<a class="btn btn-dark btn-block" href="#/boutique?q=${encodeURIComponent(q.trim())}">Voir les ${list.length} résultat${list.length > 1 ? 's' : ''}</a>` : ''}`
    : `<div class="empty">${I.search}<p>Aucun résultat pour « ${esc(q)} »</p><p class="muted small">Essayez « abaya », « hijab » ou « robe ».</p></div>`;
}
const sItem = (p) => `<a href="${href(p)}" class="s-item"><img src="${productImages(p)[0]}" alt=""><span><b>${esc(p.name)}</b><small>${esc(cat.cats.get(p.category)?.name || '')}</small></span>${priceHtml(p)}</a>`;

/* ---------------- Événements globaux ---------------- */
function bindGlobal() {
  $('#menuBtn').addEventListener('click', () => openPanel('menuDrawer'));
  $('#cartBtn').addEventListener('click', () => { drawCart(); openPanel('cartDrawer'); });
  $$('[data-open-search]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); drawSearch($('#sq')?.value || ''); openPanel('searchPanel'); setTimeout(() => $('#sq').focus(), 60); }));
  $('#overlay').addEventListener('click', () => closeAll());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('[data-open-search]').click(); }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeAll(!e.target.closest('a')); }
    const w = e.target.closest('[data-wish]');
    if (w) {
      e.preventDefault();
      const on = wishlist.toggle(w.dataset.wish);
      $$(`[data-wish="${w.dataset.wish}"]`).forEach((b) => { b.classList.toggle('on', on); b.innerHTML = on ? I.heartFill : I.heart; });
      toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris', on ? { action: 'Voir', href: '#/favoris' } : {});
    }
    const q = e.target.closest('[data-quick]');
    if (q) {
      e.preventDefault();
      const p = cat.byId.get(q.dataset.quick);
      const instock = (p.sizes || []).filter((s) => s.stock > 0);
      if ((p.sizes || []).length <= 1 && (p.colors || []).length <= 1 && instock.length) {
        cart.add(p.id, instock[0].label, p.colors?.[0]?.name || '', 1, instock[0].stock);
        toast('Ajouté au panier', { action: 'Voir le panier', href: '#/panier' });
      } else V.quickView(p);
    }
    const r = e.target.closest('[data-rail]');
    if (r) {
      const rail = r.closest('.section').querySelector('.rail');
      rail.scrollBy({ left: Number(r.dataset.rail) * rail.clientWidth * 0.85, behavior: 'smooth' });
    }
  });
  bindLines($('#cartDrawer'));
  on('cart', () => { updateBadges(); if ($('#cartDrawer').classList.contains('open')) drawCart(); window.dispatchEvent(new Event('bv-cart')); $('#cartBtn').classList.remove('bump'); void $('#cartBtn').offsetWidth; $('#cartBtn').classList.add('bump'); });
  on('wish', () => { updateBadges(); window.dispatchEvent(new Event('bv-wish')); });
  window.addEventListener('hashchange', render);
  window.addEventListener('route', render);
  window.addEventListener('storage', (e) => { if (e.key === 'bv_cart') { cart.items = JSON.parse(e.newValue || '[]'); updateBadges(); } });
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    document.body.classList.toggle('scrolled', y > 40);
    document.body.classList.toggle('nav-hide', y > 300 && y > lastY + 4);
    if (y < lastY - 4) document.body.classList.remove('nav-hide');
    lastY = y;
  }, { passive: true });
}

/* ---------------- PWA : installation de l'application ---------------- */
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  $$('.install-btn').forEach((b) => (b.hidden = false));
});
document.addEventListener('click', async (e) => {
  if (!e.target.closest('.install-btn') || !deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  $$('.install-btn').forEach((b) => (b.hidden = true));
});

/* ---------------- Démarrage ---------------- */
(async function boot() {
  try {
    await loadCatalog(() => { buildChrome(); current = { fn: null }; render(); toast('Catalogue mis à jour'); });
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="container"><div class="empty big"><h3>Impossible de charger le catalogue</h3><p>Vérifiez votre connexion internet puis réessayez.</p><button class="btn btn-dark" onclick="location.reload()">Réessayer</button></div></div>`;
    return;
  }
  buildChrome();
  bindGlobal();
  render();
  document.body.classList.add('ready');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
