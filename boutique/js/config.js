// ⚙️ Configuration de la boutique BelleaV
// 1) Console Firebase > Paramètres du projet > Vos applications > Application Web > "Config"
// 2) Collez l'objet ci-dessous (le même que dans admin/js/config.js).
// Tant que firebaseConfig vaut null, la boutique tourne en MODE DÉMO :
//    catalogue local (data/catalog.json) + commandes stockées dans le navigateur.
export const firebaseConfig = null;
/* Exemple :
export const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "belleav-xxxx.firebaseapp.com",
  projectId: "belleav-xxxx",
  storageBucket: "belleav-xxxx.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxx"
};
*/

export const CONFIG = {
  // URL du catalogue publié. null = automatique : Firebase Storage "catalog/catalog.js" (publié depuis l'admin).
  // Alternative sans Storage : 'data/catalog.json' (exporté depuis l'admin puis redéployé).
  catalogUrl: null,
  firebaseSdk: 'https://www.gstatic.com/firebasejs/10.12.2',
  pageSize: 24,
  currency: 'DA',
};
