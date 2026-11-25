// Outils d'interface de l'admin
import { $, esc, money, debounce } from './shared/utils.js';
import { I } from './shared/icons.js';
import { CURRENCY } from './config.js';

export const fmt = (n) => money(n, CURRENCY);
export { I };

export const STATUSES = {
  nouvelle: { label: 'Nouvelle', color: 'blue' },
  confirmee: { label: 'Confirmée', color: 'teal' },
  preparation: { label: 'En préparation', color: 'amber' },
  expediee: { label: 'Expédiée', color: 'violet' },
  livree: { label: 'Livrée', color: 'green' },
  annulee: { label: 'Annulée', color: 'red' },
  retournee: { label: 'Retournée', color: 'red' },
};
export const FLOW = ['nouvelle', 'confirmee', 'preparation', 'expediee', 'livree'];
export const statusChip = (s) => `<span class="chip-st c-${STATUSES[s]?.color || 'grey'}">${STATUSES[s]?.label || esc(s)}</span>`;

export function toast(msg, type = 'ok', ms = 3000) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span>${type === 'err' ? I.close : I.check}</span>${esc(msg)}`;
  $('#toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

/* ----- Modale & panneau latéral ----- */
let stack = [];
export function modal(html, { wide = false, side = false, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'mwrap' + (side ? ' mside' : '');
  wrap.innerHTML = `<div class="mbg" data-mclose></div><div class="mbox ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('lock');
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    stack = stack.filter((x) => x !== api);
    if (!stack.length) document.body.classList.remove('lock');
    setTimeout(() => wrap.remove(), 250);
    onClose?.();
  };
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-mclose]')) close(); });
  const api = { el: wrap.querySelector('.mbox'), close };
  stack.push(api);
  setTimeout(() => api.el.querySelector('[autofocus],input:not([type=hidden]):not([type=checkbox]),select,textarea')?.focus(), 80);
  return api;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length && !e.target.closest?.('.no-esc')) stack[stack.length - 1].close(); });

export function confirmBox(message, { ok = 'Confirmer', danger = false, title = 'Confirmation' } = {}) {
  return new Promise((res) => {
    let done = false;
    const m = modal(`<div class="mhead"><h3>${esc(title)}</h3></div><div class="mbody"><p>${message}</p></div>
      <div class="mfoot"><button class="btn ghost" data-mclose>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok autofocus>${esc(ok)}</button></div>`,
      { onClose: () => { if (!done) res(false); } });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { done = true; res(true); m.close(); });
  });
}

export function promptBox(label, value = '', { title = 'Saisie', type = 'text' } = {}) {
  return new Promise((res) => {
    let done = false;
    const m = modal(`<form><div class="mhead"><h3>${esc(title)}</h3></div><div class="mbody"><label class="f"><span>${esc(label)}</span><input type="${type}" name="v" value="${esc(value)}" autofocus></label></div>
      <div class="mfoot"><button type="button" class="btn ghost" data-mclose>Annuler</button><button class="btn primary">Valider</button></div></form>`, { onClose: () => { if (!done) res(null); } });
    m.el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); done = true; res(e.target.v.value); m.close(); });
  });
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.txt = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${label ? ' ' + esc(label) : ''}`; }
  else { btn.disabled = false; if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt; }
}

export function csvDownload(name, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(name, '﻿' + csv, 'text/csv;charset=utf-8');
}
export function download(name, content, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Petit signal sonore pour les nouvelles commandes */
export function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.4);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.45);
    });
  } catch {}
}

/** Pagination simple */
export function pager(total, page, per) {
  const pages = Math.max(1, Math.ceil(total / per));
  if (pages <= 1) return '';
  const btn = (p, l = p) => `<button class="pg ${p === page ? 'on' : ''}" data-page="${p}" ${p < 1 || p > pages ? 'disabled' : ''}>${l}</button>`;
  const nums = [];
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
  return `<div class="pager">${btn(page - 1, '‹')}${nums.map((n) => (n === '…' ? '<span>…</span>' : btn(n))).join('')}${btn(page + 1, '›')}<em>${total} résultats</em></div>`;
}

export const sortIcon = (key, sort) => (sort.key === key ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
export { debounce };
