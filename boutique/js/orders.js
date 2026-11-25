// Écritures client vers Firebase : commandes + messages de contact (SDK chargé uniquement au moment de commander)
import { firebaseConfig, CONFIG } from './config.js';
import { readLS, writeLS } from './utils.js';

let fbp = null;
function fb() {
  if (!fbp) {
    fbp = Promise.all([import(`${CONFIG.firebaseSdk}/firebase-app.js`), import(`${CONFIG.firebaseSdk}/firebase-firestore.js`)]).then(([a, fs]) => {
      const app = a.initializeApp(firebaseConfig);
      return { fs, db: fs.getFirestore(app) };
    });
  }
  return fbp;
}
const demoCol = (c) => readLS('bv_db_' + c, {});
const demoSave = (c, v) => writeLS('bv_db_' + c, v);

export async function placeOrder(order) {
  if (!firebaseConfig) {
    const all = demoCol('orders');
    all[order.id] = { ...order, createdAt: Date.now() };
    demoSave('orders', all);
    await new Promise((r) => setTimeout(r, 600));
    return order.id;
  }
  const { fs, db } = await fb();
  await fs.setDoc(fs.doc(db, 'orders', order.id), { ...order, createdAt: fs.serverTimestamp() });
  return order.id;
}

/** Suivi : lecture ponctuelle d'UNE commande, uniquement à la demande de la cliente. */
export async function getOrder(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  if (!firebaseConfig) return demoCol('orders')[code] || null;
  const { fs, db } = await fb();
  try {
    const snap = await fs.getDoc(fs.doc(db, 'orders', code));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function sendMessage(msg) {
  const data = { ...msg, read: false };
  if (!firebaseConfig) {
    const all = demoCol('messages');
    const id = 'm' + Date.now();
    all[id] = { ...data, id, createdAt: Date.now() };
    demoSave('messages', all);
    return;
  }
  const { fs, db } = await fb();
  await fs.addDoc(fs.collection(db, 'messages'), { ...data, createdAt: fs.serverTimestamp() });
}
