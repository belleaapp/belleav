// BelleaV Admin — authentification, structure, navigation, temps réel
import * as db from './db.js';
import { S, loadAll, subscribe, notify, publish, isDirty, isPublishing } from './state.js';
import { $, $$, esc, timeAgo, toMs, norm, fmtDate } from './shared/utils.js';
import { I, toast, chime, fmt, statusChip, busy } from './ui.js';
import { SHOP_URL } from './config.js';

const VIEWS = {
  dashboard: { title: 'Tableau de bord', icon: I.grid, load: () => import('./views/dashboard.js') },
  orders: { title: 'Commandes', icon: I.box, load: () => import('./views/orders.js') },
  products: { title: 'Produits', icon: I.tag, load: () => import('./views/products.js') },
  categories: { title: 'Catégories', icon: I.filter, load: () => import('./views/categories.js') },
  customers: { title: 'Clientes', icon: I.user, load: () => import('./views/customers.js') },
  promos: { title: 'Codes promo', icon: I.sparkle, load: () => import('./views/promos.js') },
  messages: { title: 'Messages', icon: I.mail, load: () => import('./views/messages.js') },
  settings: { title: 'Paramètres', icon: I.shield, load: () => import('./views/settings.js') },
};

/* ================= Connexion ================= */
function showLogin(msg = '') {
  document.body.className = 'is-login';
  $('#root').innerHTML = `<div class="login">
    <div class="login-art"><div><div class="brand big">Bellea<span>V</span></div><p>Espace de gestion</p><ul><li>${I.box} Commandes en temps réel</li><li>${I.tag} Catalogue, stocks & photos</li><li>${I.sparkle} Publication instantanée sur la boutique</li></ul></div></div>
    <form class="login-form" id="loginForm">
      <div class="brand only-sm">Bellea<span>V</span></div>
      <h1>Connexion</h1><p class="muted">Accès réservé à l'équipe BelleaV</p>
      ${db.isDemo ? `<div class="note">${I.sparkle}<div><b>Mode démo</b> (Firebase non configuré)<br>E-mail : <code>admin@belleav.dz</code> · Mot de passe : <code>admin123</code></div></div>` : ''}
      ${msg ? `<div class="note err">${msg}</div>` : ''}
      <label class="f"><span>E-mail</span><input name="email" type="email" autocomplete="username" required ${db.isDemo ? 'value="admin@belleav.dz"' : ''}></label>
      <label class="f"><span>Mot de passe</span><div class="pw"><input name="pw" type="password" autocomplete="current-password" required><button type="button" class="ibtn" id="togglePw" aria-label="Afficher">${I.eye}</button></div></label>
      <button class="btn primary block lg">Se connecter</button>
      ${db.isDemo ? '' : '<button type="button" class="link" id="forgot">Mot de passe oublié ?</button>'}
    </form></div>`;
  const f = $('#loginForm');
  $('#togglePw').onclick = () => (f.pw.type = f.pw.type === 'password' ? 'text' : 'password');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = f.querySelector('.btn');
    busy(b, true, 'Connexion…');
    try { await db.authApi.login(f.email.value, f.pw.value); }
    catch (err) {
      busy(b, false);
      const c = String(err.code || err.message);
      toast(c.includes('invalid') || c.includes('wrong') || c.includes('user-not-found') ? 'E-mail ou mot de passe incorrect' : c.includes('too-many') ? 'Trop de tentatives, réessayez plus tard' : 'Connexion impossible : ' + c, 'err', 5000);
    }
  });
  $('#forgot')?.addEventListener('click', async () => {
    if (!f.email.value) return toast("Saisissez d'abord votre e-mail", 'err');
    try { await db.authApi.reset(f.email.value); toast('E-mail de réinitialisation envoyé'); } catch (e) { toast(e.message, 'err'); }
  });
}

function showNotAdmin(user) {
  document.body.className = 'is-login';
  $('#root').innerHTML = `<div class="login"><div class="login-form wide"><div class="brand">Bellea<span>V</span></div>
    <h1>Accès non autorisé</h1><p>Le compte <b>${esc(user.email)}</b> est bien connecté, mais il n'est pas encore déclaré administrateur.</p>
    <div class="note"><div>Dans la console Firebase → Firestore, créez la collection <code>admins</code> avec un document dont l'ID est :<br><code class="copy" id="uidc">${esc(user.uid)}</code><br>(contenu libre, ex. <code>{ "email": "${esc(user.email)}" }</code>), puis rechargez cette page.</div></div>
    <div class="row-btns"><button class="btn primary" onclick="location.reload()">J'ai ajouté le document, recharger</button><button class="btn ghost" id="lo">Se déconnecter</button></div></div></div>`;
  $('#lo').onclick = () => db.authApi.logout();
  $('#uidc').onclick = () => navigator.clipboard?.writeText(user.uid).then(() => toast('UID copié'));
}

/* ================= Structure ================= */
function shell() {
  document.body.className = '';
  $('#root').innerHTML = `
  <aside class="side" id="side">
    <div class="side-top"><a href="#/dashboard" class="brand">Bellea<span>V</span></a><span class="tag-admin">Admin</span></div>
    <nav class="side-nav">${Object.entries(VIEWS).map(([k, v]) => `<a href="#/${k}" data-view="${k}">${v.icon}<span>${v.title}</span><b class="nbadge" data-badge="${k}"></b></a>`).join('')}</nav>
    <div class="side-foot">
      <a href="${SHOP_URL}" target="_blank" rel="noopener" class="side-shop">${I.bag}<span>Voir la boutique</span></a>
      <div class="me"><span class="avatar">${esc((S.user.email || '?')[0].toUpperCase())}</span><div><b>${esc(S.user.email)}</b><small>${db.isDemo ? 'Mode démo' : 'Administrateur'}</small></div><button class="ibtn" id="logout" title="Se déconnecter" aria-label="Se déconnecter">${I.chevron}</button></div>
    </div>
  </aside>
  <div class="side-bg" id="sideBg"></div>
  <div class="main">
    <header class="top">
      <button class="ibtn only-sm" id="burger" aria-label="Menu">${I.menu}</button>
      <h1 id="pageTitle"></h1>
      <div class="gsearch"><span>${I.search}</span><input id="gq" placeholder="Rechercher commande, cliente, produit…  ( / )" autocomplete="off"><div class="gres" id="gres"></div></div>
      <div class="pub" id="pub"></div>
    </header>
    ${db.isDemo ? `<div class="demo-bar">${I.sparkle} <b>Mode démo</b> — les données sont stockées dans ce navigateur. Les commandes passées sur la boutique (même navigateur) apparaissent ici en temps réel. Renseignez <code>js/config.js</code> pour passer sur Firebase.</div>` : ''}
    <main class="content" id="content"></main>
  </div>`;
  $('#logout').onclick = () => db.authApi.logout();
  $('#burger').onclick = () => document.body.classList.add('side-open');
  $('#sideBg').onclick = () => document.body.classList.remove('side-open');
  bindSearch();
  drawPub();
  drawBadges();
}

function drawPub() {
  const el = $('#pub');
  if (!el) return;
  const dirty = isDirty();
  const pubbing = isPublishing();
  el.innerHTML = `<span class="pub-state ${pubbing ? 'busy' : dirty ? 'dirty' : 'ok'}" title="${S.meta.publishedAt ? 'Dernière publication : ' + fmtDate(S.meta.publishedAt) : 'Jamais publié'}">
      <i></i>${pubbing ? 'Publication…' : dirty ? 'Modifications non publiées' : 'Boutique à jour'}<small>${S.meta.publishedAt ? timeAgo(S.meta.publishedAt) : ''}</small></span>
    <button class="btn ${dirty ? 'primary' : 'ghost'} sm" id="pubBtn" ${pubbing ? 'disabled' : ''}>${I.refresh}<span>Publier</span></button>`;
  $('#pubBtn').onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await publish(); } catch (err) { toast('Échec de la publication : ' + err.message, 'err', 7000); console.error(err); }
  };
}

function drawBadges() {
  const n = S.orders.filter((o) => o.status === 'nouvelle').length;
  const m = S.messages.filter((x) => !x.read).length;
  const set = (k, v) => $$(`[data-badge="${k}"]`).forEach((b) => { b.textContent = v || ''; b.classList.toggle('show', v > 0); });
  set('orders', n);
  set('messages', m);
  document.title = (n ? `(${n}) ` : '') + 'BelleaV Admin';
}

/* ----- Recherche globale ----- */
function bindSearch() {
  const q = $('#gq'), res = $('#gres');
  const run = () => {
    const t = norm(q.value);
    if (t.length < 2) { res.classList.remove('open'); return; }
    const orders = S.orders.filter((o) => norm(`${o.id} ${o.customer?.firstName} ${o.customer?.lastName} ${o.customer?.phone} ${o.customer?.wilayaName}`).includes(t)).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 5);
    const prods = S.products.filter((p) => norm(`${p.name} ${p.sku}`).includes(t)).slice(0, 5);
    res.innerHTML = (orders.length ? `<h6>Commandes</h6>${orders.map((o) => `<a href="#/orders?open=${encodeURIComponent(o.id)}"><b>${esc(o.id)}</b><span>${esc(o.customer?.firstName)} ${esc(o.customer?.lastName)} · ${fmt(o.total)}</span>${statusChip(o.status)}</a>`).join('')}` : '')
      + (prods.length ? `<h6>Produits</h6>${prods.map((p) => `<a href="#/products?edit=${p.id}"><b>${esc(p.name)}</b><span>${esc(p.sku || '')} · ${fmt(p.price)}</span></a>`).join('')}` : '')
      || '<p class="muted pad">Aucun résultat</p>';
    res.classList.add('open');
  };
  q.addEventListener('input', run);
  q.addEventListener('focus', run);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') res.querySelector('a')?.click(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.gsearch')) res.classList.remove('open'); if (e.target.closest('.gres a')) { res.classList.remove('open'); q.value = ''; } });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } });
}

/* ================= Routeur ================= */
let current = { name: null, cleanup: null, mod: null };
function parse() {
  const [path, qs] = (location.hash.slice(2) || 'dashboard').split('?');
  return { name: VIEWS[path] ? path : 'dashboard', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
async function route() {
  if (!S.user) return;
  const { name, params } = parse();
  document.body.classList.remove('side-open');
  $$('.side-nav a').forEach((a) => a.classList.toggle('on', a.dataset.view === name));
  $('#pageTitle').textContent = VIEWS[name].title;
  if (current.name === name && current.mod?.update) { current.mod.update(params); return; }
  current.cleanup?.();
  const content = $('#content');
  content.innerHTML = '<div class="loading"><span class="spin"></span></div>';
  try {
    const mod = await VIEWS[name].load();
    const inst = mod.render(content, params) || {};
    current = { name, cleanup: inst.cleanup, mod: inst };
    content.scrollTop = 0; window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    content.innerHTML = `<div class="empty">${I.close}<h3>Erreur de chargement</h3><p>${esc(e.message)}</p></div>`;
  }
}

/* ================= Temps réel ================= */
let unsub = [];
function startRealtime() {
  let first = true;
  const known = new Set();
  unsub.push(db.watch('orders', (orders) => {
    const fresh = orders.filter((o) => o.status === 'nouvelle' && !known.has(o.id));
    orders.forEach((o) => known.add(o.id));
    S.orders = orders.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    if (!first && fresh.length) {
      const o = fresh[0];
      toast(`🛍️ Nouvelle commande ${o.id} — ${o.customer?.firstName || ''} · ${fmt(o.total)}`, 'ok', 6000);
      if (S.prefs.sound) chime();
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('Nouvelle commande BelleaV', { body: `${o.customer?.firstName} ${o.customer?.lastName} — ${fmt(o.total)}`, icon: SHOP_URL + 'icons/icon-192.png' });
    }
    first = false;
    drawBadges();
    notify('orders');
  }));
  unsub.push(db.watch('messages', (msgs) => {
    S.messages = msgs.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    drawBadges();
    notify('messages');
  }));
}

subscribe((what) => {
  if (what === 'meta' || what === 'publishing') drawPub();
  if (current.mod?.refresh && current.mod.on?.includes(what)) current.mod.refresh();
});
setInterval(drawPub, 60000);

/* ================= Démarrage ================= */
(async function boot() {
  try { await db.init(); } catch (e) {
    $('#root').innerHTML = `<div class="login"><div class="login-form"><h1>Firebase injoignable</h1><p>${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Réessayer</button></div></div>`;
    return;
  }
  db.authApi.onChange(async (user) => {
    unsub.forEach((f) => f()); unsub = [];
    current.cleanup?.(); current = { name: null };
    if (!user) { S.user = null; return showLogin(); }
    if (!(await db.authApi.isAdmin(user.uid))) return showNotAdmin(user);
    S.user = user;
    $('#root').innerHTML = '<div class="loading full"><span class="spin"></span><p>Chargement des données…</p></div>';
    try { await loadAll(); } catch (e) {
      console.error(e);
      return showLogin('Lecture des données refusée. Vérifiez les règles Firestore (firestore.rules) et le document admins/' + esc(user.uid) + '.');
    }
    shell();
    startRealtime();
    route();
    if ('Notification' in window && Notification.permission === 'default') setTimeout(() => Notification.requestPermission(), 4000);
  });
  window.addEventListener('hashchange', route);
})();
