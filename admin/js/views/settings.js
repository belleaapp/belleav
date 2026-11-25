import * as db from '../db.js';
import { S, markDirty, publish, savePrefs, loadAll } from '../state.js';
import { esc } from '../shared/utils.js';
import { WILAYAS, defaultFees, feesFor } from '../shared/wilayas.js';
import { buildCatalog } from '../catalog-builder.js';
import { I, toast, confirmBox, busy, download } from '../ui.js';

const TABS = [['store', 'Boutique'], ['home', "Page d'accueil"], ['delivery', 'Livraison'], ['pages', 'Pages & textes'], ['data', 'Données & sauvegarde'], ['prefs', 'Préférences']];
const PAGES = { livraison: 'Livraison', retours: 'Retours & échanges', 'guide-tailles': 'Guide des tailles', 'a-propos': 'À propos', faq: 'FAQ (question sur une ligne, réponse dessous, séparer par une ligne vide)' };
let tab = 'store';

export function render(root) {
  const draw = () => {
    const s = S.settings;
    root.innerHTML = `<div class="page-head"><div><h2>Paramètres</h2><p class="muted">Ces informations sont publiées sur la boutique.</p></div></div>
      <div class="tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <form id="setForm" class="card settings">${body(s)}</form>`;
    bind();
  };

  const body = (s) => {
    if (tab === 'store') return `<div class="g2">
      <label class="f"><span>Nom de la boutique</span><input name="storeName" value="${esc(s.storeName || 'BelleaV')}"></label>
      <label class="f"><span>Slogan</span><input name="tagline" value="${esc(s.tagline || '')}"></label>
      <label class="f"><span>Téléphone</span><input name="phone" value="${esc(s.phone || '')}"></label>
      <label class="f"><span>WhatsApp (numéro)</span><input name="whatsapp" value="${esc(s.whatsapp || '')}" placeholder="0550000000"></label>
      <label class="f"><span>E-mail</span><input name="email" type="email" value="${esc(s.email || '')}"></label>
      <label class="f"><span>Adresse / ville</span><input name="address" value="${esc(s.address || '')}"></label>
      <label class="f"><span>Instagram (URL)</span><input name="instagram" value="${esc(s.instagram || '')}"></label>
      <label class="f"><span>Facebook (URL)</span><input name="facebook" value="${esc(s.facebook || '')}"></label>
      <label class="f"><span>TikTok (URL)</span><input name="tiktok" value="${esc(s.tiktok || '')}"></label></div>
      <label class="f"><span>Bandeau d'annonce <em>(séparez les messages par « · »)</em></span><input name="announcement" value="${esc(s.announcement || '')}"></label>
      ${saveBtn()}`;
    if (tab === 'home') return `<label class="f"><span>Titre principal</span><input name="hero.title" value="${esc(s.hero?.title || '')}"></label>
      <label class="f"><span>Sous-titre</span><textarea name="hero.subtitle" rows="2">${esc(s.hero?.subtitle || '')}</textarea></label>
      <label class="f"><span>Texte du bouton</span><input name="hero.cta" value="${esc(s.hero?.cta || '')}"></label>
      <div class="f"><span>Image de couverture <em>(facultatif — sinon montage automatique de vos coups de cœur)</em></span>
        <div class="cover">${s.hero?.image ? `<img src="${esc(s.hero.image)}" alt="" class="hero-prev">` : '<div class="cover-ph">Montage automatique</div>'}<label class="btn ghost sm">Choisir une image…<input type="file" accept="image/*" hidden id="heroFile"></label>${s.hero?.image ? '<button type="button" class="link" id="heroRm">Retirer</button>' : ''}</div></div>
      ${saveBtn()}`;
    if (tab === 'delivery') return `<div class="g3">
        <label class="f"><span>Livraison offerte dès (DA) <em>0 = jamais</em></span><input name="freeShippingThreshold" type="number" min="0" value="${s.freeShippingThreshold || 0}"></label>
        <label class="f"><span>Délai affiché</span><input name="deliveryDelay" value="${esc(s.deliveryDelay || '')}"></label></div>
      <div class="bulk show static"><b>Appliquer à toutes les wilayas :</b><input type="number" id="allHome" placeholder="Domicile"><input type="number" id="allDesk" placeholder="Bureau"><button type="button" class="btn ghost sm" id="applyAll">Appliquer</button><button type="button" class="link" id="resetFees">Rétablir les tarifs par défaut</button></div>
      <div class="table-wrap fees"><table class="tbl"><thead><tr><th>Wilaya</th><th>Domicile (DA)</th><th>Stop desk (DA) <em>0 = indisponible</em></th><th>Livrée</th></tr></thead><tbody>
      ${WILAYAS.map((w) => { const f = feesFor(s, w.code); return `<tr><td><b>${String(w.code).padStart(2, '0')}</b> ${esc(w.name)}</td><td><input type="number" min="0" data-fee="${w.code}|home" value="${f.home}"></td><td><input type="number" min="0" data-fee="${w.code}|desk" value="${f.desk}"></td><td><label class="tog"><input type="checkbox" data-fee="${w.code}|active" ${f.active !== false ? 'checked' : ''}><span></span></label></td></tr>`; }).join('')}
      </tbody></table></div>${saveBtn()}`;
    if (tab === 'pages') return Object.entries(PAGES).map(([k, l]) => `<label class="f"><span>${l}</span><textarea name="pages.${k}" rows="${k === 'faq' ? 10 : 6}">${esc(s.pages?.[k] || '')}</textarea></label>`).join('') + saveBtn();
    if (tab === 'data') return `<div class="data-grid">
      <div class="dcard"><h4>${I.download} Sauvegarde complète</h4><p class="muted">Produits, catégories, codes promo, paramètres et commandes au format JSON.</p><button type="button" class="btn ghost" id="backup">Télécharger la sauvegarde</button></div>
      <div class="dcard"><h4>${I.refresh} Restaurer une sauvegarde</h4><p class="muted">Importe un fichier de sauvegarde (remplace les documents de mêmes identifiants).</p><label class="btn ghost">Choisir un fichier…<input type="file" accept="application/json" hidden id="restore"></label></div>
      <div class="dcard"><h4>${I.box} Exporter catalog.json</h4><p class="muted">Fichier public de la boutique. Utile pour héberger le catalogue sur Firebase Hosting (<code>boutique/data/catalog.json</code>) sans Storage.</p><button type="button" class="btn ghost" id="expCat">Exporter catalog.json</button></div>
      <div class="dcard"><h4>${I.sparkle} Données de démonstration</h4><p class="muted">Importe 32 produits et 8 catégories d'exemple ${db.isDemo ? '' : 'dans Firebase'} pour démarrer rapidement.</p><button type="button" class="btn ghost" id="seed">Importer les exemples</button></div>
      ${db.isDemo ? `<div class="dcard danger"><h4>${I.trash} Réinitialiser la démo</h4><p class="muted">Efface toutes les données de démonstration de ce navigateur.</p><button type="button" class="btn danger" id="resetDemo">Réinitialiser</button></div>` : ''}
    </div>`;
    if (tab === 'prefs') return `<label class="tog lbl big"><input type="checkbox" id="autoPub" ${S.prefs.autoPublish ? 'checked' : ''}><span></span><div><b>Publication automatique</b><small>Chaque modification du catalogue est mise en ligne quelques secondes après (recommandé).</small></div></label>
      <label class="tog lbl big"><input type="checkbox" id="sound" ${S.prefs.sound ? 'checked' : ''}><span></span><div><b>Son à chaque nouvelle commande</b><small>Un signal sonore et une notification lorsque l'onglet est ouvert.</small></div></label>
      <button type="button" class="btn ghost" id="notif">${I.sparkle} Autoriser les notifications du navigateur</button>`;
    return '';
  };
  const saveBtn = () => `<div class="form-foot"><button class="btn primary">Enregistrer</button></div>`;

  function bind() {
    const f = root.querySelector('#setForm');
    root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    const saveSettings = async (patchObj, msg = 'Paramètres enregistrés') => {
      S.settings = { ...S.settings, ...patchObj };
      await db.save('settings', 'main', S.settings);
      toast(msg); markDirty();
    };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const next = structuredClone(S.settings);
      for (const el of f.querySelectorAll('[name]')) {
        const v = el.type === 'number' ? Number(el.value) || 0 : el.value.trim();
        const [a, b] = el.name.split('.');
        if (b) { next[a] = { ...(next[a] || {}), [b]: v }; } else next[a] = v;
      }
      if (tab === 'delivery') {
        const d = {};
        f.querySelectorAll('[data-fee]').forEach((el) => { const [code, k] = el.dataset.fee.split('|'); d[code] = d[code] || {}; d[code][k] = k === 'active' ? el.checked : Math.max(0, Number(el.value) || 0); });
        next.delivery = d;
      }
      const b = f.querySelector('.form-foot .btn'); busy(b, true);
      try { await saveSettings(next); } catch (err) { toast(err.message, 'err'); }
      busy(b, false);
    });
    f.querySelector('#heroFile')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { const url = await db.uploadImage(file, 'site'); await saveSettings({ hero: { ...S.settings.hero, image: url } }, 'Image de couverture mise à jour'); draw(); } catch (err) { toast(err.message, 'err'); }
    });
    f.querySelector('#heroRm')?.addEventListener('click', async () => { await saveSettings({ hero: { ...S.settings.hero, image: '' } }); draw(); });
    f.querySelector('#applyAll')?.addEventListener('click', () => {
      const h = f.querySelector('#allHome').value, d = f.querySelector('#allDesk').value;
      f.querySelectorAll('[data-fee$="|home"]').forEach((el) => h !== '' && (el.value = h));
      f.querySelectorAll('[data-fee$="|desk"]').forEach((el) => d !== '' && (el.value = d));
      toast('Valeurs appliquées — pensez à enregistrer');
    });
    f.querySelector('#resetFees')?.addEventListener('click', () => {
      WILAYAS.forEach((w) => { const df = defaultFees(w.code); f.querySelector(`[data-fee="${w.code}|home"]`).value = df.home; f.querySelector(`[data-fee="${w.code}|desk"]`).value = df.desk; f.querySelector(`[data-fee="${w.code}|active"]`).checked = true; });
      toast('Tarifs par défaut rétablis — pensez à enregistrer');
    });
    f.querySelector('#backup')?.addEventListener('click', async () => {
      const data = { exportedAt: new Date().toISOString(), products: S.products, categories: S.categories, promos: S.promos, settings: S.settings, orders: S.orders, messages: S.messages };
      download(`belleav-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1));
    });
    f.querySelector('#restore')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { return toast('Fichier invalide', 'err'); }
      if (!(await confirmBox(`Restaurer ${data.products?.length || 0} produits, ${data.categories?.length || 0} catégories, ${data.orders?.length || 0} commandes ?`))) return;
      for (const col of ['products', 'categories', 'promos', 'orders', 'messages']) if (Array.isArray(data[col]) && data[col].length) await db.saveMany(col, data[col]);
      if (data.settings) await db.save('settings', 'main', data.settings);
      await loadAll(); toast('Sauvegarde restaurée'); markDirty(); draw();
    });
    f.querySelector('#expCat')?.addEventListener('click', async () => {
      const c = await buildCatalog({ products: S.products, categories: S.categories, settings: S.settings, promos: S.promos });
      download('catalog.json', JSON.stringify(c));
    });
    f.querySelector('#seed')?.addEventListener('click', async (e) => {
      if (!(await confirmBox("Importer les produits, catégories, codes promo et paramètres d'exemple ? Les documents existants de mêmes identifiants seront remplacés."))) return;
      busy(e.target, true, 'Import…');
      const s = await db.loadSeed();
      await db.saveMany('categories', s.categories);
      await db.saveMany('products', s.products);
      await db.saveMany('promos', s.promos);
      if (!S.settings.storeName) await db.save('settings', 'main', s.settings);
      await loadAll(); await publish(true); toast('Données d’exemple importées et publiées'); draw();
    });
    f.querySelector('#resetDemo')?.addEventListener('click', async () => {
      if (!(await confirmBox('Effacer toutes les données de démonstration de ce navigateur ?', { danger: true, ok: 'Réinitialiser' }))) return;
      Object.keys(localStorage).filter((k) => k.startsWith('bv_db_') || k === 'bv_demo_catalog' || k === 'bv_catalog_cache').forEach((k) => localStorage.removeItem(k));
      location.reload();
    });
    f.querySelector('#autoPub')?.addEventListener('change', (e) => { S.prefs.autoPublish = e.target.checked; savePrefs(); toast('Préférence enregistrée'); });
    f.querySelector('#sound')?.addEventListener('change', (e) => { S.prefs.sound = e.target.checked; savePrefs(); toast('Préférence enregistrée'); });
    f.querySelector('#notif')?.addEventListener('click', async () => { if (!('Notification' in window)) return toast('Non supporté par ce navigateur', 'err'); const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Notifications activées' : 'Notifications refusées', r === 'granted' ? 'ok' : 'err'); });
  }

  draw();
  return {};
}
