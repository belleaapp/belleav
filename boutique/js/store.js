// État local du client : panier, favoris, consultés récemment, infos client (aucune lecture Firebase)
import { readLS, writeLS } from './utils.js';

export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));

const key = (id, size, color) => `${id}|${size || ''}|${color || ''}`;

export const cart = {
  items: readLS('bv_cart', []),
  save() { writeLS('bv_cart', this.items); emit('cart'); },
  add(productId, size, color, qty = 1, max = 99) {
    const k = key(productId, size, color);
    const it = this.items.find((i) => i.key === k);
    if (it) it.qty = Math.min(max, it.qty + qty);
    else this.items.push({ key: k, productId, size, color, qty: Math.min(max, qty), addedAt: Date.now() });
    this.save();
  },
  setQty(k, qty) {
    const it = this.items.find((i) => i.key === k);
    if (!it) return;
    if (qty <= 0) this.items = this.items.filter((i) => i.key !== k);
    else it.qty = qty;
    this.save();
  },
  remove(k) { this.items = this.items.filter((i) => i.key !== k); this.save(); },
  clear() { this.items = []; this.save(); },
  count() { return this.items.reduce((a, i) => a + i.qty, 0); },
};

export const wishlist = {
  ids: readLS('bv_wish', []),
  has(id) { return this.ids.includes(id); },
  toggle(id) {
    this.ids = this.has(id) ? this.ids.filter((x) => x !== id) : [id, ...this.ids];
    writeLS('bv_wish', this.ids);
    emit('wish');
    return this.has(id);
  },
};

export const recent = {
  ids: readLS('bv_recent', []),
  push(id) { this.ids = [id, ...this.ids.filter((x) => x !== id)].slice(0, 12); writeLS('bv_recent', this.ids); },
};

export const searches = {
  list: readLS('bv_searches', []),
  push(q) { q = q.trim(); if (q.length < 2) return; this.list = [q, ...this.list.filter((x) => x !== q)].slice(0, 6); writeLS('bv_searches', this.list); },
  clear() { this.list = []; writeLS('bv_searches', []); },
};

export const customer = {
  get() { return readLS('bv_customer', {}); },
  set(c) { writeLS('bv_customer', c); },
  orders() { return readLS('bv_my_orders', []); },
  addOrder(o) { writeLS('bv_my_orders', [o, ...this.orders()].slice(0, 20)); },
};
