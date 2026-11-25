// Composants métier réutilisables : carte produit, bloc d'achat, panier, totaux
import { esc, productImages, readLS } from './utils.js';
import { feesFor } from './wilayas.js';
import { I } from './icons.js';
import { cat } from './catalog.js';
import { cart, wishlist } from './store.js';
import { fmt, toast, go } from './ui.js';

export const href = (p) => `#/produit/${encodeURIComponent(p.slug || p.id)}`;

export function priceHtml(p, big = false) {
  return `<div class="price ${big ? 'price-lg' : ''}"><span class="now ${p._disc ? 'sale' : ''}">${fmt(p.price)}</span>${p._disc ? `<s>${fmt(p.oldPrice)}</s><span class="pct">-${p._disc}%</span>` : ''}</div>`;
}

export function card(p) {
  const imgs = productImages(p);
  const fresh = p.isNew || Date.now() - p.createdAt < 21 * 864e5;
  const low = p._stock > 0 && p._stock <= 3;
  return `<article class="card" data-id="${p.id}">
    <div class="card-top"><a href="${href(p)}" class="card-media" aria-label="${esc(p.name)}">
      <img src="${imgs[0]}" alt="${esc(p.name)}" loading="lazy" decoding="async">
      ${imgs[1] ? `<img class="alt" src="${imgs[1]}" alt="" loading="lazy" decoding="async">` : ''}
      <div class="badges">${p._stock === 0 ? '<span class="b b-out">Épuisé</span>' : ''}${p._disc ? `<span class="b b-sale">-${p._disc}%</span>` : ''}${fresh && p._stock ? '<span class="b b-new">Nouveau</span>' : ''}</div>
      ${low ? `<span class="card-low">Plus que ${p._stock} !</span>` : ''}
    </a>
    <button class="card-wish ${wishlist.has(p.id) ? 'on' : ''}" data-wish="${p.id}" aria-label="Ajouter aux favoris">${wishlist.has(p.id) ? I.heartFill : I.heart}</button>
    ${p._stock ? `<button class="card-quick" data-quick="${p.id}" aria-label="Ajout rapide">${I.plus}<span>Ajout rapide</span></button>` : ''}</div>
    <div class="card-body">
      <span class="card-cat">${esc(cat.cats.get(p.category)?.name || '')}</span>
      <a href="${href(p)}" class="card-title">${esc(p.name)}</a>
      ${priceHtml(p)}
      ${(p.colors || []).length > 1 ? `<div class="dots">${p.colors.slice(0, 5).map((c) => `<i style="background:${c.hex}" title="${esc(c.name)}"></i>`).join('')}${p.colors.length > 5 ? `<em>+${p.colors.length - 5}</em>` : ''}</div>` : ''}
    </div>
  </article>`;
}

export const grid = (list, cls = '') => `<div class="grid ${cls}">${list.map(card).join('')}</div>`;

export function rail(title, list, link, sub = '') {
  if (!list.length) return '';
  return `<section class="section"><div class="container">
    <div class="sec-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      <div class="rail-ctrl">${link ? `<a href="${link}" class="link-more">Tout voir ${I.chevron}</a>` : ''}<button class="icon-btn round" data-rail="-1" aria-label="Précédent">${I.chevronL}</button><button class="icon-btn round" data-rail="1" aria-label="Suivant">${I.chevron}</button></div></div>
    <div class="rail">${list.map(card).join('')}</div></div></section>`;
}

/* ---------- Bloc d'achat (fiche produit + ajout rapide) ---------- */
export function buyBox(p) {
  const sizes = p.sizes || [];
  return `<div class="buybox" data-pid="${p.id}">
    ${(p.colors || []).length ? `<div class="opt"><div class="opt-label">Couleur : <b data-colorname>${esc(p.colors[0].name)}</b></div>
      <div class="swatches">${p.colors.map((c, i) => `<button class="sw ${i === 0 ? 'on' : ''}" data-color="${esc(c.name)}" data-i="${i}" style="--c:${c.hex}" title="${esc(c.name)}" aria-label="${esc(c.name)}"></button>`).join('')}</div></div>` : ''}
    ${sizes.length ? `<div class="opt"><div class="opt-label">Taille : <b data-sizename>${sizes.length === 1 ? esc(sizes[0].label) : 'choisissez'}</b><a href="#/page/guide-tailles" class="opt-link">${I.ruler} Guide des tailles</a></div>
      <div class="sizes">${sizes.map((s) => `<button class="sz ${sizes.length === 1 && s.stock > 0 ? 'on' : ''}" data-size="${esc(s.label)}" ${s.stock > 0 ? '' : 'disabled'} title="${s.stock > 0 ? '' : 'Épuisé'}">${esc(s.label)}</button>`).join('')}</div>
      <div class="stock-note" data-stocknote></div></div>` : ''}
    <div class="buy-row">
      <div class="qty"><button data-q="-1" aria-label="Moins">${I.minus}</button><input type="number" value="1" min="1" data-qty aria-label="Quantité"><button data-q="1" aria-label="Plus">${I.plus}</button></div>
      <button class="btn btn-dark btn-grow" data-add ${p._stock ? '' : 'disabled'}>${I.bag} ${p._stock ? 'Ajouter au panier' : 'Épuisé'}</button>
      <button class="icon-btn round wish-btn ${wishlist.has(p.id) ? 'on' : ''}" data-wish="${p.id}" aria-label="Favoris">${wishlist.has(p.id) ? I.heartFill : I.heart}</button>
    </div>
    ${p._stock ? `<button class="btn btn-accent btn-block" data-buynow>Commander maintenant · paiement à la livraison</button>` : `<a class="btn btn-ghost btn-block" target="_blank" rel="noopener" href="${waLink(`Bonjour, le produit « ${p.name} » sera-t-il de nouveau disponible ?`)}">${I.whatsapp} Me prévenir du retour en stock</a>`}
  </div>`;
}

export function bindBuyBox(root, p, { onColor, onAdded } = {}) {
  const box = root.querySelector('.buybox');
  const st = { color: p.colors?.[0]?.name || '', size: null, qty: 1 };
  const sizes = p.sizes || [];
  if (sizes.length === 1 && sizes[0].stock > 0) st.size = sizes[0].label;
  const qty = box.querySelector('[data-qty]');
  const note = box.querySelector('[data-stocknote]');
  const stockOf = () => (st.size ? sizes.find((s) => s.label === st.size)?.stock || 0 : p._stock);
  const inCart = () => cart.items.filter((i) => i.productId === p.id && i.size === st.size).reduce((a, i) => a + i.qty, 0);
  const refreshNote = () => {
    if (!note) return;
    const s = stockOf();
    note.innerHTML = st.size ? (s <= 3 ? `<span class="warn">● Plus que ${s} en stock — commandez vite</span>` : `<span class="ok">● En stock, expédié sous 24 h</span>`) : '';
  };
  refreshNote();
  box.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (sw) {
      box.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b === sw));
      st.color = sw.dataset.color;
      box.querySelector('[data-colorname]').textContent = st.color;
      onColor?.(Number(sw.dataset.i));
    }
    const sz = e.target.closest('[data-size]');
    if (sz && !sz.disabled) {
      box.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b === sz));
      st.size = sz.dataset.size;
      box.querySelector('[data-sizename]').textContent = st.size;
      box.querySelector('.sizes').classList.remove('shake');
      refreshNote();
    }
    const q = e.target.closest('[data-q]');
    if (q) qty.value = Math.max(1, Math.min(stockOf() || 1, (Number(qty.value) || 1) + Number(q.dataset.q)));
    const add = e.target.closest('[data-add],[data-buynow]');
    if (add) {
      if (sizes.length && !st.size) {
        const el = box.querySelector('.sizes');
        el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
        toast('Veuillez choisir une taille', { type: 'err' });
        return;
      }
      const n = Math.max(1, Number(qty.value) || 1);
      const left = stockOf() - inCart();
      if (left <= 0) return toast('Quantité maximale déjà dans votre panier', { type: 'err' });
      cart.add(p.id, st.size, st.color, Math.min(n, left), stockOf());
      if (n > left) toast(`Seulement ${left} article(s) ajouté(s) (stock limité)`, { type: 'err' });
      onAdded?.();
      if (add.hasAttribute('data-buynow')) go('/commande');
      else toast('Ajouté au panier', { action: 'Voir le panier', href: '#/panier' });
    }
  });
  qty.addEventListener('change', () => (qty.value = Math.max(1, Math.min(stockOf() || 1, Number(qty.value) || 1))));
}

/* ---------- Panier ---------- */
export function cartLines() {
  return cart.items
    .map((it) => {
      const p = cat.byId.get(it.productId);
      if (!p) return null;
      const size = (p.sizes || []).find((s) => s.label === it.size);
      const max = size ? size.stock : p._stock;
      const ci = Math.max(0, (p.colors || []).findIndex((c) => c.name === it.color));
      return { ...it, p, price: p.price, max, img: productImages(p)[p.images?.length ? 0 : ci] || productImages(p)[0], out: max <= 0 };
    })
    .filter(Boolean);
}

export function getPromo() { return readLS('bv_promo', null); }

export function totals({ lines, wilaya, type = 'home', promo = getPromo() }) {
  const s = cat.settings;
  const valid = lines.filter((l) => !l.out);
  const subtotal = valid.reduce((a, l) => a + l.price * Math.min(l.qty, l.max), 0);
  let discount = 0;
  let promoOk = false;
  if (promo && subtotal >= (promo.minTotal || 0) && (!promo.expiresAt || promo.expiresAt > Date.now())) {
    discount = promo.type === 'percent' ? Math.round((subtotal * promo.value) / 100) : Math.min(promo.value, subtotal);
    promoOk = true;
  }
  const thr = Number(s.freeShippingThreshold) || 0;
  const free = thr > 0 && subtotal - discount >= thr;
  let shipping = null;
  if (wilaya) {
    const f = feesFor(s, wilaya);
    shipping = free ? 0 : type === 'desk' ? f.desk : f.home;
  }
  return { subtotal, discount, promoOk, shipping, free, thr, total: subtotal - discount + (shipping || 0), count: valid.reduce((a, l) => a + l.qty, 0) };
}

export function freeBar(t) {
  if (!t.thr) return '';
  const left = t.thr - (t.subtotal - t.discount);
  const pct = Math.min(100, ((t.subtotal - t.discount) / t.thr) * 100);
  return `<div class="freebar"><p>${left > 0 ? `Plus que <b>${fmt(left)}</b> pour la <b>livraison offerte</b>` : `${I.truck} Félicitations, la <b>livraison est offerte</b> !`}</p><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}

export function lineHtml(l, compact = false) {
  return `<div class="line ${l.out ? 'is-out' : ''}" data-key="${esc(l.key)}">
    <a href="${href(l.p)}" class="line-img"><img src="${l.img}" alt="" loading="lazy"></a>
    <div class="line-info">
      <a href="${href(l.p)}" class="line-name">${esc(l.p.name)}</a>
      <div class="line-meta">${[l.color, l.size].filter(Boolean).map(esc).join(' · ')}</div>
      ${l.out ? '<div class="warn">Épuisé — sera retiré de la commande</div>' : l.qty > l.max ? `<div class="warn">Seulement ${l.max} disponible(s)</div>` : ''}
      <div class="line-bottom">
        ${compact && l.out ? '' : `<div class="qty sm"><button data-lq="-1" aria-label="Moins">${I.minus}</button><span>${l.qty}</span><button data-lq="1" ${l.qty >= l.max ? 'disabled' : ''} aria-label="Plus">${I.plus}</button></div>`}
        <b>${fmt(l.price * l.qty)}</b>
      </div>
    </div>
    <button class="line-x" data-lremove aria-label="Retirer">${I.trash}</button>
  </div>`;
}

export function bindLines(root) {
  root.addEventListener('click', (e) => {
    const line = e.target.closest('[data-key]');
    if (!line) return;
    const k = line.dataset.key;
    const it = cart.items.find((i) => i.key === k);
    if (!it) return;
    if (e.target.closest('[data-lremove]')) { cart.remove(k); toast('Article retiré'); }
    const q = e.target.closest('[data-lq]');
    if (q) {
      const l = cartLines().find((x) => x.key === k);
      cart.setQty(k, Math.min(l?.max || 99, it.qty + Number(q.dataset.lq)));
    }
  });
}

export function cartDrawerHtml() {
  const lines = cartLines();
  const t = totals({ lines });
  return `<div class="drawer-head"><h3>Mon panier <small>(${cart.count()})</small></h3><button class="icon-btn" data-close aria-label="Fermer">${I.close}</button></div>
  ${lines.length ? `${freeBar(t)}<div class="drawer-body lines">${lines.map((l) => lineHtml(l, true)).join('')}</div>
  <div class="drawer-foot"><div class="row"><span>Sous-total</span><b>${fmt(t.subtotal)}</b></div>${t.discount ? `<div class="row accent"><span>Réduction</span><b>-${fmt(t.discount)}</b></div>` : ''}
    <p class="muted small">Livraison calculée à l'étape suivante · Paiement à la livraison</p>
    <a href="#/commande" class="btn btn-dark btn-block" data-close>Commander · ${fmt(t.subtotal - t.discount)}</a>
    <a href="#/panier" class="btn btn-ghost btn-block" data-close>Voir le panier</a></div>`
    : `<div class="empty">${I.bag}<h4>Votre panier est vide</h4><p>Découvrez nos nouveautés et laissez-vous inspirer.</p><a href="#/boutique" class="btn btn-dark" data-close>Découvrir la boutique</a></div>`}`;
}

export function waLink(text) {
  const n = String(cat.settings.whatsapp || '').replace(/\D/g, '').replace(/^0/, '213');
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export const STATUS = {
  nouvelle: { label: 'Reçue', desc: 'Votre commande a bien été reçue.' },
  confirmee: { label: 'Confirmée', desc: 'Nous avons confirmé votre commande par téléphone.' },
  preparation: { label: 'En préparation', desc: 'Vos articles sont soigneusement emballés.' },
  expediee: { label: 'Expédiée', desc: 'Votre colis est en route.' },
  livree: { label: 'Livrée', desc: 'Merci pour votre confiance !' },
  annulee: { label: 'Annulée', desc: 'Cette commande a été annulée.' },
  retournee: { label: 'Retournée', desc: 'Cette commande a été retournée.' },
};
