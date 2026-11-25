import * as db from '../db.js';
import { S } from '../state.js';
import { esc, fmtDate, timeAgo, phoneIntl } from '../shared/utils.js';
import { I, toast, confirmBox } from '../ui.js';

let filter = 'all';
let openId = null;

export function render(root) {
  const draw = () => {
    const list = S.messages.filter((m) => filter === 'all' || !m.read);
    const cur = S.messages.find((m) => m.id === openId);
    root.innerHTML = `<div class="page-head"><div><h2>Messages</h2><p class="muted">Formulaire de contact de la boutique</p></div>
      <div class="seg"><button data-f="all" class="${filter === 'all' ? 'on' : ''}">Tous (${S.messages.length})</button><button data-f="unread" class="${filter === 'unread' ? 'on' : ''}">Non lus (${S.messages.filter((m) => !m.read).length})</button></div></div>
      <div class="inbox card flush">
        <div class="inbox-list">${list.map((m) => `<button class="msg ${m.read ? '' : 'unread'} ${m.id === openId ? 'on' : ''}" data-open="${m.id}"><b>${esc(m.name)}</b><span>${esc(m.subject || '')}</span><small>${esc((m.message || '').slice(0, 80))}</small><em>${timeAgo(m.createdAt)}</em></button>`).join('') || `<div class="empty sm">${I.mail}<p>Aucun message.</p></div>`}</div>
        <div class="inbox-read">${cur ? `<div class="msg-head"><div><h3>${esc(cur.name)}</h3><small class="muted">${esc(cur.phone)} · ${fmtDate(cur.createdAt)}</small></div><span class="chip-st c-grey">${esc(cur.subject || '')}</span></div>
          <div class="msg-body">${esc(cur.message).replace(/\n/g, '<br>')}</div>
          <div class="row-btns wrap"><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${phoneIntl(cur.phone)}?text=${encodeURIComponent(`Bonjour ${cur.name}, merci pour votre message à BelleaV. `)}">${I.whatsapp} Répondre sur WhatsApp</a><a class="btn ghost" href="tel:${esc(cur.phone)}">${I.phone} Appeler</a>
          <button class="btn ghost" data-unread="${cur.id}">Marquer non lu</button><button class="btn ghost danger-t" data-del="${cur.id}">${I.trash} Supprimer</button></div>` : `<div class="empty">${I.mail}<p>Sélectionnez un message</p></div>`}</div>
      </div>`;
  };
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.f) { filter = t.dataset.f; draw(); }
    if (t.dataset.open) {
      openId = t.dataset.open;
      const m = S.messages.find((x) => x.id === openId);
      if (m && !m.read) { m.read = true; db.patch('messages', m.id, { read: true }); }
      draw();
    }
    if (t.dataset.unread) { const m = S.messages.find((x) => x.id === t.dataset.unread); m.read = false; await db.patch('messages', m.id, { read: false }); openId = null; draw(); }
    if (t.dataset.del) { if (!(await confirmBox('Supprimer ce message ?', { danger: true, ok: 'Supprimer' }))) return; await db.remove('messages', t.dataset.del); openId = null; toast('Message supprimé'); }
  });
  draw();
  return { on: ['messages'], refresh: draw };
}
