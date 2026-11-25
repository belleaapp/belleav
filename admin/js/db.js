// Couche d'accès aux données : Firebase (production) ou navigateur (mode démo).
// Toutes les vues passent par ce module : changer de backend ne touche rien d'autre.
import { firebaseConfig, SDK } from './config.js';
import { readLS, writeLS } from './shared/utils.js';

export const isDemo = !firebaseConfig;
let A, FS, ST, app, auth, fdb, storage;
const clean = (o) => JSON.parse(JSON.stringify(o ?? null)); // Firestore refuse "undefined"

/* ================= Initialisation ================= */
export async function init() {
  if (isDemo) {
    if (!localStorage.getItem('bv_db_products')) await seedDemo();
    return;
  }
  const [a, au, fs, st] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`), import(`${SDK}/firebase-storage.js`),
  ]);
  A = au; FS = fs; ST = st;
  app = a.initializeApp(firebaseConfig);
  auth = au.getAuth(app);
  fdb = fs.getFirestore(app);
  storage = st.getStorage(app);
}

export async function loadSeed() {
  return (await fetch('data/seed.json', { cache: 'no-cache' })).json();
}
async function seedDemo() {
  const s = await loadSeed();
  const toMap = (arr) => Object.fromEntries(arr.map((d) => [d.id, d]));
  writeLS('bv_db_products', toMap(s.products));
  writeLS('bv_db_categories', toMap(s.categories));
  writeLS('bv_db_promos', toMap(s.promos));
  writeLS('bv_db_settings', { main: { id: 'main', ...s.settings } });
  if (!localStorage.getItem('bv_db_orders')) writeLS('bv_db_orders', demoOrders(s.products));
}
function demoOrders(products) {
  const names = [['Amina', 'Benali'], ['Sarah', 'Khelifi'], ['Yasmine', 'Boudiaf'], ['Lina', 'Hamidi'], ['Meriem', 'Saadi'], ['Imane', 'Rahmani'], ['Nour', 'Belkacem'], ['Kenza', 'Mansouri'], ['Rania', 'Ziani'], ['Selma', 'Cherif'], ['Hiba', 'Taleb'], ['Asma', 'Ouali']];
  const wil = [[16, 'Alger'], [31, 'Oran'], [25, 'Constantine'], [9, 'Blida'], [19, 'Sétif'], [6, 'Béjaïa'], [15, 'Tizi Ouzou'], [35, 'Boumerdès'], [23, 'Annaba'], [30, 'Ouargla']];
  const st = ['livree', 'livree', 'livree', 'livree', 'expediee', 'confirmee', 'preparation', 'annulee', 'nouvelle', 'nouvelle', 'retournee', 'livree'];
  const out = {};
  let seed = 3;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    const n = names[Math.floor(r() * names.length)];
    const w = wil[Math.floor(r() * wil.length)];
    const items = Array.from({ length: 1 + Math.floor(r() * 3) }, () => {
      const p = products[Math.floor(r() * products.length)];
      return { productId: p.id, name: p.name, sku: p.sku, price: p.price, qty: 1 + Math.floor(r() * 2), size: p.sizes[0].label, color: p.colors[0]?.name || '', image: '' };
    });
    const sub = items.reduce((a, x) => a + x.price * x.qty, 0);
    const ship = sub >= 15000 ? 0 : w[0] === 16 ? 400 : 700;
    const status = i < 3 ? 'nouvelle' : st[Math.floor(r() * st.length)];
    const at = Date.now() - Math.floor(i * 0.65 * 864e5 + r() * 864e5 * 0.5);
    const id = 'BV-DEMO' + String(i).padStart(3, '0');
    const phone = '05' + String(50000000 + Math.floor(r() * 49999999)).slice(0, 8);
    out[id] = {
      id, status, source: 'site', createdAt: at, stockApplied: status !== 'nouvelle' && status !== 'annulee',
      customer: { firstName: n[0], lastName: n[1], phone, phone2: '', wilaya: w[0], wilayaName: w[1], commune: 'Centre', address: 'Cité 120 logements, bât. ' + (i % 9 + 1), notes: '' },
      delivery: { type: r() > 0.6 ? 'desk' : 'home', price: ship },
      items, subtotal: sub, discount: 0, promoCode: '', total: sub + ship,
      history: [{ status: 'nouvelle', at }, ...(status !== 'nouvelle' ? [{ status, at: at + 864e5 }] : [])],
    };
  }
  return out;
}

/* ================= Authentification ================= */
const listeners = new Set();
export const authApi = {
  onChange(cb) {
    if (isDemo) {
      const u = JSON.parse(sessionStorage.getItem('bv_admin_session') || 'null');
      setTimeout(() => cb(u), 0);
      listeners.add(cb);
      return;
    }
    A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
  },
  async login(email, pw) {
    if (isDemo) {
      if (email.trim().toLowerCase() !== 'admin@belleav.dz' || pw !== 'admin123') throw new Error('auth/invalid-credential');
      const u = { uid: 'demo-admin', email: 'admin@belleav.dz' };
      sessionStorage.setItem('bv_admin_session', JSON.stringify(u));
      listeners.forEach((cb) => cb(u));
      return;
    }
    await A.setPersistence(auth, A.browserLocalPersistence);
    await A.signInWithEmailAndPassword(auth, email.trim(), pw);
  },
  async logout() {
    if (isDemo) { sessionStorage.removeItem('bv_admin_session'); listeners.forEach((cb) => cb(null)); return; }
    await A.signOut(auth);
  },
  async reset(email) {
    if (isDemo) return;
    await A.sendPasswordResetEmail(auth, email.trim());
  },
  async isAdmin(uid) {
    if (isDemo) return true;
    try { return (await FS.getDoc(FS.doc(fdb, 'admins', uid))).exists(); } catch { return false; }
  },
};

/* ================= CRUD ================= */
const bus = new EventTarget();
const lsCol = (c) => readLS('bv_db_' + c, {});
const lsSave = (c, m) => {
  if (!writeLS('bv_db_' + c, m)) throw new Error('Stockage du navigateur plein (mode démo). Réduisez le nombre/poids des photos.');
  bus.dispatchEvent(new CustomEvent(c));
};
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function list(col) {
  if (isDemo) return Object.values(lsCol(col));
  const snap = await FS.getDocs(FS.collection(fdb, col));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}
export async function get(col, id) {
  if (isDemo) return lsCol(col)[id] || null;
  const s = await FS.getDoc(FS.doc(fdb, col, id));
  return s.exists() ? { ...s.data(), id: s.id } : null;
}
/** Crée ou remplace un document. Retourne son id. */
export async function save(col, id, data) {
  id = id || newId();
  const doc = clean({ ...data, id });
  if (isDemo) { const m = lsCol(col); m[id] = doc; lsSave(col, m); return id; }
  await FS.setDoc(FS.doc(fdb, col, id), doc);
  return id;
}
export async function patch(col, id, data) {
  if (isDemo) { const m = lsCol(col); m[id] = { ...m[id], ...clean(data) }; lsSave(col, m); return; }
  await FS.updateDoc(FS.doc(fdb, col, id), clean(data));
}
export async function remove(col, id) {
  if (isDemo) { const m = lsCol(col); delete m[id]; lsSave(col, m); return; }
  await FS.deleteDoc(FS.doc(fdb, col, id));
}
export async function saveMany(col, docs) {
  if (isDemo) { const m = lsCol(col); docs.forEach((d) => (m[d.id] = clean(d))); lsSave(col, m); return; }
  for (let i = 0; i < docs.length; i += 400) {
    const b = FS.writeBatch(fdb);
    docs.slice(i, i + 400).forEach((d) => b.set(FS.doc(fdb, col, d.id), clean(d)));
    await b.commit();
  }
}
export async function removeMany(col, ids) {
  if (isDemo) { const m = lsCol(col); ids.forEach((id) => delete m[id]); lsSave(col, m); return; }
  for (let i = 0; i < ids.length; i += 400) {
    const b = FS.writeBatch(fdb);
    ids.slice(i, i + 400).forEach((id) => b.delete(FS.doc(fdb, col, id)));
    await b.commit();
  }
}

/** Écoute temps réel d'une collection (commandes, messages). */
export function watch(col, cb) {
  if (isDemo) {
    const fire = () => cb(Object.values(lsCol(col)));
    fire();
    const onStorage = (e) => { if (e.key === 'bv_db_' + col) fire(); };
    window.addEventListener('storage', onStorage);
    bus.addEventListener(col, fire);
    const poll = setInterval(fire, 15000);
    return () => { window.removeEventListener('storage', onStorage); bus.removeEventListener(col, fire); clearInterval(poll); };
  }
  return FS.onSnapshot(FS.collection(fdb, col), (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), (e) => console.error('watch', col, e));
}

/** Modifie un produit de façon atomique (gestion du stock). */
export async function updateProduct(id, fn) {
  if (isDemo) {
    const m = lsCol('products');
    if (!m[id]) return null;
    m[id] = fn(structuredClone(m[id]));
    lsSave('products', m);
    return m[id];
  }
  return FS.runTransaction(fdb, async (tx) => {
    const ref = FS.doc(fdb, 'products', id);
    const s = await tx.get(ref);
    if (!s.exists()) return null;
    const next = clean(fn({ ...s.data(), id }));
    tx.set(ref, next);
    return next;
  });
}

/* ================= Fichiers ================= */
export async function compressImage(file, max = isDemo ? 900 : 1500, q = isDemo ? 0.72 : 0.85) {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/webp', q));
}
export async function uploadImage(file, folder = 'products') {
  const blob = await compressImage(file);
  if (isDemo) return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const r = ST.ref(storage, path);
  await ST.uploadBytes(r, blob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' });
  return ST.getDownloadURL(r);
}
export async function deleteImage(url) {
  if (isDemo || !url || !url.includes('firebasestorage')) return;
  try { await ST.deleteObject(ST.ref(storage, url)); } catch (e) { console.warn('suppression image', e.code); }
}

/** Publie le catalogue public. La boutique le lit SANS aucune requête Firestore. */
export async function publishCatalog(catalog) {
  const json = JSON.stringify(catalog);
  if (isDemo) {
    if (!writeLS('bv_demo_catalog', catalog)) throw new Error('Stockage du navigateur plein');
    localStorage.removeItem('bv_catalog_cache');
    return;
  }
  const meta = { cacheControl: 'no-cache' };
  await Promise.all([
    ST.uploadString(ST.ref(storage, 'catalog/catalog.js'), `window.__BELLEAV_CATALOG__=${json};`, 'raw', { ...meta, contentType: 'application/javascript; charset=utf-8' }),
    ST.uploadString(ST.ref(storage, 'catalog/catalog.json'), json, 'raw', { ...meta, contentType: 'application/json; charset=utf-8' }),
  ]);
}
