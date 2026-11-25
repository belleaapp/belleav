import * as db from '../db.js';
import { S, markDirty } from '../state.js';
import { esc, slugify, productImages } from '../shared/utils.js';
import { I, toast, modal, confirmBox, busy } from '../ui.js';

export function render(root) {
  const draw = () => {
    const count = (id) => S.products.filter((p) => p.category === id).length;
    const groups = [['femme', 'Femme'], ['enfant', 'Fillettes (petit espace)']];
    root.innerHTML = `<div class="page-head"><div><h2>Catégories</h2><p class="muted">L'ordre ci-dessous est celui du menu de la boutique.</p></div><button class="btn primary" id="cNew">${I.plus} Nouvelle catégorie</button></div>
      ${groups.map(([g, label]) => {
        const list = S.categories.filter((c) => (c.group || 'femme') === g);
        return `<div class="card flush mb"><div class="card-h pad"><h3>${label}</h3><span class="muted small">${list.length} catégorie(s)</span></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th style="width:90px">Ordre</th><th>Catégorie</th><th>Produits</th><th>Visible</th><th></th></tr></thead><tbody>
        ${list.map((c, i) => { const first = S.products.find((p) => p.category === c.id); return `<tr class="${c.active === false ? 'is-off' : ''}">
          <td><div class="ord"><button class="ibtn" data-up="${c.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button><button class="ibtn" data-down="${c.id}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button></div></td>
          <td><div class="pcell"><img src="${c.image || (first ? productImages(first)[0] : productImages({ category: c.id })[0])}" alt=""><div><b>${esc(c.name)}</b><small>${esc(c.description || '')}</small></div></div></td>
          <td><a class="link" href="#/products" data-filter="${c.id}">${count(c.id)} produit(s)</a></td>
          <td><label class="tog"><input type="checkbox" data-ctog="${c.id}" ${c.active !== false ? 'checked' : ''}><span></span></label></td>
          <td class="actions"><button class="btn ghost sm" data-cedit="${c.id}">Modifier</button><button class="ibtn" data-cdel="${c.id}" aria-label="Supprimer">${I.trash}</button></td></tr>`; }).join('') || '<tr><td colspan="5" class="muted center">Aucune catégorie</td></tr>'}
        </tbody></table></div></div>`;
      }).join('')}`;
  };

  const persist = async (list) => { await db.saveMany('categories', list); S.categories.sort((a, b) => a.order - b.order); markDirty(); draw(); };
  const move = async (id, dir) => {
    const c = S.categories.find((x) => x.id === id);
    const g = S.categories.filter((x) => (x.group || 'femme') === (c.group || 'femme'));
    const i = g.indexOf(c), j = i + dir;
    if (j < 0 || j >= g.length) return;
    [g[i], g[j]] = [g[j], g[i]];
    const kidGroup = c.group === 'enfant';
    const ordered = [...(kidGroup ? S.categories.filter((x) => x.group !== 'enfant') : g), ...(kidGroup ? g : S.categories.filter((x) => x.group === 'enfant'))];
    ordered.forEach((x, k) => (x.order = k + 1));
    await persist(ordered);
  };

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button,a');
    if (!t) return;
    const d = t.dataset;
    if (d.up) move(d.up, -1);
    if (d.down) move(d.down, 1);
    if (d.cedit) edit(S.categories.find((c) => c.id === d.cedit));
    if (t.id === 'cNew') edit(null);
    if (d.filter) { e.preventDefault(); location.hash = '#/products'; setTimeout(() => { const s = document.querySelector('#pcat'); if (s) { s.value = d.filter; s.dispatchEvent(new Event('change', { bubbles: true })); } }, 150); }
    if (d.cdel) {
      const c = S.categories.find((x) => x.id === d.cdel);
      const n = S.products.filter((p) => p.category === c.id).length;
      if (n) return toast(`Impossible : ${n} produit(s) sont encore dans « ${c.name} ». Déplacez-les d'abord.`, 'err', 5000);
      if (!(await confirmBox(`Supprimer la catégorie « ${esc(c.name)} » ?`, { danger: true, ok: 'Supprimer' }))) return;
      await db.remove('categories', c.id);
      S.categories = S.categories.filter((x) => x.id !== c.id);
      toast('Catégorie supprimée'); markDirty(); draw();
    }
  });
  root.addEventListener('change', async (e) => {
    const id = e.target.dataset.ctog;
    if (!id) return;
    const c = S.categories.find((x) => x.id === id);
    c.active = e.target.checked;
    await db.patch('categories', id, { active: c.active });
    toast(c.active ? 'Catégorie visible' : 'Catégorie masquée (ses produits aussi)'); markDirty(); draw();
  });

  function edit(cat) {
    const c = cat || { name: '', group: 'femme', description: '', image: '', active: true };
    const m = modal(`<form><div class="mhead"><h3>${cat ? 'Modifier' : 'Nouvelle'} catégorie</h3><button type="button" class="ibtn" data-mclose>${I.close}</button></div>
      <div class="mbody">
        <label class="f"><span>Nom *</span><input name="name" value="${esc(c.name)}" required></label>
        <label class="f"><span>Espace</span><select name="group"><option value="femme" ${c.group !== 'enfant' ? 'selected' : ''}>Femme</option><option value="enfant" ${c.group === 'enfant' ? 'selected' : ''}>Fillettes</option></select></label>
        <label class="f"><span>Description courte</span><input name="description" value="${esc(c.description || '')}" maxlength="120"></label>
        <div class="f"><span>Image de couverture <em>(sinon : photo du 1er produit)</em></span><div class="cover">${c.image ? `<img src="${c.image}" alt="" id="cimg">` : '<div class="cover-ph" id="cimg">Aucune</div>'}<label class="btn ghost sm">Choisir…<input type="file" accept="image/*" hidden id="cfile"></label>${c.image ? '<button type="button" class="link" id="crm">Retirer</button>' : ''}</div></div>
      </div><div class="mfoot"><button type="button" class="btn ghost" data-mclose>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`);
    const f = m.el.querySelector('form');
    f.querySelector('#cfile').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { c.image = await db.uploadImage(file, 'categories'); f.querySelector('#cimg').outerHTML = `<img src="${c.image}" alt="" id="cimg">`; } catch (err) { toast(err.message, 'err'); }
    };
    f.querySelector('#crm')?.addEventListener('click', () => { c.image = ''; f.querySelector('#cimg').outerHTML = '<div class="cover-ph" id="cimg">Aucune</div>'; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = f.name.value.trim();
      if (!name) return toast('Le nom est obligatoire', 'err');
      let id = c.id;
      if (!id) { id = slugify(name); let n = 2; while (S.categories.some((x) => x.id === id)) id = slugify(name) + '-' + n++; }
      const doc = { ...c, id, name, group: f.group.value, description: f.description.value.trim(), order: c.order ?? S.categories.length + 1, active: c.active !== false };
      const b = f.querySelector('.primary'); busy(b, true);
      await db.save('categories', id, doc);
      const i = S.categories.findIndex((x) => x.id === id);
      if (i >= 0) S.categories[i] = doc; else S.categories.push(doc);
      toast('Catégorie enregistrée'); markDirty(); m.close(); draw();
    });
  }

  draw();
  return {};
}
