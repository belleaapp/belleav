import * as db from '../db.js';
import { S, syncStock } from '../state.js';
import { esc, toMs, fmtDate, timeAgo, norm, cleanPhone, phoneOk, phoneIntl, productImages, genOrderCode } from '../shared/utils.js';
import { WILAYAS, feesFor, wilayaName } from '../shared/wilayas.js';
import { I, fmt, statusChip, STATUSES, FLOW, toast, modal, confirmBox, busy, csvDownload, pager, sortIcon } from '../ui.js';

const PER = 25;
const CARRIERS = ['Yalidine', 'ZR Express', 'Maystro', 'Ecotrack', 'Noest', 'Livreur interne', 'Autre'];
let st = { status: '', q: '', wilaya: '', from: '', to: '', page: 1, sort: { key: 'date', dir: -1 }, sel: new Set() };

export function render(root, params) {
  if (params.status !== undefined) st.status = params.status;
  root.innerHTML = `
    <div class="page-head"><div><h2>Commandes</h2><p class="muted" id="oSub"></p></div>
      <div class="row-btns"><button class="btn ghost" id="exportBtn">${I.download} Exporter CSV</button><button class="btn primary" id="newOrder">${I.plus} Commande manuelle</button></div></div>
    <div class="tabs" id="oTabs"></div>
    <div class="toolbar">
      <label class="search">${I.search}<input id="oq" placeholder="N°, nom, téléphone…" value="${esc(st.q)}"></label>
      <select id="ow"><option value="">Toutes les wilayas</option>${WILAYAS.map((w) => `<option value="${w.code}" ${String(st.wilaya) === String(w.code) ? 'selected' : ''}>${String(w.code).padStart(2, '0')} ${esc(w.name)}</option>`).join('')}</select>
      <label class="date">Du <input type="date" id="ofrom" value="${st.from}"></label>
      <label class="date">au <input type="date" id="oto" value="${st.to}"></label>
      <button class="btn ghost sm" id="oreset">Réinitialiser</button>
    </div>
    <div class="bulk" id="bulk"></div>
    <div class="card flush"><div class="table-wrap" id="oTable"></div></div>`;

  const filtered = () => {
    const q = norm(st.q);
    const from = st.from ? new Date(st.from).getTime() : 0;
    const to = st.to ? new Date(st.to).getTime() + 864e5 : Infinity;
    let l = S.orders.filter((o) => {
      const t = toMs(o.createdAt);
      if (st.status && o.status !== st.status) return false;
      if (st.wilaya && String(o.customer?.wilaya) !== String(st.wilaya)) return false;
      if (t < from || t >= to) return false;
      if (q && !norm(`${o.id} ${o.customer?.firstName} ${o.customer?.lastName} ${o.customer?.phone} ${o.customer?.phone2} ${o.customer?.commune} ${o.trackingNumber || ''}`).includes(q)) return false;
      return true;
    });
    const k = st.sort.key, d = st.sort.dir;
    l.sort((a, b) => d * (k === 'total' ? a.total - b.total : k === 'client' ? (a.customer?.lastName || '').localeCompare(b.customer?.lastName || '') : toMs(a.createdAt) - toMs(b.createdAt)));
    return l;
  };

  const draw = () => {
    const counts = Object.fromEntries(Object.keys(STATUSES).map((k) => [k, S.orders.filter((o) => o.status === k).length]));
    root.querySelector('#oTabs').innerHTML = `<button class="${!st.status ? 'on' : ''}" data-st="">Toutes <b>${S.orders.length}</b></button>` + Object.entries(STATUSES).map(([k, v]) => `<button class="${st.status === k ? 'on' : ''}" data-st="${k}"><i class="dot c-${v.color}"></i>${v.label} <b>${counts[k]}</b></button>`).join('');
    const l = filtered();
    const pages = Math.max(1, Math.ceil(l.length / PER));
    if (st.page > pages) st.page = pages;
    const rows = l.slice((st.page - 1) * PER, st.page * PER);
    const sum = l.filter((o) => !['annulee', 'retournee'].includes(o.status)).reduce((a, o) => a + o.total, 0);
    root.querySelector('#oSub').textContent = `${l.length} commande${l.length > 1 ? 's' : ''} · ${fmt(sum)} (hors annulées)`;
    const phoneCount = {};
    S.orders.forEach((o) => { const p = o.customer?.phone; if (p) phoneCount[p] = (phoneCount[p] || 0) + 1; });
    root.querySelector('#oTable').innerHTML = `<table class="tbl"><thead><tr>
        <th class="cb"><input type="checkbox" id="selAll" ${rows.length && rows.every((o) => st.sel.has(o.id)) ? 'checked' : ''} aria-label="Tout sélectionner"></th>
        <th class="sortable" data-sort="date">Commande${sortIcon('date', st.sort)}</th><th class="sortable" data-sort="client">Cliente${sortIcon('client', st.sort)}</th><th>Livraison</th><th>Articles</th><th class="sortable num" data-sort="total">Total${sortIcon('total', st.sort)}</th><th>Statut</th><th></th></tr></thead>
      <tbody>${rows.map((o) => `<tr class="clickable ${o.status === 'nouvelle' ? 'is-new' : ''}" data-open="${esc(o.id)}">
        <td class="cb"><input type="checkbox" data-sel="${esc(o.id)}" ${st.sel.has(o.id) ? 'checked' : ''} aria-label="Sélectionner"></td>
        <td><b class="mono">${esc(o.id)}</b><small>${fmtDate(o.createdAt)}${o.source === 'telephone' ? ' · ☎' : ''}</small></td>
        <td><b>${esc(o.customer?.firstName)} ${esc(o.customer?.lastName)}</b>${phoneCount[o.customer?.phone] > 1 ? `<span class="mini-tag">${phoneCount[o.customer?.phone]} cmd</span>` : ''}<small>${esc(o.customer?.phone)}</small></td>
        <td>${esc(o.customer?.wilayaName)}<small>${o.delivery?.type === 'desk' ? 'Stop desk' : 'Domicile'}${o.trackingNumber ? ' · ' + esc(o.trackingNumber) : ''}</small></td>
        <td>${o.items.reduce((a, i) => a + i.qty, 0)}<small class="ellipsis">${esc(o.items.map((i) => i.name).join(', '))}</small></td>
        <td class="num"><b>${fmt(o.total)}</b></td>
        <td>${statusChip(o.status)}</td>
        <td class="actions"><a class="ibtn" href="https://wa.me/${phoneIntl(o.customer?.phone)}" target="_blank" rel="noopener" title="WhatsApp" data-stop>${I.whatsapp}</a><a class="ibtn" href="tel:${esc(o.customer?.phone)}" title="Appeler" data-stop>${I.phone}</a></td>
      </tr>`).join('') || `<tr><td colspan="8"><div class="empty sm">${I.box}<p>Aucune commande ne correspond.</p></div></td></tr>`}</tbody></table>${pager(l.length, st.page, PER)}`;
    drawBulk();
  };

  const drawBulk = () => {
    const n = st.sel.size;
    root.querySelector('#bulk').innerHTML = n ? `<b>${n} sélectionnée${n > 1 ? 's' : ''}</b>
      <select id="bulkSt"><option value="">Changer le statut…</option>${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
      <button class="btn ghost sm" id="bulkPrint">Imprimer les bons</button><button class="btn ghost sm" id="bulkCsv">Exporter</button><button class="link" id="bulkClear">Désélectionner</button>` : '';
    root.querySelector('#bulk').classList.toggle('show', n > 0);
  };

  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-stop]')) { e.stopPropagation(); return; }
    const tab = t.closest('[data-st]');
    if (tab) { st.status = tab.dataset.st; st.page = 1; st.sel.clear(); history.replaceState(null, '', '#/orders' + (st.status ? '?status=' + st.status : '')); return draw(); }
    const so = t.closest('[data-sort]');
    if (so) { const k = so.dataset.sort; st.sort = { key: k, dir: st.sort.key === k ? -st.sort.dir : -1 }; return draw(); }
    const pg = t.closest('[data-page]');
    if (pg) { st.page = Number(pg.dataset.page); draw(); root.scrollIntoView(); return; }
    if (t.matches('[data-sel],#selAll')) return;
    const row = t.closest('[data-open]');
    if (row) return openOrder(row.dataset.open);
    if (t.id === 'oreset') { st = { ...st, q: '', wilaya: '', from: '', to: '', page: 1 }; return render(root, {}); }
    if (t.id === 'bulkClear') { st.sel.clear(); return draw(); }
    if (t.id === 'bulkPrint') return printOrders(S.orders.filter((o) => st.sel.has(o.id)));
    if (t.id === 'bulkCsv') return exportCsv(S.orders.filter((o) => st.sel.has(o.id)));
    if (t.closest('#exportBtn')) return exportCsv(filtered());
    if (t.closest('#newOrder')) return manualOrder();
  });
  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.sel) { t.checked ? st.sel.add(t.dataset.sel) : st.sel.delete(t.dataset.sel); return drawBulk(); }
    if (t.id === 'selAll') { const l = filtered().slice((st.page - 1) * PER, st.page * PER); l.forEach((o) => (t.checked ? st.sel.add(o.id) : st.sel.delete(o.id))); return draw(); }
    if (t.id === 'ow') { st.wilaya = t.value; st.page = 1; draw(); }
    if (t.id === 'ofrom') { st.from = t.value; st.page = 1; draw(); }
    if (t.id === 'oto') { st.to = t.value; st.page = 1; draw(); }
    if (t.id === 'bulkSt' && t.value) {
      const ids = [...st.sel];
      if (!(await confirmBox(`Passer ${ids.length} commande(s) au statut « ${STATUSES[t.value].label} » ?`))) { t.value = ''; return; }
      for (const id of ids) { const o = S.orders.find((x) => x.id === id); if (o && o.status !== t.value) await setStatus(o, t.value); }
      st.sel.clear(); toast('Statuts mis à jour'); draw();
    }
  });
  let tq;
  root.querySelector('#oq').addEventListener('input', (e) => { clearTimeout(tq); tq = setTimeout(() => { st.q = e.target.value; st.page = 1; draw(); }, 200); });

  draw();
  if (params.open) setTimeout(() => openOrder(params.open), 50);
  return {
    on: ['orders'], refresh: () => { draw(); refreshOpen?.(); },
    update(p) { if (p.status !== undefined) { st.status = p.status; draw(); } if (p.open) openOrder(p.open); },
  };
}

/* ================= Changement de statut ================= */
export async function setStatus(o, status) {
  const stockApplied = await syncStock(o, status);
  const history = [...(o.history?.length ? o.history : [{ status: o.status, at: toMs(o.createdAt) }]), { status, at: Date.now(), by: S.user?.email || '' }];
  await db.patch('orders', o.id, { status, history, stockApplied, updatedAt: Date.now() });
  Object.assign(o, { status, history, stockApplied });
}

/* ================= Détail d'une commande ================= */
let refreshOpen = null;
function openOrder(id) {
  const o0 = S.orders.find((x) => x.id === id);
  if (!o0) return toast('Commande introuvable', 'err');
  const m = modal('<div class="odetail"></div>', { side: true, onClose: () => { refreshOpen = null; history.replaceState(null, '', location.hash.replace(/[?&]open=[^&]*/, '')); } });
  const box = m.el.querySelector('.odetail');
  const draw = () => {
    const o = S.orders.find((x) => x.id === id);
    if (!o) return m.close();
    const c = o.customer || {};
    const same = S.orders.filter((x) => x.customer?.phone === c.phone && x.id !== o.id);
    const bad = same.filter((x) => ['annulee', 'retournee'].includes(x.status)).length;
    const idx = FLOW.indexOf(o.status);
    const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
    const waConfirm = `Bonjour ${c.firstName}, c'est BelleaV 🌸 Nous avons bien reçu votre commande ${o.id} d'un montant de ${fmt(o.total)} (livraison ${o.delivery?.type === 'desk' ? 'au bureau' : 'à domicile'}, ${c.wilayaName}). Pouvez-vous nous la confirmer ? Merci !`;
    const waShip = `Bonjour ${c.firstName}, votre commande BelleaV ${o.id} a été expédiée 🚚${o.trackingNumber ? ` N° de suivi : ${o.trackingNumber}${o.carrier ? ' (' + o.carrier + ')' : ''}.` : ''} Montant à régler à la livraison : ${fmt(o.total)}. Merci pour votre confiance !`;
    box.innerHTML = `
      <div class="mhead sticky"><div><h3 class="mono">${esc(o.id)}</h3><small class="muted">${fmtDate(o.createdAt)} · ${o.source === 'telephone' ? 'Commande téléphone' : 'Site web'}</small></div>${statusChip(o.status)}<button class="ibtn" data-mclose aria-label="Fermer">${I.close}</button></div>
      <div class="mbody">
        <div class="stepper">${FLOW.map((s, i) => `<button class="${i <= idx ? 'done' : ''} ${i === idx ? 'cur' : ''}" data-set="${s}" title="Passer à « ${STATUSES[s].label} »"><i>${i <= idx ? I.check : i + 1}</i><span>${STATUSES[s].label}</span></button>`).join('')}</div>
        <div class="row-btns wrap">
          ${next ? `<button class="btn primary" data-set="${next}">${I.check} Marquer « ${STATUSES[next].label} »</button>` : ''}
          ${!['annulee', 'retournee', 'livree'].includes(o.status) ? `<button class="btn ghost danger-t" data-set="annulee">Annuler</button>` : ''}
          ${o.status === 'livree' || o.status === 'expediee' ? `<button class="btn ghost danger-t" data-set="retournee">Retour</button>` : ''}
          ${['annulee', 'retournee'].includes(o.status) ? `<button class="btn ghost" data-set="nouvelle">Réouvrir</button>` : ''}
        </div>
        <p class="hint">${o.stockApplied ? `${I.check} Stock déduit pour cette commande.` : 'Le stock sera déduit automatiquement à la confirmation (et restitué en cas d’annulation ou de retour).'}</p>

        <section class="osec"><h4>Cliente ${same.length ? `<span class="mini-tag">${same.length + 1} commandes</span>` : '<span class="mini-tag green">Nouvelle cliente</span>'}${bad ? `<span class="mini-tag red">⚠ ${bad} annulée(s)/retour(s)</span>` : ''}</h4>
          <p class="big">${esc(c.firstName)} ${esc(c.lastName)}</p>
          <div class="contact-btns">
            <a class="btn ghost sm" href="tel:${esc(c.phone)}">${I.phone} ${esc(c.phone)}</a>
            ${c.phone2 ? `<a class="btn ghost sm" href="tel:${esc(c.phone2)}">${I.phone} ${esc(c.phone2)}</a>` : ''}
            <a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${phoneIntl(c.phone)}?text=${encodeURIComponent(waConfirm)}">${I.whatsapp} Confirmation</a>
            <a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${phoneIntl(c.phone)}?text=${encodeURIComponent(waShip)}">${I.whatsapp} Expédition</a>
          </div>
          <dl class="kv"><dt>Wilaya</dt><dd>${String(c.wilaya).padStart(2, '0')} - ${esc(c.wilayaName)}</dd><dt>Commune</dt><dd>${esc(c.commune)}</dd>
            <dt>Livraison</dt><dd>${o.delivery?.type === 'desk' ? 'Bureau (stop desk)' : 'À domicile'}</dd>${c.address ? `<dt>Adresse</dt><dd>${esc(c.address)}</dd>` : ''}${c.notes ? `<dt>Note</dt><dd class="note-in">${esc(c.notes)}</dd>` : ''}</dl>
        </section>

        <section class="osec"><h4>Articles</h4>
          <div class="olines">${o.items.map((i) => {
            const p = S.products.find((x) => x.id === i.productId);
            const size = p?.sizes?.find((s) => s.label === i.size);
            const warn = p && p.price !== i.price ? `<span class="mini-tag amber" title="Prix actuel du catalogue : ${fmt(p.price)}">prix catalogue ${fmt(p.price)}</span>` : !p ? '<span class="mini-tag red">produit supprimé</span>' : '';
            return `<div class="oline"><img src="${i.image || (p ? productImages(p)[Math.max(0, (p.colors || []).findIndex((c) => c.name === i.color))] || productImages(p)[0] : '')}" alt=""><div><b>${esc(i.name)}</b><small>${[i.color, i.size].filter(Boolean).map(esc).join(' · ')}${i.sku ? ' · ' + esc(i.sku) : ''}${size ? ` · stock : ${size.stock}` : ''}</small>${warn}</div><span>${i.qty} × ${fmt(i.price)}</span><b>${fmt(i.qty * i.price)}</b></div>`;
          }).join('')}</div>
          <div class="totals"><div><span>Sous-total</span><b>${fmt(o.subtotal)}</b></div>
            ${o.discount ? `<div class="green"><span>Remise ${o.promoCode ? '(' + esc(o.promoCode) + ')' : ''}</span><b>-${fmt(o.discount)}</b></div>` : ''}
            <div><span>Livraison</span><b>${o.delivery?.price ? fmt(o.delivery.price) : 'Offerte'}</b></div>
            <div class="grand"><span>Total à encaisser</span><b>${fmt(o.total)}</b></div></div>
        </section>

        <form class="osec" id="shipForm"><h4>Expédition & notes internes</h4>
          <div class="g3"><label class="f"><span>Transporteur</span><select name="carrier"><option value="">—</option>${CARRIERS.map((x) => `<option ${o.carrier === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label class="f"><span>N° de suivi</span><input name="trackingNumber" value="${esc(o.trackingNumber || '')}"></label>
            <label class="f"><span>Frais de livraison (${'DA'})</span><input name="ship" type="number" min="0" value="${o.delivery?.price || 0}"></label></div>
          <label class="f"><span>Note interne (non visible par la cliente)</span><textarea name="adminNote" rows="2">${esc(o.adminNote || '')}</textarea></label>
          <button class="btn ghost sm">Enregistrer</button>
        </form>

        <section class="osec"><h4>Historique</h4><ol class="hist">${(o.history?.length ? o.history : [{ status: o.status, at: o.createdAt }]).slice().reverse().map((h) => `<li>${statusChip(h.status)}<span>${fmtDate(h.at)}</span>${h.by ? `<small>${esc(h.by)}</small>` : ''}</li>`).join('')}</ol></section>
      </div>
      <div class="mfoot"><button class="btn ghost danger-t" id="delOrder">${I.trash} Supprimer</button><span class="grow"></span><button class="btn ghost" id="printOne">Imprimer le bon</button></div>`;
    box.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', async () => {
      const s = b.dataset.set;
      if (s === o.status) return;
      if (['annulee', 'retournee'].includes(s) && !(await confirmBox(`Marquer la commande comme « ${STATUSES[s].label} » ?${o.stockApplied ? ' Le stock sera restitué.' : ''}`, { danger: true }))) return;
      busy(b, true);
      try { await setStatus(o, s); toast(`Commande ${STATUSES[s].label.toLowerCase()}`); draw(); } catch (err) { toast(err.message, 'err'); busy(b, false); }
    }));
    box.querySelector('#shipForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const ship = Math.max(0, Number(f.ship.value) || 0);
      const data = { carrier: f.carrier.value, trackingNumber: f.trackingNumber.value.trim(), adminNote: f.adminNote.value.trim(), delivery: { ...o.delivery, price: ship }, total: o.subtotal - (o.discount || 0) + ship };
      await db.patch('orders', o.id, data);
      Object.assign(o, data);
      toast('Commande mise à jour'); draw();
    });
    box.querySelector('#printOne').onclick = () => printOrders([o]);
    box.querySelector('#delOrder').onclick = async () => {
      if (!(await confirmBox(`Supprimer définitivement la commande ${o.id} ?${o.stockApplied ? ' Le stock déduit sera restitué.' : ''}`, { danger: true, ok: 'Supprimer' }))) return;
      if (o.stockApplied) await syncStock(o, 'annulee');
      await db.remove('orders', o.id);
      toast('Commande supprimée'); m.close();
    };
  };
  refreshOpen = draw;
  draw();
}

/* ================= Commande manuelle (téléphone, Instagram…) ================= */
function manualOrder() {
  const prods = S.products.filter((p) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const lines = [];
  const m = modal(`<form id="mo"><div class="mhead"><h3>Nouvelle commande manuelle</h3><button type="button" class="ibtn" data-mclose>${I.close}</button></div>
    <div class="mbody">
      <div class="g2"><label class="f"><span>Prénom *</span><input name="firstName" required></label><label class="f"><span>Nom *</span><input name="lastName" required></label></div>
      <div class="g3"><label class="f"><span>Téléphone *</span><input name="phone" required></label>
        <label class="f"><span>Wilaya *</span><select name="wilaya" required><option value="">—</option>${WILAYAS.map((w) => `<option value="${w.code}">${String(w.code).padStart(2, '0')} ${esc(w.name)}</option>`).join('')}</select></label>
        <label class="f"><span>Commune *</span><input name="commune" required></label></div>
      <div class="g3"><label class="f"><span>Livraison</span><select name="dtype"><option value="home">Domicile</option><option value="desk">Stop desk</option></select></label>
        <label class="f span2"><span>Adresse</span><input name="address"></label></div>
      <h4>Articles</h4>
      <div class="add-line"><select id="mp"><option value="">Choisir un produit…</option>${prods.map((p) => `<option value="${p.id}">${esc(p.name)} — ${fmt(p.price)}</option>`).join('')}</select><select id="ms"></select><input id="mq" type="number" min="1" value="1"><button type="button" class="btn ghost sm" id="madd">${I.plus} Ajouter</button></div>
      <div id="mlines" class="olines"></div>
      <div class="g3"><label class="f"><span>Remise (DA)</span><input name="discount" type="number" min="0" value="0"></label><label class="f"><span>Frais de livraison</span><input name="ship" type="number" min="0" placeholder="auto"></label><label class="f"><span>Statut initial</span><select name="status"><option value="confirmee">Confirmée (stock déduit)</option><option value="nouvelle">Nouvelle</option></select></label></div>
      <label class="f"><span>Note</span><input name="notes"></label>
      <div class="totals" id="mtot"></div>
    </div>
    <div class="mfoot"><button type="button" class="btn ghost" data-mclose>Annuler</button><button class="btn primary">Créer la commande</button></div></form>`, { wide: true });
  const f = m.el.querySelector('#mo');
  const mp = f.querySelector('#mp'), ms = f.querySelector('#ms');
  const calc = () => {
    const sub = lines.reduce((a, l) => a + l.price * l.qty, 0);
    const fees = f.wilaya.value ? feesFor(S.settings, Number(f.wilaya.value)) : null;
    const thr = Number(S.settings.freeShippingThreshold) || 0;
    const disc = Math.min(sub, Number(f.discount.value) || 0);
    const auto = fees ? (thr && sub - disc >= thr ? 0 : f.dtype.value === 'desk' ? fees.desk : fees.home) : 0;
    const ship = f.ship.value === '' ? auto : Number(f.ship.value) || 0;
    return { sub, disc, ship, total: sub - disc + ship };
  };
  const drawLines = () => {
    f.querySelector('#mlines').innerHTML = lines.map((l, i) => `<div class="oline"><img src="${productImages(l.p)[0]}" alt=""><div><b>${esc(l.p.name)}</b><small>${esc(l.size)}${l.color ? ' · ' + esc(l.color) : ''}</small></div><span>${l.qty} × ${fmt(l.price)}</span><button type="button" class="ibtn" data-rml="${i}">${I.trash}</button></div>`).join('') || '<p class="muted">Aucun article ajouté.</p>';
    const t = calc();
    f.querySelector('#mtot').innerHTML = `<div><span>Sous-total</span><b>${fmt(t.sub)}</b></div><div><span>Livraison</span><b>${fmt(t.ship)}</b></div>${t.disc ? `<div class="green"><span>Remise</span><b>-${fmt(t.disc)}</b></div>` : ''}<div class="grand"><span>Total</span><b>${fmt(t.total)}</b></div>`;
  };
  mp.onchange = () => { const p = S.products.find((x) => x.id === mp.value); ms.innerHTML = (p?.sizes || []).map((s) => `<option ${s.stock > 0 ? '' : 'disabled'}>${esc(s.label)}</option>`).join(''); };
  f.querySelector('#madd').onclick = () => {
    const p = S.products.find((x) => x.id === mp.value);
    if (!p) return toast('Choisissez un produit', 'err');
    lines.push({ p, size: ms.value, color: p.colors?.[0]?.name || '', qty: Math.max(1, Number(f.querySelector('#mq').value) || 1), price: p.price });
    drawLines();
  };
  f.addEventListener('click', (e) => { const r = e.target.closest('[data-rml]'); if (r) { lines.splice(Number(r.dataset.rml), 1); drawLines(); } });
  f.addEventListener('input', drawLines);
  drawLines();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!phoneOk(f.phone.value)) return toast('Téléphone invalide', 'err');
    if (!lines.length) return toast('Ajoutez au moins un article', 'err');
    const t = calc();
    const now = Date.now();
    const order = {
      id: genOrderCode(), status: 'nouvelle', source: 'telephone', createdAt: now, stockApplied: false,
      customer: { firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), phone: cleanPhone(f.phone.value), phone2: '', wilaya: Number(f.wilaya.value), wilayaName: wilayaName(f.wilaya.value), commune: f.commune.value.trim(), address: f.address.value.trim(), notes: f.notes.value.trim() },
      delivery: { type: f.dtype.value, price: t.ship },
      items: lines.map((l) => ({ productId: l.p.id, name: l.p.name, sku: l.p.sku || '', price: l.price, qty: l.qty, size: l.size, color: l.color, image: l.p.images?.[0] || '' })),
      subtotal: t.sub, discount: t.disc, promoCode: '', total: t.total, history: [{ status: 'nouvelle', at: now, by: S.user?.email || '' }],
    };
    const b = f.querySelector('.mfoot .primary');
    busy(b, true);
    try {
      await db.save('orders', order.id, order);
      if (f.status.value === 'confirmee') await setStatus(order, 'confirmee');
      toast('Commande créée : ' + order.id); m.close();
    } catch (err) { toast(err.message, 'err'); busy(b, false); }
  });
}

/* ================= Export & impression ================= */
function exportCsv(list) {
  if (!list.length) return toast('Rien à exporter', 'err');
  csvDownload(`commandes-belleav-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['N°', 'Date', 'Statut', 'Prénom', 'Nom', 'Téléphone', 'Téléphone 2', 'Wilaya', 'Commune', 'Adresse', 'Type livraison', 'Articles', 'Sous-total', 'Remise', 'Code promo', 'Livraison', 'Total', 'Transporteur', 'N° suivi', 'Note'],
    ...list.map((o) => [o.id, fmtDate(o.createdAt), STATUSES[o.status]?.label, o.customer?.firstName, o.customer?.lastName, o.customer?.phone, o.customer?.phone2, o.customer?.wilayaName, o.customer?.commune, o.customer?.address, o.delivery?.type === 'desk' ? 'Stop desk' : 'Domicile', o.items.map((i) => `${i.qty}x ${i.name} (${[i.color, i.size].filter(Boolean).join('/')})`).join(' | '), o.subtotal, o.discount, o.promoCode, o.delivery?.price, o.total, o.carrier, o.trackingNumber, o.customer?.notes]),
  ]);
}

function printOrders(list) {
  const s = S.settings;
  const w = window.open('', '_blank');
  if (!w) return toast("Autorisez les fenêtres pop-up pour imprimer", 'err');
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bons de commande</title><style>
    body{font:13px/1.45 system-ui,sans-serif;color:#222;margin:0}.bon{padding:28px 34px;page-break-after:always;max-width:780px;margin:auto}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2b2024;padding-bottom:12px;margin-bottom:16px}
    .logo{font:italic 600 30px Georgia,serif}.logo span{color:#9c6b5e}h2{margin:0;font-size:18px}.mono{font-family:ui-monospace,monospace}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.box{border:1px solid #ddd;border-radius:8px;padding:10px 12px}.box b{display:block;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.08em;margin-bottom:4px}
    table{width:100%;border-collapse:collapse}th,td{padding:8px 6px;border-bottom:1px solid #eee;text-align:left}th{font-size:11px;text-transform:uppercase;color:#888}td.n,th.n{text-align:right}
    .tot{margin-left:auto;width:280px;margin-top:10px}.tot div{display:flex;justify-content:space-between;padding:3px 0}.tot .g2{font-size:17px;font-weight:700;border-top:2px solid #222;margin-top:6px;padding-top:8px}
    .cod{margin-top:18px;padding:12px;background:#f6efe9;border-radius:8px;text-align:center;font-size:15px}.ft{margin-top:22px;color:#888;font-size:11px;text-align:center}
    @media print{.noprint{display:none}}</style></head><body>
    <div class="noprint" style="padding:10px;text-align:center;background:#2b2024"><button onclick="print()" style="padding:8px 18px;font-size:14px">Imprimer</button></div>
    ${list.map((o) => `<div class="bon"><div class="hd"><div><div class="logo">Bellea<span>V</span></div><div>${esc(s.phone || '')} · ${esc(s.email || '')}</div></div><div style="text-align:right"><h2>Bon de commande</h2><div class="mono" style="font-size:16px">${esc(o.id)}</div><div>${fmtDate(o.createdAt)}</div></div></div>
      <div class="g"><div class="box"><b>Destinataire</b><div style="font-size:15px;font-weight:600">${esc(o.customer?.firstName)} ${esc(o.customer?.lastName)}</div><div>☎ ${esc(o.customer?.phone)}${o.customer?.phone2 ? ' / ' + esc(o.customer.phone2) : ''}</div></div>
      <div class="box"><b>Livraison ${o.delivery?.type === 'desk' ? '— STOP DESK' : '— DOMICILE'}</b><div style="font-size:15px;font-weight:600">${String(o.customer?.wilaya).padStart(2, '0')} - ${esc(o.customer?.wilayaName)} · ${esc(o.customer?.commune)}</div><div>${esc(o.customer?.address || '')}</div>${o.trackingNumber ? `<div>Suivi : ${esc(o.carrier || '')} ${esc(o.trackingNumber)}</div>` : ''}</div></div>
      <table><thead><tr><th>Article</th><th>Couleur / Taille</th><th class="n">Qté</th><th class="n">P.U.</th><th class="n">Total</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}<br><small class="mono">${esc(i.sku || '')}</small></td><td>${[i.color, i.size].filter(Boolean).map(esc).join(' / ')}</td><td class="n">${i.qty}</td><td class="n">${fmt(i.price)}</td><td class="n">${fmt(i.price * i.qty)}</td></tr>`).join('')}</tbody></table>
      <div class="tot"><div><span>Sous-total</span><span>${fmt(o.subtotal)}</span></div>${o.discount ? `<div><span>Remise</span><span>-${fmt(o.discount)}</span></div>` : ''}<div><span>Livraison</span><span>${fmt(o.delivery?.price || 0)}</span></div><div class="g2"><span>TOTAL</span><span>${fmt(o.total)}</span></div></div>
      <div class="cod">💵 Paiement à la livraison : <b>${fmt(o.total)}</b></div>
      ${o.customer?.notes ? `<p><b>Note :</b> ${esc(o.customer.notes)}</p>` : ''}
      <div class="ft">Merci pour votre confiance ♡ Échange possible sous 7 jours — ${esc(s.storeName || 'BelleaV')}</div></div>`).join('')}
    <script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}
