import { S, catName, isDirty } from '../state.js';
import { esc, toMs, timeAgo, totalStock, productImages } from '../shared/utils.js';
import { I, fmt, statusChip, STATUSES } from '../ui.js';

const DAY = 864e5;
let period = 30;

export function render(root) {
  const draw = () => {
    const now = Date.now();
    const from = period ? now - period * DAY : 0;
    const prevFrom = period ? from - period * DAY : 0;
    const inRange = (o, a, b) => { const t = toMs(o.createdAt); return t >= a && t < b; };
    const cur = S.orders.filter((o) => inRange(o, from, now + 1));
    const prev = period ? S.orders.filter((o) => inRange(o, prevFrom, from)) : [];
    const valid = (l) => l.filter((o) => !['annulee', 'retournee'].includes(o.status));
    const revenue = (l) => valid(l).reduce((a, o) => a + (o.total || 0) - (o.delivery?.price || 0), 0);
    const rev = revenue(cur), prevRev = revenue(prev);
    const delivered = cur.filter((o) => o.status === 'livree').length;
    const closed = cur.filter((o) => ['livree', 'annulee', 'retournee'].includes(o.status)).length;
    const avg = valid(cur).length ? rev / valid(cur).length : 0;
    const pending = S.orders.filter((o) => o.status === 'nouvelle');
    const toShip = S.orders.filter((o) => ['confirmee', 'preparation'].includes(o.status));
    const delta = (a, b) => (!period || !b ? '' : `<span class="delta ${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / b) * 100))}%</span>`);

    // série journalière
    const days = Math.min(period || 60, 60);
    const series = Array.from({ length: days }, (_, i) => {
      const d0 = new Date(now - (days - 1 - i) * DAY); d0.setHours(0, 0, 0, 0);
      const a = d0.getTime(), b = a + DAY;
      const l = valid(S.orders.filter((o) => inRange(o, a, b)));
      return { d: d0, v: l.reduce((s, o) => s + (o.total || 0) - (o.delivery?.price || 0), 0), n: l.length };
    });
    const max = Math.max(1, ...series.map((s) => s.v));
    const W = 720, H = 200, bw = W / days;
    const chart = `<svg viewBox="0 0 ${W} ${H + 24}" class="chart" role="img" aria-label="Chiffre d'affaires par jour">
      ${[0.25, 0.5, 0.75, 1].map((g) => `<line x1="0" x2="${W}" y1="${H - H * g}" y2="${H - H * g}" class="grid"/>`).join('')}
      ${series.map((s, i) => { const h = (s.v / max) * (H - 8); return `<rect x="${i * bw + bw * 0.18}" y="${H - h}" width="${bw * 0.64}" height="${Math.max(h, s.v ? 2 : 0)}" rx="${Math.min(4, bw * 0.3)}" class="bar"><title>${s.d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${fmt(s.v)} (${s.n} cmd)</title></rect>`; }).join('')}
      ${series.map((s, i) => (i % Math.ceil(days / 7) === 0 ? `<text x="${i * bw + bw / 2}" y="${H + 18}" text-anchor="middle">${s.d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>` : '')).join('')}
    </svg>`;

    const byStatus = Object.keys(STATUSES).map((k) => [k, cur.filter((o) => o.status === k).length]);
    const top = new Map();
    valid(cur).forEach((o) => o.items.forEach((i) => { const t = top.get(i.productId) || { name: i.name, q: 0, v: 0 }; t.q += i.qty; t.v += i.qty * i.price; top.set(i.productId, t); }));
    const topList = [...top.entries()].sort((a, b) => b[1].q - a[1].q).slice(0, 6);
    const wil = new Map();
    valid(cur).forEach((o) => wil.set(o.customer?.wilayaName || '?', (wil.get(o.customer?.wilayaName || '?') || 0) + 1));
    const wilList = [...wil.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const wMax = Math.max(1, ...wilList.map((w) => w[1]));
    const low = S.products.filter((p) => p.active !== false).map((p) => ({ p, s: totalStock(p), out: (p.sizes || []).filter((x) => !(x.stock > 0)).map((x) => x.label) })).filter((x) => x.s <= 3 || x.out.length).sort((a, b) => a.s - b.s).slice(0, 8);

    root.innerHTML = `
    <div class="page-head"><div><h2>Bonjour 👋</h2><p class="muted">Voici l'activité de votre boutique.</p></div>
      <div class="seg">${[[7, '7 j'], [30, '30 j'], [90, '90 j'], [0, 'Tout']].map(([v, l]) => `<button class="${period === v ? 'on' : ''}" data-period="${v}">${l}</button>`).join('')}</div></div>

    ${pending.length || toShip.length || isDirty() ? `<div class="alerts">
      ${pending.length ? `<a href="#/orders?status=nouvelle" class="alert blue">${I.box}<div><b>${pending.length} nouvelle${pending.length > 1 ? 's' : ''} commande${pending.length > 1 ? 's' : ''} à confirmer</b><small>La plus ancienne : ${timeAgo(pending[pending.length - 1].createdAt)}</small></div>${I.chevron}</a>` : ''}
      ${toShip.length ? `<a href="#/orders?status=confirmee" class="alert amber">${I.truck}<div><b>${toShip.length} commande${toShip.length > 1 ? 's' : ''} à préparer / expédier</b><small>Confirmées ou en préparation</small></div>${I.chevron}</a>` : ''}
      ${isDirty() ? `<div class="alert violet">${I.refresh}<div><b>Des modifications ne sont pas encore en ligne</b><small>Cliquez sur « Publier » en haut à droite</small></div></div>` : ''}
    </div>` : ''}

    <div class="kpis">
      <div class="kpi"><span>Chiffre d'affaires</span><b>${fmt(rev)}</b>${delta(rev, prevRev)}<small>hors livraison, hors annulations</small></div>
      <div class="kpi"><span>Commandes</span><b>${cur.length}</b>${delta(cur.length, prev.length)}<small>${valid(cur).length} valides</small></div>
      <div class="kpi"><span>Panier moyen</span><b>${fmt(avg)}</b><small>par commande valide</small></div>
      <div class="kpi"><span>Taux de livraison</span><b>${closed ? Math.round((delivered / closed) * 100) : 0}%</b><small>${delivered} livrées / ${closed} clôturées</small></div>
    </div>

    <div class="dgrid">
      <section class="card span2"><div class="card-h"><h3>Ventes par jour</h3><span class="muted small">${days} derniers jours</span></div>${chart}</section>
      <section class="card"><div class="card-h"><h3>Statuts</h3></div>
        <div class="hbars">${byStatus.map(([k, n]) => `<a href="#/orders?status=${k}" class="hbar"><span>${STATUSES[k].label}</span><i><em class="c-${STATUSES[k].color}" style="width:${cur.length ? (n / cur.length) * 100 : 0}%"></em></i><b>${n}</b></a>`).join('')}</div></section>
      <section class="card"><div class="card-h"><h3>Meilleures ventes</h3></div>
        ${topList.length ? `<ol class="toplist">${topList.map(([id, t], i) => { const p = S.products.find((x) => x.id === id); return `<li><em>${i + 1}</em>${p ? `<img src="${productImages(p)[0]}" alt="">` : ''}<span><b>${esc(t.name)}</b><small>${t.q} vendus · ${fmt(t.v)}</small></span></li>`; }).join('')}</ol>` : '<p class="muted">Pas encore de ventes sur la période.</p>'}</section>
      <section class="card"><div class="card-h"><h3>Top wilayas</h3></div>
        ${wilList.length ? `<div class="hbars">${wilList.map(([w, n]) => `<div class="hbar"><span>${esc(w)}</span><i><em class="c-accent" style="width:${(n / wMax) * 100}%"></em></i><b>${n}</b></div>`).join('')}</div>` : '<p class="muted">—</p>'}</section>
      <section class="card"><div class="card-h"><h3>Stock faible</h3><a href="#/products?stock=low" class="link">Tout voir</a></div>
        ${low.length ? `<ul class="lowlist">${low.map(({ p, s, out }) => `<li><a href="#/products?edit=${p.id}"><img src="${productImages(p)[0]}" alt=""><span><b>${esc(p.name)}</b><small>${out.length ? 'Épuisé : ' + out.map(esc).join(', ') : catName(p.category)}</small></span><em class="${s === 0 ? 'red' : 'amber'}">${s}</em></a></li>`).join('')}</ul>` : `<p class="muted">${I.check} Tous les stocks sont confortables.</p>`}</section>
      <section class="card span2"><div class="card-h"><h3>Dernières commandes</h3><a href="#/orders" class="link">Toutes les commandes</a></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Commande</th><th>Cliente</th><th>Wilaya</th><th>Total</th><th>Statut</th><th>Date</th></tr></thead><tbody>
        ${S.orders.slice(0, 7).map((o) => `<tr class="clickable" onclick="location.hash='#/orders?open=${encodeURIComponent(o.id)}'"><td><b class="mono">${esc(o.id)}</b></td><td>${esc(o.customer?.firstName)} ${esc(o.customer?.lastName)}</td><td>${esc(o.customer?.wilayaName)}</td><td><b>${fmt(o.total)}</b></td><td>${statusChip(o.status)}</td><td class="muted">${timeAgo(o.createdAt)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted center">Aucune commande pour le moment</td></tr>'}
        </tbody></table></div></section>
    </div>`;
    root.querySelectorAll('[data-period]').forEach((b) => (b.onclick = () => { period = Number(b.dataset.period); draw(); }));
  };
  draw();
  return { on: ['orders', 'meta'], refresh: draw };
}
