// Catalogue : chargé depuis le fichier publié par l'admin (Firebase Storage / Hosting).
// Le client ne fait AUCUNE lecture Firestore pour afficher les produits.
import { firebaseConfig, CONFIG } from './config.js';
import { norm, readLS, writeLS, totalStock, discountPct } from './utils.js';

const CACHE = 'bv_catalog_cache';
export const cat = { data: null, products: [], byId: new Map(), bySlug: new Map(), cats: new Map(), settings: {} };

export function setCatalog(data) {
  cat.data = data;
  cat.settings = data.settings || {};
  cat.cats = new Map((data.categories || []).map((c) => [c.id, c]));
  cat.products = (data.products || []).filter((p) => cat.cats.has(p.category)).map((p) => ({
    ...p,
    _stock: totalStock(p),
    _disc: discountPct(p),
    _text: norm([p.name, cat.cats.get(p.category)?.name, p.sku, (p.tags || []).join(' '), (p.colors || []).map((c) => c.name).join(' '), p.material, p.description].join(' ')),
    _name: norm(p.name),
  }));
  cat.byId = new Map(cat.products.map((p) => [p.id, p]));
  cat.bySlug = new Map(cat.products.map((p) => [p.slug || p.id, p]));
}

function storageUrl(file) {
  const b = firebaseConfig.storageBucket;
  return `https://firebasestorage.googleapis.com/v0/b/${b}/o/${encodeURIComponent('catalog/' + file)}?alt=media`;
}

// Chargement via <script> : aucune configuration CORS nécessaire sur le bucket
function loadScript(url) {
  return new Promise((res, rej) => {
    delete window.__BELLEAV_CATALOG__;
    const s = document.createElement('script');
    s.src = url + (url.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000);
    s.onload = () => (window.__BELLEAV_CATALOG__ ? res(window.__BELLEAV_CATALOG__) : rej(new Error('catalogue vide')));
    s.onerror = () => rej(new Error('catalogue introuvable'));
    document.head.appendChild(s);
    setTimeout(() => s.remove(), 5000);
  });
}

async function fetchFresh() {
  if (CONFIG.catalogUrl) {
    if (CONFIG.catalogUrl.endsWith('.js')) return loadScript(CONFIG.catalogUrl);
    return (await fetch(CONFIG.catalogUrl, { cache: 'no-cache' })).json();
  }
  if (!firebaseConfig) {
    const demo = readLS('bv_demo_catalog', null); // publié depuis l'admin en mode démo (même navigateur)
    if (demo) return demo;
    return (await fetch('data/catalog.json', { cache: 'no-cache' })).json();
  }
  try {
    return await loadScript(storageUrl('catalog.js'));
  } catch (e) {
    console.warn('[BelleaV] catalogue Storage indisponible, repli sur data/catalog.json', e);
    return (await fetch('data/catalog.json', { cache: 'no-cache' })).json();
  }
}

/** Affiche immédiatement le cache, puis rafraîchit en arrière-plan. */
export async function loadCatalog(onFresh) {
  const cached = readLS(CACHE, null);
  if (cached) setCatalog(cached);
  const p = fetchFresh().then((d) => {
    if (!d || !d.products) return;
    if (!cached || d.version !== cached.version) {
      setCatalog(d);
      writeLS(CACHE, d);
      if (cached) onFresh?.();
    }
  });
  if (cached) p.catch((e) => console.warn(e));
  else await p;
}

/* ---------------- Recherche ---------------- */
function lev1(a, b) { // distance d'édition ≤ 1 ?
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
const SYN = { voile: 'hijab', foulard: 'hijab', echarpe: 'hijab', jupe: 'jilbab', fille: 'fillette', enfant: 'fillette', enfants: 'fillette', bebe: 'fillette', priere: 'priere isdal', robe: 'robe', abaya: 'abaya', abayat: 'abaya' };

export function score(p, q) {
  if (!q) return 1;
  const toks = q.split(' ').filter(Boolean);
  let sc = 0;
  for (let t of toks) {
    const alt = SYN[t];
    const words = p._text.split(' ');
    if (p._name.includes(t)) sc += p._name.startsWith(t) ? 6 : 4;
    else if (p._text.includes(t)) sc += 2;
    else if (alt && alt.split(' ').some((a) => p._text.includes(a))) sc += 2;
    else if (t.length > 3 && words.some((w) => lev1(w, t) || (w.length > 4 && lev1(w.slice(0, t.length), t)))) sc += 1;
    else return 0;
  }
  return sc;
}

export function query(f = {}) {
  const q = norm(f.q || '');
  let list = cat.products.map((p) => ({ p, s: score(p, q) })).filter((x) => x.s > 0);
  if (f.cat) {
    const cs = f.cat.split(',');
    list = list.filter((x) => cs.includes(x.p.category));
  }
  if (f.group) list = list.filter((x) => (cat.cats.get(x.p.category)?.group || 'femme') === f.group);
  if (f.size) {
    const ss = f.size.split(',');
    list = list.filter((x) => (x.p.sizes || []).some((s) => ss.includes(s.label) && s.stock > 0));
  }
  if (f.color) {
    const cs = f.color.split(',');
    list = list.filter((x) => (x.p.colors || []).some((c) => cs.includes(c.name)));
  }
  if (f.min) list = list.filter((x) => x.p.price >= Number(f.min));
  if (f.max) list = list.filter((x) => x.p.price <= Number(f.max));
  if (f.promo) list = list.filter((x) => x.p._disc > 0);
  if (f.stock) list = list.filter((x) => x.p._stock > 0);
  if (f.new) list = list.filter((x) => x.p.isNew || Date.now() - x.p.createdAt < 21 * 864e5);
  const sorts = {
    pertinence: (a, b) => b.s - a.s || (b.p._stock > 0) - (a.p._stock > 0) || b.p.sold - a.p.sold,
    nouveautes: (a, b) => b.p.createdAt - a.p.createdAt,
    'prix-asc': (a, b) => a.p.price - b.p.price,
    'prix-desc': (a, b) => b.p.price - a.p.price,
    populaires: (a, b) => (b.p.sold || 0) - (a.p.sold || 0),
    remises: (a, b) => b.p._disc - a.p._disc,
    az: (a, b) => a.p.name.localeCompare(b.p.name, 'fr'),
  };
  const sort = f.sort || (q ? 'pertinence' : 'nouveautes');
  list.sort(sorts[sort] || sorts.pertinence);
  // les ruptures en dernier (sauf tri explicite par prix/nom)
  if (!['prix-asc', 'prix-desc', 'az'].includes(sort)) list.sort((a, b) => (b.p._stock > 0) - (a.p._stock > 0));
  return list.map((x) => x.p);
}

export function facets(products) {
  const sizes = new Map(), colors = new Map(), cats = new Map();
  let min = Infinity, max = 0;
  for (const p of products) {
    cats.set(p.category, (cats.get(p.category) || 0) + 1);
    for (const s of p.sizes || []) sizes.set(s.label, (sizes.get(s.label) || 0) + 1);
    for (const c of p.colors || []) if (!colors.has(c.name)) colors.set(c.name, c.hex);
    min = Math.min(min, p.price); max = Math.max(max, p.price);
  }
  const order = ['XS', 'S', 'S/M', 'M', 'L', 'L/XL', 'XL', 'XXL', '3XL', 'Taille unique'];
  const sizeList = [...sizes.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    return (parseInt(a) || 999) - (parseInt(b) || 999) || a.localeCompare(b);
  });
  return { sizes: sizeList, colors: [...colors.entries()], cats, min: min === Infinity ? 0 : min, max };
}

export function related(p, n = 8) {
  return cat.products
    .filter((x) => x.id !== p.id && x._stock > 0)
    .map((x) => ({ x, s: (x.category === p.category ? 10 : 0) + (cat.cats.get(x.category)?.group === cat.cats.get(p.category)?.group ? 2 : 0) - Math.abs(x.price - p.price) / 2000 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((o) => o.x);
}
