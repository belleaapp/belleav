// Composants d'interface génériques : toasts, modale, tiroirs, navigation
import { $, money, esc } from './utils.js';
import { CONFIG } from './config.js';
import { I } from './icons.js';

export const fmt = (n) => money(n, CONFIG.currency);

export function go(path) {
  if (location.hash === '#' + path) window.dispatchEvent(new Event('route'));
  else location.hash = path;
}
export function setParams(params, base = '/boutique') {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
  history.replaceState(null, '', '#' + base + (qs ? '?' + qs : ''));
  window.dispatchEvent(new Event('route'));
}

export function toast(msg, { type = 'ok', action, href, ms = 3200 } = {}) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast-ic">${type === 'ok' ? I.check : I.close}</span><span>${esc(msg)}</span>${action ? `<a href="${href}" class="toast-act">${esc(action)}</a>` : ''}`;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

let lastFocus = null;
export function openPanel(id) {
  closeAll(false);
  lastFocus = document.activeElement;
  $('#' + id).classList.add('open');
  $('#overlay').classList.add('show');
  document.body.classList.add('lock');
  setTimeout(() => $('#' + id).querySelector('input,button,a')?.focus({ preventScroll: true }), 50);
}
export function closeAll(restore = true) {
  document.querySelectorAll('.drawer.open,.search-panel.open,.modal.open').forEach((e) => e.classList.remove('open'));
  $('#overlay').classList.remove('show');
  document.body.classList.remove('lock');
  if (restore && lastFocus) lastFocus.focus?.({ preventScroll: true });
}

export function openModal(html, onMount, cls = '') {
  const m = $('#modal');
  m.className = 'modal ' + cls;
  m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><button class="modal-x icon-btn" data-close aria-label="Fermer">${I.close}</button>${html}</div>`;
  openPanel('modal');
  onMount?.(m.querySelector('.modal-box'));
}
