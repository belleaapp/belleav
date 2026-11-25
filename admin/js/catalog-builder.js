// Construit le fichier catalogue public (lu par la boutique sans aucune lecture Firestore)
import { promoHash, toMs } from './shared/utils.js';

const PRODUCT_FIELDS = ['id', 'name', 'slug', 'sku', 'description', 'category', 'price', 'oldPrice', 'images',
  'colors', 'sizes', 'tags', 'featured', 'isNew', 'material', 'care', 'sold', 'createdAt'];

export async function buildCatalog({ products = [], categories = [], settings = {}, promos = [] }) {
  const activeCats = categories.filter((c) => c.active !== false);
  const catIds = new Set(activeCats.map((c) => c.id));
  const now = Date.now();
  const pubProducts = products
    .filter((p) => p.active !== false && catIds.has(p.category))
    .map((p) => {
      const o = {};
      for (const k of PRODUCT_FIELDS) if (p[k] !== undefined && p[k] !== null && p[k] !== '') o[k] = p[k];
      o.createdAt = toMs(p.createdAt) || now;
      o.price = Number(p.price) || 0;
      if (o.oldPrice) o.oldPrice = Number(o.oldPrice);
      o.sizes = (p.sizes || []).map((s) => ({ label: s.label, stock: Math.max(0, Number(s.stock) || 0) }));
      return o;
    });
  const pubPromos = [];
  for (const pr of promos) {
    if (pr.active === false) continue;
    if (pr.expiresAt && toMs(pr.expiresAt) < now) continue;
    pubPromos.push({
      hash: await promoHash(pr.code),
      type: pr.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(pr.value) || 0,
      minTotal: Number(pr.minTotal) || 0,
      expiresAt: pr.expiresAt ? toMs(pr.expiresAt) : null,
      label: pr.label || '',
    });
  }
  const { private: _p, ...publicSettings } = settings || {};
  return {
    version: now.toString(36),
    publishedAt: now,
    settings: publicSettings,
    categories: activeCats
      .map(({ id, name, group, order, description, image }) => ({ id, name, group: group || 'femme', order: order ?? 0, description: description || '', image: image || '' }))
      .sort((a, b) => a.order - b.order),
    products: pubProducts,
    promos: pubPromos,
  };
}
