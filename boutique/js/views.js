// Pages de la boutique
import { $, $$, esc, debounce, productImages, norm, cleanPhone, phoneOk, genOrderCode, promoHash, writeLS, readLS, fmtDate, toMs } from './utils.js';
import { WILAYAS, feesFor, wilayaName } from './wilayas.js';
import { I } from './icons.js';
import { cat, query, facets, related } from './catalog.js';
import { cart, wishlist, recent, customer, searches } from './store.js';
import { fmt, toast, go, setParams, openModal } from './ui.js';
import { card, grid, rail, priceHtml, buyBox, bindBuyBox, cartLines, totals, freeBar, lineHtml, bindLines, href, waLink, STATUS, getPromo } from './components.js';
import { placeOrder, getOrder, sendMessage } from './orders.js';
import { CONFIG } from './config.js';

const view = () => $('#view');
const title = (t) => (document.title = t ? `${t} · ${cat.settings.storeName || 'BelleaV'}` : `${cat.settings.storeName || 'BelleaV'} — Mode modeste, hijabs & abayas`);
const nl2p = (s) => esc(s || '').split(/\n{2,}/).map((b) => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
const crumbs = (items) => `<nav class="crumbs" aria-label="Fil d'Ariane"><a href="#/">Accueil</a>${items.map(([l, h]) => (h ? ` / <a href="${h}">${esc(l)}</a>` : ` / <span>${esc(l)}</span>`)).join('')}</nav>`;

/* =========================== ACCUEIL =========================== */
export function home() {
  title();
  const s = cat.settings;
  const P = cat.products.filter((p) => p._stock > 0);
  const femmeCats = [...cat.cats.values()].filter((c) => c.group !== 'enfant');
  const kidCats = [...cat.cats.values()].filter((c) => c.group === 'enfant');
  const news = [...P].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  const best = [...P].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 12);
  const feat = P.filter((p) => p.featured && cat.cats.get(p.category)?.group !== 'enfant').slice(0, 8);
  const kids = P.filter((p) => cat.cats.get(p.category)?.group === 'enfant').slice(0, 4);
  const maxDisc = Math.max(0, ...P.map((p) => p._disc));
  const heroImgs = (feat.length ? feat : P).slice(0, 3).map((p) => productImages(p)[0]);
  const rec = recent.ids.map((id) => cat.byId.get(id)).filter(Boolean).slice(0, 8);
  const catImg = (c) => c.image || productImages(cat.products.find((p) => p.category === c.id) || { category: c.id })[0];

  view().innerHTML = `
  <section class="hero">
    <div class="container hero-in">
      <div class="hero-txt">
        <span class="eyebrow">${esc(s.tagline || 'Mode modeste')}</span>
        <h1>${esc(s.hero?.title || 'La nouvelle collection')}</h1>
        <p>${esc(s.hero?.subtitle || '')}</p>
        <div class="hero-cta"><a href="#/boutique?new=1" class="btn btn-dark btn-lg">${esc(s.hero?.cta || 'Découvrir')}</a><a href="#/boutique?group=enfant" class="btn btn-ghost btn-lg">Espace Fillettes</a></div>
        <ul class="hero-points"><li>${I.truck} 58 wilayas</li><li>${I.cash} Paiement à la livraison</li><li>${I.refresh} Échange 7 jours</li></ul>
      </div>
      <div class="hero-vis">${s.hero?.image ? `<img class="hero-single" src="${esc(s.hero.image)}" alt="">` : heroImgs.map((src, i) => `<img class="h${i}" src="${src}" alt="">`).join('')}</div>
    </div>
  </section>

  <section class="section"><div class="container">
    <div class="sec-head center"><div><h2>Nos univers</h2><p>Trouvez la pièce qui vous ressemble</p></div></div>
    <div class="cats">${femmeCats.map((c) => `<a href="#/boutique?cat=${c.id}" class="cat-tile"><img src="${catImg(c)}" alt="" loading="lazy"><span><b>${esc(c.name)}</b><small>${cat.products.filter((p) => p.category === c.id).length} articles</small></span></a>`).join('')}</div>
  </div></section>

  ${rail('Nouveautés', news, '#/boutique?sort=nouveautes', 'Les dernières pièces arrivées en boutique')}

  ${maxDisc ? `<section class="section"><div class="container"><a href="#/boutique?promo=1" class="promo-band"><div><span class="eyebrow light">Offres du moment</span><h2>Jusqu'à -${maxDisc}% sur une sélection</h2><p>Profitez-en avant épuisement des stocks</p></div><span class="btn btn-light">Voir les promos ${I.chevron}</span></a></div></section>` : ''}

  ${feat.length ? `<section class="section"><div class="container"><div class="sec-head"><div><h2>Coups de cœur</h2><p>Notre sélection du moment</p></div><a href="#/boutique" class="link-more">Toute la boutique ${I.chevron}</a></div>${grid(feat)}</div></section>` : ''}

  ${kids.length ? `<section class="section"><div class="container"><div class="kids-space">
    <div class="kids-txt"><span class="eyebrow">Petit espace</span><h2>Fillettes</h2><p>Des tenues douces et modestes de 2 à 12 ans, assorties à maman.</p>
      <div class="chips">${kidCats.map((c) => `<a href="#/boutique?cat=${c.id}" class="chip">${esc(c.name.replace(/^Fillettes\s*—\s*/, ''))}</a>`).join('')}</div>
      <a href="#/boutique?group=enfant" class="btn btn-dark">Voir l'espace Fillettes</a></div>
    <div class="grid grid-4 kids-grid">${kids.map(card).join('')}</div></div></div></section>` : ''}

  ${rail('Meilleures ventes', best, '#/boutique?sort=populaires', 'Les favorites de nos clientes')}

  <section class="section"><div class="container"><div class="trust">
    <div>${I.truck}<b>Livraison 58 wilayas</b><span>${esc(s.deliveryDelay || '24 à 72 h')}${s.freeShippingThreshold ? ` · offerte dès ${fmt(s.freeShippingThreshold)}` : ''}</span></div>
    <div>${I.cash}<b>Paiement à la livraison</b><span>Vous payez en espèces à réception</span></div>
    <div>${I.refresh}<b>Échange sous 7 jours</b><span>Simple et rapide</span></div>
    <div>${I.whatsapp}<b>Conseil sur WhatsApp</b><span>Une question ? On vous répond</span></div>
  </div></div></section>

  ${rec.length ? rail('Vus récemment', rec) : ''}`;
}

/* =========================== BOUTIQUE =========================== */
const SORTS = [['pertinence', 'Pertinence'], ['nouveautes', 'Nouveautés'], ['populaires', 'Meilleures ventes'], ['prix-asc', 'Prix croissant'], ['prix-desc', 'Prix décroissant'], ['remises', 'Plus fortes remises'], ['az', 'Nom A → Z']];

export function shop(ctx) {
  let shown = CONFIG.pageSize;
  let io;
  view().innerHTML = `<div class="container shop">
    <div class="shop-head" id="shopHead"></div>
    <div class="shop-layout">
      <aside class="filters" id="filters" aria-label="Filtres"></aside>
      <div class="shop-main">
        <div class="toolbar">
          <button class="btn btn-ghost btn-sm only-mobile" id="openFilters">${I.filter} Filtres <span class="fcount" id="fcount"></span></button>
          <span class="muted" id="resCount"></span>
          <label class="sort">Trier par <select id="sortSel">${SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        </div>
        <div class="active-filters" id="activeF"></div>
        <div id="results"></div>
        <div id="more" class="more"></div>
      </div>
    </div></div>`;

  const params = () => ({ ...ctx.params });
  const upd = (patch) => setParams({ ...ctx.params, ...patch });
  const toggleIn = (key, val) => {
    const set = new Set((ctx.params[key] || '').split(',').filter(Boolean));
    set.has(val) ? set.delete(val) : set.add(val);
    upd({ [key]: [...set].join(',') });
  };

  function renderAll() {
    const f = params();
    const list = query(f);
    // facettes calculées sur la sélection catégorie/groupe/recherche
    const base = query({ q: f.q, cat: f.cat, group: f.group });
    const fc = facets(base);
    const allFc = facets(query({ q: f.q, group: f.group }));
    const c = f.cat && !f.cat.includes(',') ? cat.cats.get(f.cat) : null;
    const h = f.q ? `Résultats pour « ${esc(f.q)} »` : c ? esc(c.name) : f.group === 'enfant' ? 'Espace Fillettes' : f.promo ? 'Promotions' : f.new ? 'Nouveautés' : 'Toute la boutique';
    title(f.q ? `Recherche : ${f.q}` : c ? c.name : 'Boutique');
    const groupCats = [...cat.cats.values()].filter((x) => !f.group || (x.group || 'femme') === f.group);
    $('#shopHead').innerHTML = `${crumbs([['Boutique', f.cat || f.q || f.group ? '#/boutique' : null], ...(c || f.q || f.group ? [[c ? c.name : f.q ? 'Recherche' : 'Fillettes']] : [])])}
      <h1>${h}</h1>${c?.description ? `<p class="muted">${esc(c.description)}</p>` : ''}
      <div class="chips scroll">${!f.group ? `<a href="#/boutique${f.q ? '?q=' + encodeURIComponent(f.q) : ''}" class="chip ${!f.cat ? 'on' : ''}">Tout</a>` : `<a href="#/boutique?group=enfant" class="chip ${!f.cat ? 'on' : ''}">Tout Fillettes</a>`}${groupCats.map((x) => `<button class="chip ${f.cat === x.id ? 'on' : ''}" data-chipcat="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;

    const nF = ['size', 'color', 'min', 'max', 'promo', 'stock', 'new'].reduce((a, k) => a + (f[k] ? (['size', 'color'].includes(k) ? f[k].split(',').length : 1) : 0), 0) + (f.cat ? f.cat.split(',').length : 0);
    $('#fcount').textContent = nF ? nF : '';
    const sel = (k, v) => (f[k] || '').split(',').includes(v);
    $('#filters').innerHTML = `<div class="filters-head only-mobile"><h3>Filtres</h3><button class="icon-btn" data-closef aria-label="Fermer">${I.close}</button></div>
      <div class="filters-body">
      <div class="fgroup"><label class="search-inline">${I.search}<input type="search" id="shopQ" placeholder="Rechercher un article…" value="${esc(f.q || '')}"></label></div>
      <details class="fgroup" open><summary>Catégories</summary>${[...cat.cats.values()].filter((x) => !f.group || (x.group || 'femme') === f.group).map((x) => `<label class="check"><input type="checkbox" data-fcat="${x.id}" ${sel('cat', x.id) ? 'checked' : ''}><span>${esc(x.name)}</span><em>${allFc.cats.get(x.id) || 0}</em></label>`).join('')}</details>
      ${fc.sizes.length ? `<details class="fgroup" open><summary>Tailles</summary><div class="fsizes">${fc.sizes.map((s) => `<button class="sz sm ${sel('size', s) ? 'on' : ''}" data-fsize="${esc(s)}">${esc(s)}</button>`).join('')}</div></details>` : ''}
      ${fc.colors.length ? `<details class="fgroup" open><summary>Couleurs</summary><div class="fcolors">${fc.colors.map(([n, hex]) => `<button class="fcolor ${sel('color', n) ? 'on' : ''}" data-fcolor="${esc(n)}"><i style="background:${hex}"></i>${esc(n)}</button>`).join('')}</div></details>` : ''}
      <details class="fgroup" open><summary>Prix (${CONFIG.currency})</summary>
        <div class="price-range"><input type="number" inputmode="numeric" id="pmin" placeholder="${fc.min}" value="${esc(f.min || '')}" min="0"><span>—</span><input type="number" inputmode="numeric" id="pmax" placeholder="${fc.max}" value="${esc(f.max || '')}" min="0"></div>
        <div class="chips small">${[[0, 2000], [2000, 5000], [5000, 8000], [8000, 0]].map(([a, b]) => `<button class="chip ${String(f.min || '') === String(a || '') && String(f.max || '') === String(b || '') ? 'on' : ''}" data-prange="${a}-${b}">${b ? (a ? `${a / 1000}k – ${b / 1000}k` : `< ${b / 1000}k`) : `> ${a / 1000}k`}</button>`).join('')}</div></details>
      <details class="fgroup" open><summary>Affiner</summary>
        <label class="switch"><input type="checkbox" data-fbool="stock" ${f.stock ? 'checked' : ''}><span></span>En stock uniquement</label>
        <label class="switch"><input type="checkbox" data-fbool="promo" ${f.promo ? 'checked' : ''}><span></span>En promotion</label>
        <label class="switch"><input type="checkbox" data-fbool="new" ${f.new ? 'checked' : ''}><span></span>Nouveautés</label></details>
      </div>
      <div class="filters-foot only-mobile"><button class="btn btn-ghost" data-clear>Effacer</button><button class="btn btn-dark" data-closef>Voir ${list.length} article${list.length > 1 ? 's' : ''}</button></div>`;

    const pills = [];
    if (f.q) pills.push(['q', null, `« ${f.q} »`]);
    (f.cat || '').split(',').filter(Boolean).forEach((v) => pills.push(['cat', v, cat.cats.get(v)?.name || v]));
    (f.size || '').split(',').filter(Boolean).forEach((v) => pills.push(['size', v, 'Taille ' + v]));
    (f.color || '').split(',').filter(Boolean).forEach((v) => pills.push(['color', v, v]));
    if (f.min || f.max) pills.push(['price', null, `${f.min || 0} – ${f.max || '∞'} ${CONFIG.currency}`]);
    if (f.stock) pills.push(['stock', null, 'En stock']);
    if (f.promo) pills.push(['promo', null, 'Promotions']);
    if (f.new) pills.push(['new', null, 'Nouveautés']);
    if (f.group) pills.push(['group', null, 'Fillettes']);
    $('#activeF').innerHTML = pills.length ? pills.map(([k, v, l]) => `<button class="pill" data-rm="${k}" data-v="${esc(v || '')}">${esc(l)} ${I.close}</button>`).join('') + `<button class="pill-clear" data-clear>Tout effacer</button>` : '';
    $('#sortSel').value = f.sort || (f.q ? 'pertinence' : 'nouveautes');
    $('#resCount').textContent = `${list.length} article${list.length > 1 ? 's' : ''}`;
    renderResults(list);
  }

  function renderResults(list) {
    const r = $('#results');
    if (!list.length) {
      const sugg = query({ sort: 'populaires' }).slice(0, 4);
      r.innerHTML = `<div class="empty big">${I.search}<h3>Aucun article ne correspond</h3><p>Essayez d'autres mots-clés ou retirez quelques filtres.</p><button class="btn btn-dark" data-clear>Réinitialiser les filtres</button></div><h3 class="mt">Nos meilleures ventes</h3>${grid(sugg)}`;
      $('#more').innerHTML = '';
      return;
    }
    r.innerHTML = grid(list.slice(0, shown));
    const rest = list.length - shown;
    $('#more').innerHTML = rest > 0 ? `<p class="muted">${shown} sur ${list.length} articles</p><div class="bar"><i style="width:${(shown / list.length) * 100}%"></i></div><button class="btn btn-ghost" id="loadMore">Afficher plus</button>` : '';
    io?.disconnect();
    if (rest > 0 && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { shown += CONFIG.pageSize; renderResults(list); } }, { rootMargin: '600px' });
      io.observe($('#more'));
    }
    $('#loadMore')?.addEventListener('click', () => { shown += CONFIG.pageSize; renderResults(list); });
  }

  const root = view();
  root.addEventListener('click', (e) => {
    const t = e.target;
    const cc = t.closest('[data-chipcat]');
    if (cc) return upd({ cat: ctx.params.cat === cc.dataset.chipcat ? '' : cc.dataset.chipcat });
    const fs = t.closest('[data-fsize]'); if (fs) return toggleIn('size', fs.dataset.fsize);
    const fcl = t.closest('[data-fcolor]'); if (fcl) return toggleIn('color', fcl.dataset.fcolor);
    const pr = t.closest('[data-prange]');
    if (pr) { const [a, b] = pr.dataset.prange.split('-'); const same = String(ctx.params.min || '') === (a === '0' ? '' : a) && String(ctx.params.max || '') === (b === '0' ? '' : b); return upd(same ? { min: '', max: '' } : { min: a === '0' ? '' : a, max: b === '0' ? '' : b }); }
    const rm = t.closest('[data-rm]');
    if (rm) {
      const k = rm.dataset.rm, v = rm.dataset.v;
      if (k === 'price') return upd({ min: '', max: '' });
      if (v) return toggleIn(k, v);
      return upd({ [k]: '' });
    }
    if (t.closest('[data-clear]')) { shown = CONFIG.pageSize; return setParams(ctx.params.group ? { group: ctx.params.group } : {}); }
    if (t.closest('#openFilters')) { $('#filters').classList.add('open'); document.body.classList.add('lock'); }
    if (t.closest('[data-closef]')) { $('#filters').classList.remove('open'); document.body.classList.remove('lock'); }
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'sortSel') upd({ sort: t.value });
    if (t.dataset.fcat) toggleIn('cat', t.dataset.fcat);
    if (t.dataset.fbool) upd({ [t.dataset.fbool]: t.checked ? '1' : '' });
    if (t.id === 'pmin' || t.id === 'pmax') upd({ min: $('#pmin').value, max: $('#pmax').value });
  });
  const onQ = debounce((v) => { shown = CONFIG.pageSize; upd({ q: v.trim() }); if (v.trim()) searches.push(v); }, 350);
  root.addEventListener('input', (e) => { if (e.target.id === 'shopQ') onQ(e.target.value); });

  renderAll();
  return {
    update(c) {
      const hadFocus = document.activeElement?.id;
      const caret = document.activeElement?.selectionStart;
      const mobileOpen = $('#filters').classList.contains('open');
      ctx = c; shown = CONFIG.pageSize;
      renderAll();
      if (mobileOpen) $('#filters').classList.add('open');
      if (hadFocus === 'shopQ' || hadFocus === 'pmin' || hadFocus === 'pmax') { const el = $('#' + hadFocus); el?.focus(); try { el.setSelectionRange(caret, caret); } catch {} }
    },
    destroy() { io?.disconnect(); document.body.classList.remove('lock'); },
  };
}

/* =========================== PRODUIT =========================== */
export function product(ctx) {
  const p = cat.bySlug.get(decodeURIComponent(ctx.m[1])) || cat.byId.get(decodeURIComponent(ctx.m[1]));
  if (!p) return notFound();
  title(p.name);
  recent.push(p.id);
  const c = cat.cats.get(p.category);
  const imgs = productImages(p);
  const s = cat.settings;
  const rel = related(p);
  const rec = recent.ids.filter((id) => id !== p.id).map((id) => cat.byId.get(id)).filter(Boolean).slice(0, 8);
  const eta = new Date(Date.now() + 3 * 864e5).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  view().innerHTML = `<div class="container">
    ${crumbs([[c?.name || 'Boutique', `#/boutique?cat=${p.category}`], [p.name]])}
    <div class="pdp">
      <div class="gallery">
        <div class="g-thumbs">${imgs.map((src, i) => `<button class="${i === 0 ? 'on' : ''}" data-gi="${i}" aria-label="Image ${i + 1}"><img src="${src}" alt=""></button>`).join('')}</div>
        <div class="g-main">
          <div class="g-track" id="gTrack">${imgs.map((src, i) => `<img src="${src}" alt="${esc(p.name)} — vue ${i + 1}" data-zoom="${i}" ${i ? 'loading="lazy"' : ''}>`).join('')}</div>
          <div class="badges">${p._disc ? `<span class="b b-sale">-${p._disc}%</span>` : ''}${p.isNew ? '<span class="b b-new">Nouveau</span>' : ''}</div>
          <div class="g-dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        </div>
      </div>
      <div class="pdp-info">
        <a href="#/boutique?cat=${p.category}" class="card-cat">${esc(c?.name || '')}</a>
        <h1>${esc(p.name)}</h1>
        ${priceHtml(p, true)}
        ${p._disc ? `<p class="save">Vous économisez ${fmt(p.oldPrice - p.price)}</p>` : ''}
        ${buyBox(p)}
        <ul class="perks">
          <li>${I.truck}<span>Livraison estimée <b>${eta}</b> · ${s.freeShippingThreshold ? `offerte dès ${fmt(s.freeShippingThreshold)}` : '58 wilayas'}</span></li>
          <li>${I.cash}<span>Paiement <b>à la livraison</b> en espèces</span></li>
          <li>${I.refresh}<span>Échange gratuit sous <b>7 jours</b></span></li>
        </ul>
        <div class="acc">
          <details open><summary>Description</summary><div>${nl2p(p.description)}${p.sku ? `<p class="muted small">Réf. ${esc(p.sku)}</p>` : ''}</div></details>
          ${p.material || p.care ? `<details><summary>Matière & entretien</summary><div>${p.material ? `<p><b>Matière :</b> ${esc(p.material)}</p>` : ''}${p.care ? `<p><b>Entretien :</b> ${esc(p.care)}</p>` : ''}</div></details>` : ''}
          <details><summary>Livraison & retours</summary><div>${nl2p(s.pages?.livraison?.split('\n\n').slice(0, 2).join('\n\n'))}<p><a href="#/page/retours">Politique d'échange →</a></p></div></details>
          <details><summary>Guide des tailles</summary><div>${nl2p(s.pages?.['guide-tailles'])}</div></details>
        </div>
        <div class="share"><span>Partager :</span>
          <a class="icon-btn round" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(p.name + ' — ' + location.href)}" aria-label="WhatsApp">${I.whatsapp}</a>
          <a class="icon-btn round" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}" aria-label="Facebook">${I.fb}</a>
          <button class="icon-btn round" id="copyLink" aria-label="Copier le lien">${I.share}</button>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(`Bonjour, je suis intéressée par « ${p.name} » (${fmt(p.price)}). ${location.href}`)}">${I.whatsapp} Une question ?</a>
        </div>
      </div>
    </div></div>
    ${rail('Vous aimerez aussi', rel)}
    ${rec.length ? rail('Vus récemment', rec) : ''}
    <div class="sticky-buy" id="stickyBuy"><div><b>${esc(p.name)}</b>${priceHtml(p)}</div><button class="btn btn-dark" id="stickyBtn" ${p._stock ? '' : 'disabled'}>${p._stock ? 'Ajouter' : 'Épuisé'}</button></div>`;

  const track = $('#gTrack');
  const setActive = (i) => {
    $$('.g-thumbs button').forEach((b, j) => b.classList.toggle('on', i === j));
    $$('.g-dots i').forEach((b, j) => b.classList.toggle('on', i === j));
  };
  const goImg = (i) => { track.scrollTo({ left: track.clientWidth * i, behavior: 'smooth' }); setActive(i); };
  track.addEventListener('scroll', debounce(() => setActive(Math.round(track.scrollLeft / track.clientWidth)), 60));
  $$('.g-thumbs button').forEach((b) => b.addEventListener('click', () => goImg(Number(b.dataset.gi))));
  track.addEventListener('click', (e) => {
    const im = e.target.closest('[data-zoom]');
    if (im) openModal(`<div class="lightbox"><img src="${im.src}" alt=""></div>`, null, 'modal-full');
  });
  bindBuyBox(view(), p, { onColor: (i) => { if (!p.images?.length && i < imgs.length) goImg(i); } });
  $('#copyLink').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('Lien copié'); } catch { toast('Copie impossible', { type: 'err' }); } });
  const sb = $('#stickyBuy');
  const addBtn = $('.buybox [data-add]');
  const io = new IntersectionObserver(([e]) => sb.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0));
  io.observe(addBtn);
  $('#stickyBtn').addEventListener('click', () => { addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => addBtn.click(), 400); });
  return { destroy: () => io.disconnect() };
}

export function quickView(p) {
  const imgs = productImages(p);
  openModal(`<div class="qv"><div class="qv-img"><img src="${imgs[0]}" alt="" id="qvImg"></div><div class="qv-info"><span class="card-cat">${esc(cat.cats.get(p.category)?.name || '')}</span><h3>${esc(p.name)}</h3>${priceHtml(p, true)}${buyBox(p)}<a href="${href(p)}" class="link-more" data-close>Voir la fiche complète ${I.chevron}</a></div></div>`, (box) => {
    bindBuyBox(box, p, { onColor: (i) => { if (!p.images?.length) $('#qvImg').src = imgs[i] || imgs[0]; }, onAdded: () => setTimeout(() => document.querySelector('[data-close]')?.click(), 300) });
  });
}

/* =========================== PANIER =========================== */
export function cartPage() {
  title('Panier');
  const draw = () => {
    const lines = cartLines();
    const t = totals({ lines });
    const ids = new Set(lines.map((l) => l.productId));
    const upsell = query({ sort: 'populaires', stock: 1 }).filter((p) => !ids.has(p.id) && p.price < 3000).slice(0, 4);
    const promo = getPromo();
    view().innerHTML = `<div class="container narrow-top">${crumbs([['Panier']])}<h1>Mon panier</h1>
    ${lines.length ? `<div class="cart-layout"><div><div class="lines big" id="lines">${lines.map((l) => lineHtml(l)).join('')}</div><a href="#/boutique" class="link-more">${I.chevronL} Continuer mes achats</a></div>
      <aside class="summary card-box"><h3>Récapitulatif</h3>${freeBar(t)}
        ${promoBox(promo, t)}
        <div class="row"><span>Sous-total (${t.count})</span><b>${fmt(t.subtotal)}</b></div>
        ${t.discount ? `<div class="row accent"><span>Code ${esc(promo.code)}</span><b>-${fmt(t.discount)}</b></div>` : ''}
        <div class="row"><span>Livraison</span><span class="muted">${t.free ? 'Offerte' : "Selon la wilaya"}</span></div>
        <div class="row total"><span>Total</span><b>${fmt(t.subtotal - t.discount)}</b></div>
        <a href="#/commande" class="btn btn-dark btn-block btn-lg">Passer la commande</a>
        <p class="muted small center">${I.shield} Paiement à la livraison · aucune carte requise</p>
      </aside></div>
      ${upsell.length ? `<section class="section"><h3>Complétez votre look</h3>${grid(upsell, 'grid-4')}</section>` : ''}`
      : `<div class="empty big">${I.bag}<h3>Votre panier est vide</h3><p>Il n'attend que vous ! Découvrez nos nouveautés.</p><a href="#/boutique" class="btn btn-dark">Découvrir la boutique</a></div>${rail('Meilleures ventes', query({ sort: 'populaires', stock: 1 }).slice(0, 10))}`}</div>`;
    if (lines.length) { bindLines($('#lines')); bindPromo(view(), draw); }
  };
  draw();
  const off = () => draw();
  window.addEventListener('bv-cart', off);
  return { destroy: () => window.removeEventListener('bv-cart', off) };
}

function promoBox(promo, t) {
  return `<div class="promo-box">${promo
    ? `<div class="promo-on ${t.promoOk ? '' : 'invalid'}">${I.tag}<div><b>${esc(promo.code)}</b><small>${t.promoOk ? esc(promo.label || 'Code appliqué') : `Minimum d'achat : ${fmt(promo.minTotal)}`}</small></div><button class="link" data-promo-rm>Retirer</button></div>`
    : `<form class="promo-form" data-promo><input name="code" placeholder="Code promo" autocomplete="off" aria-label="Code promo"><button class="btn btn-ghost btn-sm">Appliquer</button></form>`}</div>`;
}
function bindPromo(root, redraw) {
  root.querySelector('[data-promo]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    if (!code) return;
    const h = await promoHash(code);
    const pr = (cat.data.promos || []).find((x) => x.hash === h);
    if (!pr || (pr.expiresAt && pr.expiresAt < Date.now())) return toast('Code promo invalide ou expiré', { type: 'err' });
    writeLS('bv_promo', { ...pr, code });
    toast('Code promo appliqué');
    redraw();
  });
  root.querySelector('[data-promo-rm]')?.addEventListener('click', () => { localStorage.removeItem('bv_promo'); redraw(); });
}

/* =========================== COMMANDE =========================== */
export function checkout() {
  title('Commande');
  if (!cartLines().filter((l) => !l.out).length) {
    view().innerHTML = `<div class="container"><div class="empty big">${I.bag}<h3>Votre panier est vide</h3><a href="#/boutique" class="btn btn-dark">Découvrir la boutique</a></div></div>`;
    return;
  }
  const saved = { type: 'home', ...customer.get() };
  view().innerHTML = `<div class="container narrow-top">${crumbs([['Panier', '#/panier'], ['Commande']])}
  <div class="steps"><span class="done">1. Panier</span><span class="on">2. Livraison</span><span>3. Confirmation</span></div>
  <div class="checkout">
    <form id="coForm" novalidate class="card-box">
      <h2>Vos coordonnées</h2>
      <div class="frow">
        <label class="field"><span>Prénom *</span><input name="firstName" required autocomplete="given-name" value="${esc(saved.firstName || '')}"></label>
        <label class="field"><span>Nom *</span><input name="lastName" required autocomplete="family-name" value="${esc(saved.lastName || '')}"></label>
      </div>
      <label class="field"><span>Téléphone *</span><input name="phone" type="tel" inputmode="tel" required placeholder="05 / 06 / 07 XX XX XX XX" autocomplete="tel" value="${esc(saved.phone || '')}"><small>Nous vous appellerons pour confirmer la commande</small></label>
      <label class="field"><span>Téléphone 2 <em>(facultatif)</em></span><input name="phone2" type="tel" inputmode="tel" value="${esc(saved.phone2 || '')}"></label>
      <h2>Livraison</h2>
      <div class="frow">
        <label class="field"><span>Wilaya *</span><select name="wilaya" required><option value="">Choisir…</option>${WILAYAS.filter((w) => feesFor(cat.settings, w.code).active !== false).map((w) => `<option value="${w.code}" ${Number(saved.wilaya) === w.code ? 'selected' : ''}>${String(w.code).padStart(2, '0')} - ${esc(w.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Commune *</span><input name="commune" required value="${esc(saved.commune || '')}"></label>
      </div>
      <div class="dtypes" id="dtypes"></div>
      <label class="field" id="addrField"><span>Adresse complète *</span><input name="address" autocomplete="street-address" placeholder="Rue, quartier, n° de bâtiment…" value="${esc(saved.address || '')}"></label>
      <label class="field"><span>Note pour la livraison <em>(facultatif)</em></span><textarea name="notes" rows="2" placeholder="Ex : appeler avant de passer, disponible l'après-midi…"></textarea></label>
      <label class="check"><input type="checkbox" name="remember" ${saved.firstName ? 'checked' : ''}><span>Mémoriser mes informations sur cet appareil</span></label>
      <div class="pay-box">${I.cash}<div><b>Paiement à la livraison</b><small>Vous payez en espèces au livreur à la réception de votre colis.</small></div></div>
    </form>
    <aside class="summary card-box" id="coSum"></aside>
  </div></div>`;

  const form = $('#coForm');
  const state = { type: saved.type || 'home' };
  const drawTypes = () => {
    const w = Number(form.wilaya.value);
    const f = w ? feesFor(cat.settings, w) : null;
    const t = totals({ lines: cartLines(), wilaya: w, type: 'home' });
    if (f && !(f.desk > 0) && state.type === 'desk') state.type = 'home';
    $('#dtypes').innerHTML = [['home', 'À domicile', 'Livré à votre adresse', f?.home], ['desk', 'Au bureau (Stop desk)', "Retrait à l'agence de livraison", f?.desk]]
      .map(([v, l, d, price]) => `<label class="dtype ${state.type === v ? 'on' : ''} ${f && v === 'desk' && !(price > 0) ? 'disabled' : ''}"><input type="radio" name="dtype" value="${v}" ${state.type === v ? 'checked' : ''} ${f && v === 'desk' && !(price > 0) ? 'disabled' : ''}><span class="radio"></span><span><b>${l}</b><small>${d}</small></span><em>${!f ? '—' : v === 'desk' && !(price > 0) ? 'Indisponible' : t.free ? '<s>' + fmt(price) + '</s> Offerte' : fmt(price)}</em></label>`).join('');
    $('#addrField').style.display = state.type === 'home' ? '' : 'none';
  };
  const drawSum = () => {
    const lines = cartLines();
    const promo = getPromo();
    const t = totals({ lines, wilaya: Number(form.wilaya.value), type: state.type });
    $('#coSum').innerHTML = `<h3>Votre commande <small>(${t.count})</small></h3>
      <div class="mini-lines">${lines.map((l) => `<div class="mini ${l.out ? 'is-out' : ''}"><span class="mini-img"><img src="${l.img}" alt=""><b>${l.qty}</b></span><span><b>${esc(l.p.name)}</b><small>${[l.color, l.size].filter(Boolean).map(esc).join(' · ')}${l.out ? ' — épuisé' : ''}</small></span><em>${fmt(l.price * l.qty)}</em></div>`).join('')}</div>
      ${promoBox(promo, t)}
      <div class="row"><span>Sous-total</span><b>${fmt(t.subtotal)}</b></div>
      ${t.discount ? `<div class="row accent"><span>Réduction (${esc(promo.code)})</span><b>-${fmt(t.discount)}</b></div>` : ''}
      <div class="row"><span>Livraison ${state.type === 'desk' ? '(bureau)' : '(domicile)'}</span><b>${t.shipping == null ? '<span class="muted">Choisir la wilaya</span>' : t.shipping === 0 ? 'Offerte' : fmt(t.shipping)}</b></div>
      <div class="row total"><span>Total à payer</span><b>${fmt(t.total)}</b></div>
      <button class="btn btn-dark btn-block btn-lg" id="placeBtn" form="coForm">Confirmer la commande</button>
      <p class="muted small center">${I.shield} En confirmant, vous acceptez d'être contactée pour la validation de votre commande.</p>`;
    bindPromo($('#coSum'), drawSum);
    $('#placeBtn').addEventListener('click', (e) => { e.preventDefault(); submit(); });
  };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'dtype') state.type = e.target.value;
    if (e.target.name === 'wilaya' || e.target.name === 'dtype') { drawTypes(); drawSum(); }
  });
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('err'));
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  drawTypes(); drawSum();

  let busy = false;
  async function submit() {
    if (busy) return;
    const d = Object.fromEntries(new FormData(form));
    const errs = [];
    const need = ['firstName', 'lastName', 'phone', 'wilaya', 'commune', ...(state.type === 'home' ? ['address'] : [])];
    $$('.field', form).forEach((f) => f.classList.remove('err'));
    for (const k of need) if (!String(d[k] || '').trim()) errs.push(k);
    if (d.phone && !phoneOk(d.phone)) errs.push('phone');
    if (d.phone2 && !phoneOk(d.phone2)) errs.push('phone2');
    if (errs.length) {
      errs.forEach((k) => form[k]?.closest('.field')?.classList.add('err'));
      form[errs[0]]?.focus();
      return toast(errs.includes('phone') && d.phone ? 'Numéro de téléphone invalide (ex : 0550 12 34 56)' : 'Veuillez compléter les champs obligatoires', { type: 'err' });
    }
    const lines = cartLines().filter((l) => !l.out);
    const promo = getPromo();
    const t = totals({ lines, wilaya: Number(d.wilaya), type: state.type, promo });
    const order = {
      id: genOrderCode(),
      status: 'nouvelle',
      source: 'site',
      customer: {
        firstName: d.firstName.trim(), lastName: d.lastName.trim(), phone: cleanPhone(d.phone), phone2: d.phone2 ? cleanPhone(d.phone2) : '',
        wilaya: Number(d.wilaya), wilayaName: wilayaName(d.wilaya), commune: d.commune.trim(), address: state.type === 'home' ? d.address.trim() : '', notes: (d.notes || '').trim().slice(0, 500),
      },
      delivery: { type: state.type, price: t.shipping || 0 },
      items: lines.map((l) => ({ productId: l.p.id, name: l.p.name, sku: l.p.sku || '', price: l.price, qty: Math.min(l.qty, l.max), size: l.size || '', color: l.color || '', image: l.p.images?.[0] || '' })),
      subtotal: t.subtotal, discount: t.discount, promoCode: t.promoOk ? promo.code : '', total: t.total,
    };
    busy = true;
    const btn = $('#placeBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Envoi en cours…';
    try {
      await placeOrder(order);
      if (d.remember) customer.set({ firstName: d.firstName, lastName: d.lastName, phone: d.phone, phone2: d.phone2, wilaya: d.wilaya, commune: d.commune, address: d.address, type: state.type });
      else customer.set({});
      customer.addOrder({ id: order.id, total: order.total, at: Date.now(), phone: order.customer.phone });
      sessionStorage.setItem('bv_last_order', JSON.stringify(order));
      cart.clear();
      localStorage.removeItem('bv_promo');
      go('/merci/' + order.id);
    } catch (err) {
      console.error(err);
      toast("La commande n'a pas pu être envoyée. Vérifiez votre connexion ou commandez sur WhatsApp.", { type: 'err', ms: 6000 });
      btn.disabled = false; btn.textContent = 'Réessayer';
      busy = false;
    }
  }
}

/* =========================== MERCI =========================== */
export function thanks(ctx) {
  title('Merci !');
  const code = decodeURIComponent(ctx.m[1]);
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('bv_last_order')); } catch {}
  if (o && o.id !== code) o = null;
  const msg = o ? `Bonjour BelleaV, je viens de passer la commande ${o.id} (${fmt(o.total)}) au nom de ${o.customer.firstName} ${o.customer.lastName}.` : `Bonjour, ma commande ${code}`;
  view().innerHTML = `<div class="container narrow"><div class="thanks card-box">
    <div class="thanks-ic">${I.check}</div>
    <h1>Merci${o ? ' ' + esc(o.customer.firstName) : ''} !</h1>
    <p>Votre commande <b class="code">${esc(code)}</b> a bien été enregistrée.</p>
    <p class="muted">Notre équipe vous appellera${o ? ` au <b>${esc(o.customer.phone)}</b>` : ''} très prochainement pour la confirmer. Gardez votre téléphone à portée de main 📞</p>
    ${o ? `<div class="mini-lines">${o.items.map((i) => { const p = cat.byId.get(i.productId); return `<div class="mini"><span class="mini-img"><img src="${p ? productImages(p)[0] : ''}" alt=""><b>${i.qty}</b></span><span><b>${esc(i.name)}</b><small>${[i.color, i.size].filter(Boolean).map(esc).join(' · ')}</small></span><em>${fmt(i.price * i.qty)}</em></div>`; }).join('')}</div>
      <div class="row"><span>Livraison (${o.delivery.type === 'desk' ? 'bureau' : 'domicile'} — ${esc(o.customer.wilayaName)})</span><b>${o.delivery.price ? fmt(o.delivery.price) : 'Offerte'}</b></div>
      ${o.discount ? `<div class="row accent"><span>Réduction</span><b>-${fmt(o.discount)}</b></div>` : ''}
      <div class="row total"><span>Total à payer à la livraison</span><b>${fmt(o.total)}</b></div>` : ''}
    <div class="thanks-cta">
      <a href="${waLink(msg)}" target="_blank" rel="noopener" class="btn btn-accent">${I.whatsapp} Confirmer sur WhatsApp</a>
      <a href="#/suivi/${encodeURIComponent(code)}" class="btn btn-ghost">Suivre ma commande</a>
      <a href="#/boutique" class="btn btn-ghost">Continuer mes achats</a>
    </div></div></div>`;
}

/* =========================== FAVORIS =========================== */
export function wishlistPage() {
  title('Mes favoris');
  const draw = () => {
    const list = wishlist.ids.map((id) => cat.byId.get(id)).filter(Boolean);
    view().innerHTML = `<div class="container narrow-top">${crumbs([['Favoris']])}<h1>Mes favoris <small class="muted">(${list.length})</small></h1>
    ${list.length ? grid(list) : `<div class="empty big">${I.heart}<h3>Aucun favori pour l'instant</h3><p>Touchez le cœur sur un article pour le retrouver ici.</p><a href="#/boutique" class="btn btn-dark">Explorer la boutique</a></div>`}</div>`;
  };
  draw();
  const h = () => draw();
  window.addEventListener('bv-wish', h);
  return { destroy: () => window.removeEventListener('bv-wish', h) };
}

/* =========================== SUIVI =========================== */
export function track(ctx) {
  title('Suivi de commande');
  const code = ctx.m[1] ? decodeURIComponent(ctx.m[1]) : '';
  const mine = customer.orders();
  view().innerHTML = `<div class="container narrow">${crumbs([['Suivi de commande']])}<h1>Suivre ma commande</h1>
    <form class="card-box track-form" id="trackForm">
      <label class="field"><span>Numéro de commande</span><input name="code" placeholder="BV-XXXXXXXX" value="${esc(code)}" required autocapitalize="characters"></label>
      <label class="field"><span>Téléphone utilisé</span><input name="phone" type="tel" inputmode="tel" placeholder="05XX XX XX XX" value="${esc(mine.find((o) => o.id === code)?.phone || '')}" required></label>
      <button class="btn btn-dark">${I.search} Rechercher</button>
    </form>
    <div id="trackRes"></div>
    ${mine.length ? `<h3 class="mt">Mes commandes sur cet appareil</h3><div class="my-orders">${mine.map((o) => `<a href="#/suivi/${o.id}" class="my-order"><b>${o.id}</b><span>${fmtDate(o.at, false)}</span><em>${fmt(o.total)}</em>${I.chevron}</a>`).join('')}</div>` : ''}
  </div>`;
  const f = $('#trackForm');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = $('#trackRes');
    res.innerHTML = '<div class="loading"><span class="spinner"></span> Recherche…</div>';
    const o = await getOrder(f.code.value);
    if (!o || cleanPhone(o.customer?.phone) !== cleanPhone(f.phone.value)) {
      res.innerHTML = `<div class="card-box empty">${I.box}<h4>Commande introuvable</h4><p>Vérifiez le numéro et le téléphone, ou contactez-nous.</p><a class="btn btn-ghost" target="_blank" rel="noopener" href="${waLink('Bonjour, je souhaite suivre ma commande ' + f.code.value)}">${I.whatsapp} Nous contacter</a></div>`;
      return;
    }
    const flow = ['nouvelle', 'confirmee', 'preparation', 'expediee', 'livree'];
    const idx = flow.indexOf(o.status);
    const bad = ['annulee', 'retournee'].includes(o.status);
    const hist = Object.fromEntries((o.history || []).map((h) => [h.status, h.at]));
    res.innerHTML = `<div class="card-box track-res">
      <div class="track-top"><div><small class="muted">Commande</small><h3>${esc(o.id)}</h3><small class="muted">${fmtDate(o.createdAt)}</small></div><span class="status st-${o.status}">${STATUS[o.status]?.label || o.status}</span></div>
      ${bad ? `<p class="warn">${STATUS[o.status].desc}</p>` : `<ol class="timeline">${flow.map((s, i) => `<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'cur' : ''}"><i>${i <= idx ? I.check : ''}</i><div><b>${STATUS[s].label}</b><small>${i === idx ? STATUS[s].desc : hist[s] ? fmtDate(hist[s]) : ''}</small></div></li>`).join('')}</ol>`}
      ${o.trackingNumber ? `<p>N° de suivi transporteur : <b>${esc(o.trackingNumber)}</b>${o.carrier ? ' (' + esc(o.carrier) + ')' : ''}</p>` : ''}
      <div class="mini-lines">${o.items.map((i) => `<div class="mini"><span><b>${i.qty} × ${esc(i.name)}</b><small>${[i.color, i.size].filter(Boolean).map(esc).join(' · ')}</small></span><em>${fmt(i.price * i.qty)}</em></div>`).join('')}</div>
      <div class="row total"><span>Total</span><b>${fmt(o.total)}</b></div></div>`;
  });
  if (code && f.phone.value) f.requestSubmit();
}

/* =========================== CONTACT & PAGES =========================== */
export function contact() {
  title('Contact');
  const s = cat.settings;
  view().innerHTML = `<div class="container narrow-top">${crumbs([['Contact']])}<h1>Contactez-nous</h1>
  <div class="contact">
    <div class="contact-info card-box">
      <p>Une question sur une taille, une commande ou un échange ? Notre équipe vous répond avec plaisir.</p>
      ${s.whatsapp ? `<a class="c-item" target="_blank" rel="noopener" href="${waLink('Bonjour BelleaV !')}">${I.whatsapp}<span><b>WhatsApp</b>${esc(s.whatsapp)}</span></a>` : ''}
      ${s.phone ? `<a class="c-item" href="tel:${esc(s.phone.replace(/\s/g, ''))}">${I.phone}<span><b>Téléphone</b>${esc(s.phone)}</span></a>` : ''}
      ${s.email ? `<a class="c-item" href="mailto:${esc(s.email)}">${I.mail}<span><b>E-mail</b>${esc(s.email)}</span></a>` : ''}
      ${s.address ? `<div class="c-item">${I.pin}<span><b>Adresse</b>${esc(s.address)}</span></div>` : ''}
      <div class="socials">${s.instagram ? `<a class="icon-btn round" href="${esc(s.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${I.insta}</a>` : ''}${s.facebook ? `<a class="icon-btn round" href="${esc(s.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${I.fb}</a>` : ''}${s.tiktok ? `<a class="icon-btn round" href="${esc(s.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${I.tiktok}</a>` : ''}</div>
    </div>
    <form class="card-box" id="contactForm" novalidate>
      <div class="frow"><label class="field"><span>Nom *</span><input name="name" required></label><label class="field"><span>Téléphone *</span><input name="phone" type="tel" required></label></div>
      <label class="field"><span>Sujet</span><select name="subject"><option>Question sur un produit</option><option>Ma commande</option><option>Échange / retour</option><option>Autre</option></select></label>
      <label class="field"><span>Message *</span><textarea name="message" rows="5" required maxlength="2000"></textarea></label>
      <button class="btn btn-dark">Envoyer le message</button>
    </form>
  </div></div>`;
  const f = $('#contactForm');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (!d.name.trim() || !phoneOk(d.phone) || d.message.trim().length < 5) return toast('Merci de remplir correctement tous les champs', { type: 'err' });
    const b = f.querySelector('button'); b.disabled = true;
    try {
      await sendMessage({ name: d.name.trim().slice(0, 100), phone: cleanPhone(d.phone), subject: d.subject, message: d.message.trim().slice(0, 2000) });
      f.reset(); toast('Message envoyé, nous vous répondrons rapidement !');
    } catch { toast("Envoi impossible pour le moment. Contactez-nous sur WhatsApp.", { type: 'err' }); }
    b.disabled = false;
  });
}

export const PAGES = { livraison: 'Livraison', retours: 'Retours & échanges', 'guide-tailles': 'Guide des tailles', 'a-propos': 'À propos', faq: 'Questions fréquentes' };
export function page(ctx) {
  const id = ctx.m[1];
  if (!PAGES[id]) return notFound();
  title(PAGES[id]);
  const txt = cat.settings.pages?.[id] || '';
  const body = id === 'faq'
    ? txt.split(/\n{2,}/).map((b) => { const [q, ...a] = b.split('\n'); return `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a.join(' '))}</p></details>`; }).join('')
    : nl2p(txt);
  view().innerHTML = `<div class="container narrow">${crumbs([[PAGES[id]]])}<h1>${PAGES[id]}</h1><div class="prose card-box">${body || '<p class="muted">Contenu bientôt disponible.</p>'}</div>
  <div class="page-links">${Object.entries(PAGES).filter(([k]) => k !== id).map(([k, l]) => `<a href="#/page/${k}" class="chip">${l}</a>`).join('')}<a href="#/contact" class="chip">Contact</a></div></div>`;
}

export function notFound() {
  title('Page introuvable');
  view().innerHTML = `<div class="container"><div class="empty big"><h1 class="big404">404</h1><h3>Cette page n'existe pas (ou plus)</h3><p>L'article a peut-être été retiré du catalogue.</p><a href="#/boutique" class="btn btn-dark">Retour à la boutique</a></div>${rail('Nos nouveautés', query({ sort: 'nouveautes', stock: 1 }).slice(0, 10))}</div>`;
}
