import * as db from '../db.js';
import { S, markDirty } from '../state.js';
import { esc, toMs, fmtDate } from '../shared/utils.js';
import { I, fmt, toast, modal, confirmBox, busy } from '../ui.js';

export function render(root) {
  const draw = () => {
    const uses = (code) => S.orders.filter((o) => (o.promoCode || '').toUpperCase() === code.toUpperCase());
    root.innerHTML = `<div class="page-head"><div><h2>Codes promo</h2><p class="muted">Les codes sont publiés sous forme chiffrée (SHA-256) : impossibles à lire dans le code de la boutique.</p></div><button class="btn primary" id="prNew">${I.plus} Nouveau code</button></div>
      <div class="card flush"><div class="table-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Réduction</th><th>Minimum d'achat</th><th>Expiration</th><th class="num">Utilisations</th><th class="num">Remises accordées</th><th>Actif</th><th></th></tr></thead><tbody>
      ${S.promos.map((p) => { const u = uses(p.code); const expired = p.expiresAt && toMs(p.expiresAt) < Date.now(); return `<tr class="${p.active === false || expired ? 'is-off' : ''}">
        <td><b class="mono">${esc(p.code)}</b><small>${esc(p.label || '')}</small></td>
        <td><b>${p.type === 'fixed' ? fmt(p.value) : p.value + ' %'}</b></td>
        <td>${p.minTotal ? fmt(p.minTotal) : '—'}</td>
        <td>${p.expiresAt ? `${fmtDate(p.expiresAt, false)}${expired ? ' <span class="chip-st c-red">expiré</span>' : ''}` : 'Jamais'}</td>
        <td class="num">${u.length}</td><td class="num">${fmt(u.reduce((a, o) => a + (o.discount || 0), 0))}</td>
        <td><label class="tog"><input type="checkbox" data-prtog="${p.id}" ${p.active !== false ? 'checked' : ''}><span></span></label></td>
        <td class="actions"><button class="btn ghost sm" data-predit="${p.id}">Modifier</button><button class="ibtn" data-prdel="${p.id}" aria-label="Supprimer">${I.trash}</button></td></tr>`; }).join('') || `<tr><td colspan="8"><div class="empty sm">${I.sparkle}<p>Aucun code promo. Créez-en un pour vos campagnes Instagram, l'Aïd, le Ramadan…</p></div></td></tr>`}
      </tbody></table></div></div>`;
  };
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'prNew') edit(null);
    if (t.dataset.predit) edit(S.promos.find((p) => p.id === t.dataset.predit));
    if (t.dataset.prdel) {
      const p = S.promos.find((x) => x.id === t.dataset.prdel);
      if (!(await confirmBox(`Supprimer le code ${esc(p.code)} ?`, { danger: true, ok: 'Supprimer' }))) return;
      await db.remove('promos', p.id); S.promos = S.promos.filter((x) => x.id !== p.id); toast('Code supprimé'); markDirty(); draw();
    }
  });
  root.addEventListener('change', async (e) => {
    const id = e.target.dataset.prtog; if (!id) return;
    const p = S.promos.find((x) => x.id === id); p.active = e.target.checked;
    await db.patch('promos', id, { active: p.active }); toast(p.active ? 'Code activé' : 'Code désactivé'); markDirty(); draw();
  });
  function edit(pr) {
    const p = pr || { code: '', type: 'percent', value: 10, minTotal: 0, expiresAt: null, label: '', active: true };
    const exp = p.expiresAt ? new Date(toMs(p.expiresAt)).toISOString().slice(0, 10) : '';
    const m = modal(`<form><div class="mhead"><h3>${pr ? 'Modifier le code' : 'Nouveau code promo'}</h3><button type="button" class="ibtn" data-mclose>${I.close}</button></div><div class="mbody">
      <div class="g2"><label class="f"><span>Code *</span><input name="code" value="${esc(p.code)}" required ${pr ? 'readonly' : ''} style="text-transform:uppercase" placeholder="AID2026"></label>
        <label class="f"><span>Type</span><select name="type"><option value="percent" ${p.type !== 'fixed' ? 'selected' : ''}>Pourcentage (%)</option><option value="fixed" ${p.type === 'fixed' ? 'selected' : ''}>Montant fixe (DA)</option></select></label></div>
      <div class="g3"><label class="f"><span>Valeur *</span><input name="value" type="number" min="1" value="${p.value}" required></label><label class="f"><span>Minimum d'achat (DA)</span><input name="minTotal" type="number" min="0" value="${p.minTotal || 0}"></label><label class="f"><span>Expire le</span><input name="expiresAt" type="date" value="${exp}"></label></div>
      <label class="f"><span>Message affiché à la cliente</span><input name="label" value="${esc(p.label || '')}" placeholder="-10 % sur votre commande"></label>
    </div><div class="mfoot"><button type="button" class="btn ghost" data-mclose>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`);
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = f.code.value.trim().toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return toast('Code : 3 à 30 caractères (lettres, chiffres, - _)', 'err');
      if (!pr && S.promos.some((x) => x.code === code)) return toast('Ce code existe déjà', 'err');
      const value = Number(f.value.value);
      if (!(value > 0) || (f.type.value === 'percent' && value > 90)) return toast('Valeur invalide', 'err');
      const doc = { ...p, id: p.id || code, code, type: f.type.value, value, minTotal: Number(f.minTotal.value) || 0, expiresAt: f.expiresAt.value ? new Date(f.expiresAt.value + 'T23:59:59').getTime() : null, label: f.label.value.trim() };
      busy(f.querySelector('.primary'), true);
      await db.save('promos', doc.id, doc);
      const i = S.promos.findIndex((x) => x.id === doc.id);
      if (i >= 0) S.promos[i] = doc; else S.promos.push(doc);
      toast('Code enregistré'); markDirty(); m.close(); draw();
    });
  }
  draw();
  return { on: ['orders'], refresh: draw };
}
