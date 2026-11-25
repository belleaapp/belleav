import * as db from '../db.js';
import { S, catName, markDirty } from '../state.js';
import { esc, norm, slugify, totalStock, discountPct, productImages, fmtDate } from '../shared/utils.js';
import { I, fmt, toast, modal, confirmBox, promptBox, busy, csvDownload, pager, sortIcon } from '../ui.js';
import { SHOP_URL } from '../config.js';

const PER = 30;
const SIZE_PRESETS = { 'Taille unique': ['Taille unique'], 'S → XXL': ['S', 'M', 'L', 'XL', 'XXL'], 'S/M · L/XL': ['S/M', 'L/XL'], 'Abayas 52 → 60': ['52', '54', '56', '58', '60'], 'Fillettes 2 → 12 ans': ['2 ans', '4 ans', '6 ans', '8 ans', '10 ans', '12 ans'], '36 → 46': ['36', '38', '40', '42', '44', '46'] };
const COLOR_PRESETS = [['Noir', '#1f1c1d'], ['Blanc', '#f7f5f0'], ['Ivoire', '#efe7d6'], ['Beige', '#d6c3a5'], ['Nude', '#d8b9a0'], ['Rose poudré', '#e6c1bb'], ['Taupe', '#9f8e7f'], ['Moka', '#6b4f3f'], ['Kaki', '#7d7a5c'], ['Vert sauge', '#9caf88'], ['Olive', '#6d6b4b'], ['Émeraude', '#1f5c4a'], ['Bleu nuit', '#2c3550'], ['Bleu ciel', '#a9c2d9'], ['Lilas', '#b9a3c9'], ['Prune', '#5d3a4c'], ['Bordeaux', '#6e2a35'], ['Terracotta', '#b5654a'], ['Gris perle', '#bdb9b4'], ['Camel', '#b07d4f']];
let st = { q: '', cat: '', status: '', page: 1, sort: { key: 'updated', dir: -1 }, sel: new Set() };

export function render(root, params) {
  if (params.stock === 'low') st.status = 'low';
  root.innerHTML = `
    <div class="page-head"><div><h2>Produits</h2><p class="muted" id="pSub"></p></div>
      <div class="row-btns"><button class="btn ghost" id="pCsv">${I.download} Exporter</button><button class="btn primary" id="pNew">${I.plus} Nouveau produit</button></div></div>
    <div class="toolbar">
      <label class="search">${I.search}<input id="pq" placeholder="Nom, référence, tag…" value="${esc(st.q)}"></label>
      <select id="pcat"><option value="">Toutes catégories</option>${S.categories.map((c) => `<option value="${c.id}" ${st.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select id="pst">${[['', 'Tous les statuts'], ['active', 'En ligne'], ['inactive', 'Masqués'], ['out', 'En rupture'], ['low', 'Stock faible (≤ 3)'], ['promo', 'En promotion'], ['featured', 'Coups de cœur'], ['noimg', 'Sans photo']].map(([v, l]) => `<option value="${v}" ${st.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="bulk" id="pBulk"></div>
    <div class="card flush"><div class="table-wrap" id="pTable"></div></div>`;

  const filtered = () => {
    const q = norm(st.q);
    let l = S.products.filter((p) => {
      const s = totalStock(p);
      if (st.cat && p.category !== st.cat) return false;
      if (st.status === 'active' && p.active === false) return false;
      if (st.status === 'inactive' && p.active !== false) return false;
      if (st.status === 'out' && s > 0) return false;
      if (st.status === 'low' && !(s <= 3 || (p.sizes || []).some((x) => !(x.stock > 0)))) return false;
      if (st.status === 'promo' && !discountPct(p)) return false;
      if (st.status === 'featured' && !p.featured) return false;
      if (st.status === 'noimg' && p.images?.length) return false;
      if (q && !norm(`${p.name} ${p.sku} ${(p.tags || []).join(' ')} ${catName(p.category)}`).includes(q)) return false;
      return true;
    });
    const { key: k, dir: d } = st.sort;
    const val = (p) => (k === 'name' ? p.name : k === 'price' ? p.price : k === 'stock' ? totalStock(p) : k === 'sold' ? p.sold || 0 : p.updatedAt || p.createdAt || 0);
    l.sort((a, b) => { const A = val(a), B = val(b); return d * (typeof A === 'string' ? A.localeCompare(B, 'fr') : A - B); });
    return l;
  };

  const draw = () => {
    const l = filtered();
    const rows = l.slice((st.page - 1) * PER, st.page * PER);
    const online = S.products.filter((p) => p.active !== false).length;
    root.querySelector('#pSub').textContent = `${S.products.length} produits · ${online} en ligne · ${S.products.reduce((a, p) => a + totalStock(p), 0)} pièces en stock`;
    root.querySelector('#pTable').innerHTML = `<table class="tbl"><thead><tr>
      <th class="cb"><input type="checkbox" id="pAll" ${rows.length && rows.every((p) => st.sel.has(p.id)) ? 'checked' : ''} aria-label="Tout sélectionner"></th>
      <th class="sortable" data-sort="name">Produit${sortIcon('name', st.sort)}</th><th>Catégorie</th><th class="sortable num" data-sort="price">Prix${sortIcon('price', st.sort)}</th><th class="sortable" data-sort="stock">Stock${sortIcon('stock', st.sort)}</th><th class="sortable num" data-sort="sold">Ventes${sortIcon('sold', st.sort)}</th><th>En ligne</th><th></th></tr></thead>
      <tbody>${rows.map((p) => { const s = totalStock(p); const d = discountPct(p); return `<tr class="clickable ${p.active === false ? 'is-off' : ''}" data-edit="${p.id}">
        <td class="cb"><input type="checkbox" data-sel="${p.id}" ${st.sel.has(p.id) ? 'checked' : ''} aria-label="Sélectionner"></td>
        <td><div class="pcell"><img src="${productImages(p)[0]}" alt="" loading="lazy"><div><b>${esc(p.name)}</b><small>${esc(p.sku || '')}${p.featured ? ' · ★ coup de cœur' : ''}${p.isNew ? ' · nouveau' : ''}${!p.images?.length ? ' · <span class="amber-t">sans photo</span>' : ''}</small></div></div></td>
        <td>${esc(catName(p.category))}</td>
        <td class="num"><b>${fmt(p.price)}</b>${d ? `<small><s>${fmt(p.oldPrice)}</s> <span class="red-t">-${d}%</span></small>` : ''}</td>
        <td><span class="stock ${s === 0 ? 'red' : s <= 3 ? 'amber' : 'green'}">${s}</span><small class="sizes-mini">${(p.sizes || []).map((x) => `<i class="${x.stock > 0 ? '' : 'off'}" title="${esc(x.label)} : ${x.stock}">${esc(x.label)}</i>`).join('')}</small></td>
        <td class="num">${p.sold || 0}</td>
        <td><label class="tog" data-stop><input type="checkbox" data-toggle="${p.id}" ${p.active !== false ? 'checked' : ''}><span></span></label></td>
        <td class="actions"><button class="ibtn" data-dup="${p.id}" title="Dupliquer">${I.plus}</button><a class="ibtn" href="${SHOP_URL}#/produit/${encodeURIComponent(p.slug || p.id)}" target="_blank" rel="noopener" title="Voir sur la boutique" data-stop>${I.eye}</a></td></tr>`; }).join('') || `<tr><td colspan="8"><div class="empty sm">${I.tag}<p>Aucun produit ne correspond.</p></div></td></tr>`}</tbody></table>${pager(l.length, st.page, PER)}`;
    drawBulk();
  };
  const drawBulk = () => {
    const n = st.sel.size;
    const el = root.querySelector('#pBulk');
    el.classList.toggle('show', n > 0);
    el.innerHTML = n ? `<b>${n} sélectionné${n > 1 ? 's' : ''}</b><button class="btn ghost sm" data-bulk="on">Mettre en ligne</button><button class="btn ghost sm" data-bulk="off">Masquer</button>
      <select data-bulkcat><option value="">Déplacer vers…</option>${S.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <button class="btn ghost sm" data-bulk="promo">Appliquer une remise %</button><button class="btn ghost sm" data-bulk="unpromo">Retirer la remise</button>
      <button class="btn ghost sm danger-t" data-bulk="del">${I.trash} Supprimer</button><button class="link" data-bulk="clear">Désélectionner</button>` : '';
  };

  const bulkSave = async (fn, msg) => {
    const docs = S.products.filter((p) => st.sel.has(p.id)).map((p) => ({ ...fn({ ...p }), updatedAt: Date.now() }));
    await db.saveMany('products', docs);
    docs.forEach((d) => { const i = S.products.findIndex((p) => p.id === d.id); S.products[i] = d; });
    toast(msg); markDirty(); draw();
  };

  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-stop]')) return;
    if (t.matches('[data-sel],#pAll')) return;
    const so = t.closest('[data-sort]');
    if (so) { const k = so.dataset.sort; st.sort = { key: k, dir: st.sort.key === k ? -st.sort.dir : k === 'name' ? 1 : -1 }; return draw(); }
    const pg = t.closest('[data-page]'); if (pg) { st.page = Number(pg.dataset.page); return draw(); }
    const dup = t.closest('[data-dup]');
    if (dup) { const p = S.products.find((x) => x.id === dup.dataset.dup); return editor({ ...structuredClone(p), id: null, name: p.name + ' (copie)', slug: '', sku: '', sold: 0, active: false }); }
    const ed = t.closest('[data-edit]'); if (ed) return editor(S.products.find((p) => p.id === ed.dataset.edit));
    if (t.closest('#pNew')) return editor(null);
    if (t.closest('#pCsv')) return csvDownload(`produits-belleav-${new Date().toISOString().slice(0, 10)}.csv`, [['Référence', 'Nom', 'Catégorie', 'Prix', 'Ancien prix', 'Stock total', 'Détail stock', 'Couleurs', 'Ventes', 'En ligne'], ...filtered().map((p) => [p.sku, p.name, catName(p.category), p.price, p.oldPrice || '', totalStock(p), (p.sizes || []).map((s) => `${s.label}:${s.stock}`).join(' '), (p.colors || []).map((c) => c.name).join(', '), p.sold || 0, p.active !== false ? 'oui' : 'non'])]);
    const b = t.closest('[data-bulk]');
    if (b) {
      const a = b.dataset.bulk;
      if (a === 'clear') { st.sel.clear(); return draw(); }
      if (a === 'on') return bulkSave((p) => ({ ...p, active: true }), 'Produits mis en ligne');
      if (a === 'off') return bulkSave((p) => ({ ...p, active: false }), 'Produits masqués');
      if (a === 'unpromo') return bulkSave((p) => (p.oldPrice ? { ...p, price: p.oldPrice, oldPrice: null } : p), 'Remises retirées');
      if (a === 'promo') {
        const v = Number(await promptBox('Pourcentage de remise (ex : 20)', '20', { title: 'Remise groupée', type: 'number' }));
        if (!v || v <= 0 || v >= 90) return;
        return bulkSave((p) => { const base = p.oldPrice || p.price; return { ...p, oldPrice: base, price: Math.round((base * (1 - v / 100)) / 50) * 50 }; }, `Remise de ${v}% appliquée`);
      }
      if (a === 'del') {
        if (!(await confirmBox(`Supprimer définitivement ${st.sel.size} produit(s) ? Cette action est irréversible.`, { danger: true, ok: 'Supprimer' }))) return;
        const ids = [...st.sel];
        await db.removeMany('products', ids);
        S.products.filter((p) => ids.includes(p.id)).forEach((p) => (p.images || []).forEach(db.deleteImage));
        S.products = S.products.filter((p) => !ids.includes(p.id));
        st.sel.clear(); toast('Produits supprimés'); markDirty(); return draw();
      }
    }
  });
  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.sel) { t.checked ? st.sel.add(t.dataset.sel) : st.sel.delete(t.dataset.sel); return drawBulk(); }
    if (t.id === 'pAll') { filtered().slice((st.page - 1) * PER, st.page * PER).forEach((p) => (t.checked ? st.sel.add(p.id) : st.sel.delete(p.id))); return draw(); }
    if (t.dataset.toggle) {
      const p = S.products.find((x) => x.id === t.dataset.toggle);
      p.active = t.checked; p.updatedAt = Date.now();
      await db.patch('products', p.id, { active: p.active, updatedAt: p.updatedAt });
      toast(p.active ? 'Produit en ligne' : 'Produit masqué'); markDirty(); draw();
    }
    if (t.dataset.bulkcat !== undefined && t.value) { const c = t.value; await bulkSave((p) => ({ ...p, category: c }), 'Catégorie modifiée'); }
    if (t.id === 'pcat') { st.cat = t.value; st.page = 1; draw(); }
    if (t.id === 'pst') { st.status = t.value; st.page = 1; draw(); }
  });
  let tq;
  root.querySelector('#pq').addEventListener('input', (e) => { clearTimeout(tq); tq = setTimeout(() => { st.q = e.target.value; st.page = 1; draw(); }, 180); });

  draw();
  if (params.edit) setTimeout(() => editor(S.products.find((p) => p.id === params.edit)), 50);
  return { on: ['products'], refresh: draw, update(p) { if (p.edit) editor(S.products.find((x) => x.id === p.edit)); } };

  /* ================= Éditeur produit ================= */
  function editor(prod) {
    const isNew = !prod?.id;
    const p = structuredClone(prod || { name: '', category: S.categories[0]?.id || '', price: '', oldPrice: '', description: '', material: '', care: '', colors: [], sizes: [{ label: 'Taille unique', stock: 0 }], images: [], tags: [], active: true, featured: false, isNew: true });
    p.images = p.images || []; p.colors = p.colors || []; p.sizes = p.sizes || []; p.tags = p.tags || [];
    let dirty = false;
    const m = modal(`<form class="editor" id="pe" novalidate>
      <div class="mhead sticky"><div><h3>${isNew ? 'Nouveau produit' : 'Modifier le produit'}</h3>${!isNew ? `<small class="muted">Modifié le ${fmtDate(p.updatedAt || p.createdAt)}</small>` : ''}</div>
        <span class="grow"></span><label class="tog lbl"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><span></span>En ligne</label><button type="button" class="ibtn" data-x aria-label="Fermer">${I.close}</button></div>
      <div class="mbody ed-grid">
        <div class="ed-main">
          <section class="card"><h4>Informations</h4>
            <label class="f"><span>Nom du produit *</span><input name="name" value="${esc(p.name)}" required maxlength="120" placeholder="Ex : Abaya Dubaï brodée or"></label>
            <div class="g2"><label class="f"><span>Catégorie *</span><select name="category">${S.categories.map((c) => `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${esc(c.name)}${c.active === false ? ' (masquée)' : ''}</option>`).join('')}</select></label>
              <label class="f"><span>Référence (SKU)</span><input name="sku" value="${esc(p.sku || '')}" placeholder="Auto"></label></div>
            <label class="f"><span>Description</span><textarea name="description" rows="4" placeholder="Coupe, tissu, longueur, occasions…">${esc(p.description || '')}</textarea></label>
            <div class="g2"><label class="f"><span>Matière</span><input name="material" value="${esc(p.material || '')}"></label><label class="f"><span>Entretien</span><input name="care" value="${esc(p.care || '')}"></label></div>
            <label class="f"><span>Mots-clés de recherche <em>(séparés par des virgules)</em></span><input name="tags" value="${esc(p.tags.join(', '))}" placeholder="mariage, aïd, été…"></label>
          </section>
          <section class="card"><h4>Photos <small class="muted">— la 1ʳᵉ est la photo principale · glissez-déposez · WebP compressé automatiquement</small></h4>
            <div class="imgs" id="imgs"></div>
          </section>
          <section class="card"><h4>Couleurs</h4><div id="colors"></div>
            <div class="presets">${COLOR_PRESETS.map(([n, h]) => `<button type="button" class="cpreset" data-cpre="${esc(n)}|${h}" title="${esc(n)}" style="--c:${h}"></button>`).join('')}</div></section>
          <section class="card"><h4>Tailles & stock</h4>
            <div class="presets txt">${Object.keys(SIZE_PRESETS).map((k) => `<button type="button" class="chip-btn" data-spre="${esc(k)}">${esc(k)}</button>`).join('')}</div>
            <div id="sizes"></div></section>
        </div>
        <aside class="ed-side">
          <section class="card"><h4>Prix</h4>
            <label class="f"><span>Prix de vente (DA) *</span><input name="price" type="number" min="0" step="50" value="${esc(p.price)}" required></label>
            <label class="f"><span>Prix barré (avant promo)</span><input name="oldPrice" type="number" min="0" step="50" value="${esc(p.oldPrice || '')}" placeholder="Optionnel"></label>
            <p class="hint" id="discHint"></p></section>
          <section class="card"><h4>Mise en avant</h4>
            <label class="tog lbl"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}><span></span>Coup de cœur (accueil)</label>
            <label class="tog lbl"><input type="checkbox" name="isNew" ${p.isNew ? 'checked' : ''}><span></span>Badge « Nouveau »</label></section>
          <section class="card preview"><h4>Aperçu</h4><div id="pv"></div></section>
        </aside>
      </div>
      <div class="mfoot">${!isNew ? `<button type="button" class="btn ghost danger-t" id="pDel">${I.trash} Supprimer</button>` : ''}<span class="grow"></span><span class="muted small kbd">Ctrl + S</span><button type="button" class="btn ghost" data-x>Annuler</button><button class="btn primary" id="pSave">${isNew ? 'Créer le produit' : 'Enregistrer'}</button></div>
    </form>`, { wide: true, side: true });
    const f = m.el.querySelector('#pe');
    const close = async () => { if (dirty && !(await confirmBox('Fermer sans enregistrer les modifications ?', { ok: 'Fermer' }))) return; m.close(); };
    f.querySelectorAll('[data-x]').forEach((b) => (b.onclick = close));
    m.el.parentElement.querySelector('.mbg').removeAttribute('data-mclose');
    m.el.parentElement.querySelector('.mbg').onclick = close;

    const drawImgs = () => {
      f.querySelector('#imgs').innerHTML = p.images.map((src, i) => `<div class="img ${i === 0 ? 'main' : ''}" draggable="true" data-i="${i}"><img src="${src}" alt="">${i === 0 ? '<span class="tagm">Principale</span>' : ''}<div class="img-act">${i > 0 ? `<button type="button" data-imain="${i}" title="Définir comme principale">★</button>` : ''}<button type="button" data-ileft="${i}" title="Déplacer à gauche">‹</button><button type="button" data-iright="${i}" title="Déplacer à droite">›</button><button type="button" data-idel="${i}" title="Supprimer">✕</button></div></div>`).join('')
        + `<label class="img add" id="drop"><input type="file" accept="image/*" multiple hidden id="fileIn">${I.plus}<span>Ajouter des photos</span><small>JPG, PNG, WebP</small></label>`;
    };
    const drawColors = () => {
      f.querySelector('#colors').innerHTML = (p.colors.length ? p.colors.map((c, i) => `<div class="crow"><input type="color" value="${esc(c.hex)}" data-chex="${i}" aria-label="Couleur"><input value="${esc(c.name)}" data-cname="${i}" placeholder="Nom de la couleur"><button type="button" class="ibtn" data-cdel="${i}" aria-label="Retirer">${I.trash}</button></div>`).join('') : '<p class="muted small">Aucune couleur. Cliquez sur une pastille ci-dessous ou ajoutez-en une.</p>')
        + '<button type="button" class="link" data-cadd>+ Ajouter une couleur personnalisée</button>';
    };
    const drawSizes = () => {
      const total = p.sizes.reduce((a, s) => a + (Number(s.stock) || 0), 0);
      f.querySelector('#sizes').innerHTML = `<table class="stbl"><thead><tr><th>Taille</th><th>Stock</th><th></th></tr></thead><tbody>${p.sizes.map((s, i) => `<tr><td><input value="${esc(s.label)}" data-slabel="${i}"></td><td><div class="stepper-in"><button type="button" data-sstep="${i}|-1">−</button><input type="number" min="0" value="${Number(s.stock) || 0}" data-sstock="${i}"><button type="button" data-sstep="${i}|1">+</button></div></td><td><button type="button" class="ibtn" data-sdel="${i}" aria-label="Retirer">${I.trash}</button></td></tr>`).join('')}</tbody>
        <tfoot><tr><td><button type="button" class="link" data-sadd>+ Ajouter une taille</button></td><td colspan="2"><b>Total : ${total}</b> <button type="button" class="link" data-sall>Tout mettre à…</button></td></tr></tfoot></table>`;
    };
    const drawPreview = () => {
      const fd = new FormData(f);
      const price = Number(fd.get('price')) || 0, old = Number(fd.get('oldPrice')) || 0;
      const d = old > price ? Math.round((1 - price / old) * 100) : 0;
      f.querySelector('#discHint').innerHTML = old && old <= price ? '<span class="red-t">Le prix barré doit être supérieur au prix de vente.</span>' : d ? `Remise affichée : <b>-${d}%</b>` : '';
      const tmp = { ...p, name: fd.get('name') || 'Nom du produit', category: fd.get('category') };
      f.querySelector('#pv').innerHTML = `<div class="pv-card"><img src="${productImages(tmp)[0]}" alt="">${d ? `<span class="pv-b">-${d}%</span>` : ''}<small>${esc(catName(tmp.category))}</small><b>${esc(tmp.name)}</b><div><span class="${d ? 'red-t' : ''}">${fmt(price)}</span>${d ? ` <s>${fmt(old)}</s>` : ''}</div></div>`;
    };
    drawImgs(); drawColors(); drawSizes(); drawPreview();

    const addFiles = async (files) => {
      const list = [...files].filter((x) => x.type.startsWith('image/'));
      if (!list.length) return;
      const add = f.querySelector('#drop');
      add.classList.add('loading'); add.querySelector('span').textContent = `Envoi 0/${list.length}…`;
      let n = 0;
      for (const file of list) {
        try { p.images.push(await db.uploadImage(file)); dirty = true; } catch (err) { toast(`Échec de l'envoi de ${file.name} : ${err.message}`, 'err', 5000); }
        add.querySelector('span').textContent = `Envoi ${++n}/${list.length}…`;
      }
      drawImgs(); drawPreview();
    };
    let dragI = null;
    f.addEventListener('dragstart', (e) => { const el = e.target.closest('.img[data-i]'); if (el) dragI = Number(el.dataset.i); });
    f.addEventListener('dragover', (e) => { if (e.target.closest('#imgs')) { e.preventDefault(); e.target.closest('.img')?.classList.add('over'); } });
    f.addEventListener('dragleave', (e) => e.target.closest?.('.img')?.classList.remove('over'));
    f.addEventListener('drop', (e) => {
      if (!e.target.closest('#imgs')) return;
      e.preventDefault();
      if (e.dataTransfer.files.length) return addFiles(e.dataTransfer.files);
      const to = e.target.closest('.img[data-i]');
      if (dragI != null && to) { const [x] = p.images.splice(dragI, 1); p.images.splice(Number(to.dataset.i), 0, x); dirty = true; drawImgs(); drawPreview(); }
      dragI = null;
    });
    f.addEventListener('change', (e) => { if (e.target.id === 'fileIn') addFiles(e.target.files); });

    f.addEventListener('click', async (e) => {
      const d = e.target.closest('button,[data-imain]')?.dataset || {};
      const mv = (i, j) => { if (j < 0 || j >= p.images.length) return; [p.images[i], p.images[j]] = [p.images[j], p.images[i]]; dirty = true; drawImgs(); drawPreview(); };
      if (d.imain) { const [x] = p.images.splice(Number(d.imain), 1); p.images.unshift(x); dirty = true; drawImgs(); drawPreview(); }
      if (d.ileft) mv(Number(d.ileft), Number(d.ileft) - 1);
      if (d.iright) mv(Number(d.iright), Number(d.iright) + 1);
      if (d.idel) { p.images.splice(Number(d.idel), 1); dirty = true; drawImgs(); drawPreview(); }
      if (d.cpre) { const [n, h] = d.cpre.split('|'); if (!p.colors.some((c) => c.name === n)) { p.colors.push({ name: n, hex: h }); dirty = true; drawColors(); drawPreview(); } }
      if (d.cadd !== undefined) { p.colors.push({ name: '', hex: '#c9a27e' }); drawColors(); f.querySelector(`[data-cname="${p.colors.length - 1}"]`).focus(); }
      if (d.cdel) { p.colors.splice(Number(d.cdel), 1); dirty = true; drawColors(); drawPreview(); }
      if (d.spre) {
        const labels = SIZE_PRESETS[d.spre];
        const old = Object.fromEntries(p.sizes.map((s) => [s.label, s.stock]));
        p.sizes = labels.map((l) => ({ label: l, stock: old[l] || 0 })); dirty = true; drawSizes();
      }
      if (d.sadd !== undefined) { p.sizes.push({ label: '', stock: 0 }); drawSizes(); f.querySelector(`[data-slabel="${p.sizes.length - 1}"]`).focus(); }
      if (d.sdel) { p.sizes.splice(Number(d.sdel), 1); dirty = true; drawSizes(); }
      if (d.sstep) { const [i, s] = d.sstep.split('|').map(Number); p.sizes[i].stock = Math.max(0, (Number(p.sizes[i].stock) || 0) + s); dirty = true; drawSizes(); }
      if (d.sall !== undefined) { const v = await promptBox('Stock pour toutes les tailles', '5', { type: 'number', title: 'Stock groupé' }); if (v != null && v !== '') { p.sizes.forEach((s) => (s.stock = Math.max(0, Number(v) || 0))); dirty = true; drawSizes(); } }
    });
    f.addEventListener('input', (e) => {
      dirty = true;
      const d = e.target.dataset;
      if (d.chex) p.colors[d.chex].hex = e.target.value;
      if (d.cname) p.colors[d.cname].name = e.target.value;
      if (d.slabel) p.sizes[d.slabel].label = e.target.value;
      if (d.sstock) { p.sizes[d.sstock].stock = Math.max(0, Number(e.target.value) || 0); }
      if (d.chex || ['name', 'price', 'oldPrice', 'category'].includes(e.target.name)) drawPreview();
    });
    f.addEventListener('change', (e) => { if (e.target.dataset.sstock !== undefined) drawSizes(); if (e.target.name === 'category') drawPreview(); });
    f.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); f.requestSubmit(); } });

    f.querySelector('#pDel')?.addEventListener('click', async () => {
      if (!(await confirmBox(`Supprimer définitivement « ${esc(p.name)} » ?<br><small>Astuce : vous pouvez aussi simplement le masquer.</small>`, { danger: true, ok: 'Supprimer' }))) return;
      await db.remove('products', p.id);
      (prod.images || []).forEach(db.deleteImage);
      S.products = S.products.filter((x) => x.id !== p.id);
      toast('Produit supprimé'); markDirty(); m.close(); draw();
    });

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const name = String(fd.get('name')).trim();
      const price = Number(fd.get('price'));
      const oldPrice = Number(fd.get('oldPrice')) || null;
      const errs = [];
      if (!name) errs.push('le nom');
      if (!(price > 0)) errs.push('le prix');
      if (!fd.get('category')) errs.push('la catégorie');
      p.sizes = p.sizes.filter((s) => s.label.trim()).map((s) => ({ label: s.label.trim(), stock: Math.max(0, Number(s.stock) || 0) }));
      if (!p.sizes.length) errs.push('au moins une taille');
      if (new Set(p.sizes.map((s) => s.label)).size !== p.sizes.length) errs.push('des tailles uniques (doublon détecté)');
      if (errs.length) return toast('Veuillez renseigner ' + errs.join(', '), 'err', 4500);
      if (oldPrice && oldPrice <= price) return toast('Le prix barré doit être supérieur au prix de vente', 'err');
      p.colors = p.colors.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), hex: c.hex }));
      let slug = slugify(name);
      const clash = (s) => S.products.some((x) => x.id !== p.id && x.slug === s);
      if (clash(slug)) { let n = 2; while (clash(`${slug}-${n}`)) n++; slug = `${slug}-${n}`; }
      const cat = String(fd.get('category'));
      const now = Date.now();
      const doc = {
        ...p, name, slug, price, oldPrice, category: cat,
        sku: String(fd.get('sku')).trim() || `BV-${cat.slice(0, 3).toUpperCase()}-${now.toString(36).slice(-4).toUpperCase()}`,
        description: String(fd.get('description')).trim(), material: String(fd.get('material')).trim(), care: String(fd.get('care')).trim(),
        tags: String(fd.get('tags')).split(',').map((x) => x.trim()).filter(Boolean),
        active: fd.get('active') === 'on', featured: fd.get('featured') === 'on', isNew: fd.get('isNew') === 'on',
        sold: p.sold || 0, createdAt: p.createdAt || now, updatedAt: now,
      };
      const b = f.querySelector('#pSave');
      busy(b, true, 'Enregistrement…');
      try {
        const id = await db.save('products', p.id || null, doc);
        doc.id = id;
        const i = S.products.findIndex((x) => x.id === id);
        if (i >= 0) S.products[i] = doc; else S.products.unshift(doc);
        // nettoyage des photos retirées
        if (!isNew) (prod?.images || []).filter((u) => !doc.images.includes(u)).forEach(db.deleteImage);
        toast(isNew ? 'Produit créé' : 'Produit enregistré');
        dirty = false; markDirty(); m.close(); draw();
      } catch (err) { console.error(err); toast("Erreur d'enregistrement : " + err.message, 'err', 6000); busy(b, false); }
    });
  }
}
