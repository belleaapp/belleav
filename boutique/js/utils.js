// Utilitaires partagés (boutique + admin)
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Normalise un texte pour la recherche : minuscules, sans accents, sans ponctuation. */
export const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim();

export const slugify = (s) => norm(s).replace(/\s+/g, '-').slice(0, 80) || 'produit';

export const money = (n, cur = 'DA') =>
  `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} ${cur}`;

export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export const readLS = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
export const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const promoHash = (code) => sha256('belleav:' + String(code).trim().toUpperCase());

/** Code de commande lisible et difficile à deviner : BV-7K3P9Q2X */
export function genOrderCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(8));
  return 'BV-' + [...r].map((b) => A[b % A.length]).join('');
}

/** Téléphone algérien : 05/06/07 + 8 chiffres (accepte +213 / 00213) */
export function cleanPhone(p) {
  let s = String(p || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+213')) s = '0' + s.slice(4);
  else if (s.startsWith('00213')) s = '0' + s.slice(5);
  else if (s.startsWith('213') && s.length === 12) s = '0' + s.slice(3);
  return s;
}
export const phoneOk = (p) => /^0[5-7]\d{8}$/.test(cleanPhone(p));
export const phoneIntl = (p) => '213' + cleanPhone(p).replace(/^0/, '');

export const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  const d = Date.parse(v);
  return isNaN(d) ? 0 : d;
};
export const fmtDate = (v, withTime = true) => {
  const ms = toMs(v);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};
export const timeAgo = (v) => {
  const s = Math.floor((Date.now() - toMs(v)) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
  return fmtDate(v, false);
};

/* ---------- Produits ---------- */
export const totalStock = (p) => (p.sizes || []).reduce((a, s) => a + (Number(s.stock) || 0), 0);
export const discountPct = (p) =>
  p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

export function shapeFor(cat = '') {
  const c = String(cat);
  if (c.includes('access')) return 'acc';
  if (c.includes('enfant')) return c.includes('priere') ? 'kidhijab' : 'kid';
  if (c.includes('hijab') || c.includes('khimar')) return 'hijab';
  return 'dress';
}

const BGS = ['#f3ece4', '#ece3d9', '#f6f1eb', '#e8e0d6'];
const SHAPES = {
  dress:
    '<path d="M300 152 v-26 a16 16 0 1 0 -16 -16" fill="none" stroke="#9b8f84" stroke-width="5" stroke-linecap="round"/><path d="M262 152 Q300 184 338 152 L398 170 Q436 184 450 228 L486 420 L444 434 L408 288 L434 712 L166 712 L192 288 L156 434 L114 420 L150 228 Q164 184 202 170 Z"/>',
  hijab:
    '<path d="M300 150 C222 150 182 220 182 300 C182 345 192 372 204 392 C152 452 124 560 132 690 L468 690 C476 560 448 452 396 392 C408 372 418 345 418 300 C418 220 378 150 300 150 Z"/><ellipse cx="300" cy="305" rx="64" ry="84" fill="BG" stroke="none"/>',
  kid:
    '<path d="M300 236 v-22 a14 14 0 1 0 -14 -14" fill="none" stroke="#9b8f84" stroke-width="5" stroke-linecap="round"/><path d="M272 236 Q300 258 328 236 L366 250 L404 340 L374 354 L352 312 L396 612 L204 612 L248 312 L226 354 L196 340 L234 250 Z"/>',
  kidhijab:
    '<path d="M300 220 C244 220 216 270 216 328 C216 360 222 380 232 394 C196 436 176 512 182 604 L418 604 C424 512 404 436 368 394 C378 380 384 360 384 328 C384 270 356 220 300 220 Z"/><ellipse cx="300" cy="330" rx="46" ry="60" fill="BG" stroke="none"/>',
  acc:
    '<path d="M222 330 h156 a20 20 0 0 1 20 19 l22 300 a20 20 0 0 1 -20 21 h-200 a20 20 0 0 1 -20 -21 l22 -300 a20 20 0 0 1 20 -19 z"/><path d="M252 330 v-36 a48 48 0 0 1 96 0 v36" fill="none" stroke="FG" stroke-width="16"/>',
};

/** Visuel élégant généré à la volée quand un produit n'a pas encore de photo. */
export function placeholder(p, i = 0) {
  const cols = p.colors && p.colors.length ? p.colors : [{ hex: '#c9a27e' }];
  const fg = cols[i % cols.length].hex || '#c9a27e';
  const bg = BGS[i % BGS.length];
  const shape = SHAPES[shapeFor(p.category)].replace(/BG/g, bg).replace(/FG/g, fg);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="${bg}"/><circle cx="300" cy="420" r="250" fill="#fff" opacity=".35"/><g fill="${fg}" stroke="rgba(0,0,0,.12)" stroke-width="3">${shape}</g><text x="300" y="770" text-anchor="middle" font-family="Georgia,serif" font-size="22" letter-spacing="6" fill="#9b8f84" opacity=".7">BELLEAV</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function productImages(p) {
  if (p.images && p.images.length) return p.images;
  const n = Math.max(2, (p.colors || []).length);
  return Array.from({ length: n }, (_, i) => placeholder(p, i));
}
