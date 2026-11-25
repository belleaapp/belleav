// État central de l'admin + publication du catalogue
import * as db from './db.js';
import { buildCatalog } from './catalog-builder.js';
import { readLS, writeLS, toMs } from './shared/utils.js';
import { toast } from './ui.js';

export const S = {
  user: null, products: [], categories: [], promos: [], settings: {}, orders: [], messages: [], meta: {},
  prefs: { autoPublish: true, sound: true, ...readLS('bv_admin_prefs', {}) },
};
const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const notify = (what) => subs.forEach((fn) => fn(what));
export const savePrefs = () => writeLS('bv_admin_prefs', S.prefs);

export async function loadAll() {
  const [products, categories, promos, settings, meta] = await Promise.all([
    db.list('products'), db.list('categories'), db.list('promos'), db.get('settings', 'main'), db.get('meta', 'catalog'),
  ]);
  S.products = products;
  S.categories = categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  S.promos = promos;
  S.settings = settings || {};
  S.meta = meta || {};
}

export const catName = (id) => S.categories.find((c) => c.id === id)?.name || '—';

/* ---------- Publication ---------- */
export const isDirty = () => !S.meta.publishedAt || toMs(S.meta.dirtyAt) > toMs(S.meta.publishedAt);

let timer = null;
export async function markDirty() {
  S.meta = { ...S.meta, dirtyAt: Date.now() };
  notify('meta');
  db.patch('meta', 'catalog', { dirtyAt: S.meta.dirtyAt }).catch(() => db.save('meta', 'catalog', S.meta));
  if (S.prefs.autoPublish) {
    clearTimeout(timer);
    timer = setTimeout(() => publish(true).catch((e) => toast('Publication automatique échouée : ' + e.message, 'err', 6000)), 2500);
  }
}

let publishing = null;
export async function publish(silent = false) {
  if (publishing) return publishing;
  publishing = (async () => {
    notify('publishing');
    const catalog = await buildCatalog({ products: S.products, categories: S.categories, settings: S.settings, promos: S.promos });
    await db.publishCatalog(catalog);
    S.meta = { ...S.meta, publishedAt: catalog.publishedAt, version: catalog.version, productCount: catalog.products.length, by: S.user?.email || '' };
    await db.save('meta', 'catalog', S.meta);
    if (!silent) toast(`Catalogue publié · ${catalog.products.length} produits en ligne`);
    return catalog;
  })();
  try { return await publishing; } finally { publishing = null; notify('meta'); }
}
export const isPublishing = () => !!publishing;

/* ---------- Stock lié aux commandes ---------- */
const CONSUMES = ['confirmee', 'preparation', 'expediee', 'livree'];
/** Décrémente le stock à la confirmation, le restitue en cas d'annulation/retour. */
export async function syncStock(order, newStatus) {
  const want = CONSUMES.includes(newStatus);
  if (want === !!order.stockApplied) return order.stockApplied;
  const sign = want ? -1 : 1;
  for (const it of order.items || []) {
    const updated = await db.updateProduct(it.productId, (p) => {
      const s = (p.sizes || []).find((x) => x.label === it.size) || (p.sizes || [])[0];
      if (s) s.stock = Math.max(0, (Number(s.stock) || 0) + sign * it.qty);
      p.sold = Math.max(0, (p.sold || 0) - sign * it.qty);
      p.updatedAt = Date.now();
      return p;
    });
    if (updated) { const i = S.products.findIndex((p) => p.id === it.productId); if (i >= 0) S.products[i] = updated; }
  }
  await markDirty();
  return want;
}
