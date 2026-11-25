import { S } from '../state.js';
import { esc, norm, toMs, fmtDate, timeAgo, phoneIntl } from '../shared/utils.js';
import { I, fmt, statusChip, modal, csvDownload, pager, sortIcon } from '../ui.js';

const PER = 30;
let st = { q: '', seg: '', page: 1, sort: { key: 'spent', dir: -1 } };

function aggregate() {
  const map = new Map();
  for (const o of S.orders) {
    const ph = o.customer?.phone;
    if (!ph) continue;
    const c = map.get(ph) || { phone: ph, orders: [], spent: 0, delivered: 0, bad: 0, first: Infinity, last: 0 };
    c.orders.push(o);
    const t = toMs(o.createdAt);
    if (t >= c.last) { c.last = t; c.name = `${o.customer.firstName} ${o.customer.lastName}`; c.wilaya = o.customer.wilayaName; c.commune = o.customer.commune; }
    c.first = Math.min(c.first, t);
    if (o.status === 'livree') { c.delivered++; c.spent += o.total; }
    if (['annulee', 'retournee'].includes(o.status)) c.bad++;
    map.set(ph, c);
  }
  return [...map.values()].map((c) => ({ ...c, count: c.orders.length, seg: c.bad >= 2 && c.bad >= c.delivered ? 'risk' : c.delivered >= 3 || c.spent >= 30000 ? 'vip' : c.count === 1 ? 'new' : 'regular' }));
}
const SEG = { vip: ['Fidèle ★', 'green'], regular: ['Régulière', 'teal'], new: ['Nouvelle', 'blue'], risk: ['À risque', 'red'] };

export function render(root) {
  root.innerHTML = `<div class="page-head"><div><h2>Clientes</h2><p class="muted" id="cSub"></p></div><button class="btn ghost" id="cCsv">${I.download} Exporter</button></div>
    <div class="kpis" id="cKpis"></div>
    <div class="toolbar"><label class="search">${I.search}<input id="cq" placeholder="Nom, téléphone, wilaya…" value="${esc(st.q)}"></label>
      <div class="seg">${[['', 'Toutes'], ['vip', 'Fidèles'], ['regular', 'Régulières'], ['new', 'Nouvelles'], ['risk', 'À risque']].map(([v, l]) => `<button data-seg="${v}" class="${st.seg === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card flush"><div class="table-wrap" id="cTable"></div></div>`;

  let all = [];
  const filtered = () => {
    const q = norm(st.q);
    const l = all.filter((c) => (!st.seg || c.seg === st.seg) && (!q || norm(`${c.name} ${c.phone} ${c.wilaya} ${c.commune}`).includes(q)));
    const { key, dir } = st.sort;
    l.sort((a, b) => dir * (key === 'name' ? a.name.localeCompare(b.name) : (a[key] || 0) - (b[key] || 0)));
    return l;
  };
  const draw = () => {
    all = aggregate();
    const l = filtered();
    const rows = l.slice((st.page - 1) * PER, st.page * PER);
    root.querySelector('#cSub').textContent = `${all.length} clientes au total`;
    const repeat = all.filter((c) => c.count > 1).length;
    root.querySelector('#cKpis').innerHTML = `<div class="kpi"><span>Clientes</span><b>${all.length}</b></div><div class="kpi"><span>Clientes fidèles</span><b>${all.filter((c) => c.seg === 'vip').length}</b></div><div class="kpi"><span>Taux de réachat</span><b>${all.length ? Math.round((repeat / all.length) * 100) : 0}%</b></div><div class="kpi"><span>À risque</span><b>${all.filter((c) => c.seg === 'risk').length}</b><small>annulations / retours répétés</small></div>`;
    root.querySelector('#cTable').innerHTML = `<table class="tbl"><thead><tr><th class="sortable" data-sort="name">Cliente${sortIcon('name', st.sort)}</th><th>Wilaya</th><th class="sortable num" data-sort="count">Commandes${sortIcon('count', st.sort)}</th><th class="num">Livrées / annulées</th><th class="sortable num" data-sort="spent">Total dépensé${sortIcon('spent', st.sort)}</th><th class="sortable" data-sort="last">Dernière commande${sortIcon('last', st.sort)}</th><th>Profil</th><th></th></tr></thead><tbody>
      ${rows.map((c) => `<tr class="clickable" data-cust="${esc(c.phone)}"><td><b>${esc(c.name)}</b><small>${esc(c.phone)}</small></td><td>${esc(c.wilaya)}<small>${esc(c.commune || '')}</small></td><td class="num">${c.count}</td><td class="num">${c.delivered} / <span class="${c.bad ? 'red-t' : ''}">${c.bad}</span></td><td class="num"><b>${fmt(c.spent)}</b></td><td>${timeAgo(c.last)}</td><td><span class="chip-st c-${SEG[c.seg][1]}">${SEG[c.seg][0]}</span></td>
      <td class="actions"><a class="ibtn" href="https://wa.me/${phoneIntl(c.phone)}" target="_blank" rel="noopener" data-stop title="WhatsApp">${I.whatsapp}</a><a class="ibtn" href="tel:${esc(c.phone)}" data-stop title="Appeler">${I.phone}</a></td></tr>`).join('') || `<tr><td colspan="8"><div class="empty sm">${I.user}<p>Aucune cliente.</p></div></td></tr>`}
      </tbody></table>${pager(l.length, st.page, PER)}`;
  };
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-stop]')) return;
    const s = t.closest('[data-seg]'); if (s) { st.seg = s.dataset.seg; st.page = 1; root.querySelectorAll('[data-seg]').forEach((b) => b.classList.toggle('on', b === s)); return draw(); }
    const so = t.closest('[data-sort]'); if (so) { const k = so.dataset.sort; st.sort = { key: k, dir: st.sort.key === k ? -st.sort.dir : -1 }; return draw(); }
    const pg = t.closest('[data-page]'); if (pg) { st.page = Number(pg.dataset.page); return draw(); }
    if (t.closest('#cCsv')) return csvDownload('clientes-belleav.csv', [['Nom', 'Téléphone', 'Wilaya', 'Commune', 'Commandes', 'Livrées', 'Annulées/retours', 'Total dépensé', 'Première commande', 'Dernière commande', 'Profil'], ...filtered().map((c) => [c.name, c.phone, c.wilaya, c.commune, c.count, c.delivered, c.bad, c.spent, fmtDate(c.first, false), fmtDate(c.last, false), SEG[c.seg][0]])]);
    const r = t.closest('[data-cust]');
    if (r) {
      const c = all.find((x) => x.phone === r.dataset.cust);
      modal(`<div class="mhead"><div><h3>${esc(c.name)}</h3><small class="muted">${esc(c.phone)} · ${esc(c.wilaya)} · cliente depuis ${fmtDate(c.first, false)}</small></div><button class="ibtn" data-mclose>${I.close}</button></div>
        <div class="mbody"><div class="kpis sm"><div class="kpi"><span>Commandes</span><b>${c.count}</b></div><div class="kpi"><span>Livrées</span><b>${c.delivered}</b></div><div class="kpi"><span>Total dépensé</span><b>${fmt(c.spent)}</b></div></div>
        <table class="tbl"><thead><tr><th>Commande</th><th>Articles</th><th class="num">Total</th><th>Statut</th></tr></thead><tbody>${c.orders.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).map((o) => `<tr class="clickable" onclick="location.hash='#/orders?open=${encodeURIComponent(o.id)}';document.querySelector('.mwrap:last-child [data-mclose]').click()"><td><b class="mono">${esc(o.id)}</b><small>${fmtDate(o.createdAt)}</small></td><td class="ellipsis">${esc(o.items.map((i) => i.qty + '× ' + i.name).join(', '))}</td><td class="num">${fmt(o.total)}</td><td>${statusChip(o.status)}</td></tr>`).join('')}</tbody></table></div>
        <div class="mfoot"><a class="btn wa" href="https://wa.me/${phoneIntl(c.phone)}" target="_blank" rel="noopener">${I.whatsapp} WhatsApp</a><a class="btn ghost" href="tel:${esc(c.phone)}">${I.phone} Appeler</a></div>`, { wide: true });
    }
  });
  let tq;
  root.querySelector('#cq').addEventListener('input', (e) => { clearTimeout(tq); tq = setTimeout(() => { st.q = e.target.value; st.page = 1; draw(); }, 180); });
  draw();
  return { on: ['orders'], refresh: draw };
}
