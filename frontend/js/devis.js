/* =============================================
   DEVIS — Génération IA + saisie manuelle
   ============================================= */

const Devis = (() => {
  let lignes = [];
  let ligneCount = 0;
  let currentDevisData = null;
  let editableLignes = []; // Lignes éditables post-génération IA
  let remise = 0; // % de remise globale
  let settings = null;

  const $ = (id) => document.getElementById(id);
  const fmt = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0);

  function init() {
    loadSettings();
    bindTabs();
    bindAI();
    bindManual();
    addLigne();
  }

  async function loadSettings() {
    try {
      settings = await API.settings.get();
    } catch (e) {
      settings = { tva_rate: 10, margin_material: 30, hourly_rate: 15, km_rate: 0.30 };
    }
  }

  // ---- Tabs ----
  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        $(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });
  }

  // ============================================================
  //  TAB IA
  // ============================================================
  function bindAI() {
    $('btn-ai-generate').addEventListener('click', generateWithAI);
    $('btn-save-devis').addEventListener('click', saveFromAI);
    $('btn-preview-devis').addEventListener('click', previewDevis);
  }

  async function generateWithAI() {
    const clientName = $('ai-client-name').value.trim();
    const description = $('ai-description').value.trim();
    const chantierAddress = $('ai-chantier-address').value.trim();

    if (!clientName) return Toast.warning('Nom du client requis');
    if (!description) return Toast.warning('Description du projet requise');

    const btn = $('btn-ai-generate');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Analyse en cours...';

    try {
      const data = await API.devis.generate({
        description: `Client: ${clientName}\nAdresse chantier: ${chantierAddress || 'Non précisée'}\n\n${description}`,
        sessionId: localStorage.getItem('chatSessionId')
      });

      currentDevisData = data;
      editableLignes = [];
      remise = 0;

      // Extraire les lignes depuis devisData
      if (data.devisData && data.devisData.lignes) {
        editableLignes = data.devisData.lignes.map((l, i) => ({
          id: i + 1,
          designation: l.designation || '',
          unite: l.unite || 'u',
          quantite: parseFloat(l.quantite) || 0,
          prixUnitaireHT: parseFloat(l.prixUnitaireHT || l.prix_unitaire_ht || l.prix_unitaire || 0),
          coutMateriau: parseFloat(l.coutMateriau || l.cout_materiau || 0),
          coutMainOeuvre: parseFloat(l.coutMainOeuvre || l.cout_main_oeuvre || 0),
          heuresMO: parseFloat(l.heuresMO || l.heures_mo || 0),
          notes: l.notes || ''
        }));
      }

      // Afficher alertes chantier
      const alertes = data.devisData?.alertesChantier || [];
      renderAlertes(alertes);

      // Afficher éditeur de lignes
      renderEditableLignes();

      // Afficher texte IA complet
      const resultEl = $('ai-result');
      const contentEl = $('ai-response-content');
      if (typeof marked !== 'undefined') {
        contentEl.innerHTML = marked.parse(data.aiResponse || '');
      } else {
        contentEl.innerHTML = (data.aiResponse || '').replace(/\n/g, '<br>');
      }

      resultEl.style.display = 'block';
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Afficher liste de courses si disponible
      const listeAchats = data.devisData?.listeAchats || [];
      renderListeAchats(listeAchats, data.devisData?.dureeDetaillee);

      Toast.success('Devis généré — vérifiez et ajustez les lignes avant d\'enregistrer');
    } catch (err) {
      Toast.error(`Erreur : ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        Générer avec l'IA
      `;
    }
  }

  // --- Alertes chantier ---
  function renderAlertes(alertes) {
    let el = $('ai-alertes');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ai-alertes';
      $('ai-result').insertAdjacentElement('beforebegin', el);
    }
    if (!alertes || alertes.length === 0) { el.innerHTML = ''; return; }

    el.className = 'alertes-chantier';
    el.innerHTML = `
      <div class="alertes-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <strong>Points d'attention chantier à vérifier avant démarrage</strong>
      </div>
      <ul class="alertes-list">
        ${alertes.map(a => `<li>${a}</li>`).join('')}
      </ul>
    `;
  }

  // --- Table éditable lignes IA ---
  function renderEditableLignes() {
    let container = $('ai-editable-lignes');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ai-editable-lignes';
      $('ai-result').insertAdjacentElement('afterbegin', container);
    }

    const tva = settings?.tva_rate || 10;

    container.innerHTML = `
      <div class="editable-lignes-header">
        <h3>Lignes du devis — modifiable avant enregistrement</h3>
        <button class="btn btn-outline btn-sm" id="btn-add-ligne-ia">+ Ajouter une ligne</button>
      </div>
      <div class="editable-table-wrap">
        <table class="editable-table" id="ai-lignes-table">
          <thead>
            <tr>
              <th style="width:30%">Désignation</th>
              <th>Qté</th><th>Unité</th><th>PU HT (€)</th>
              <th>Total HT</th><th>Coût mat.</th><th>H. MO</th><th></th>
            </tr>
          </thead>
          <tbody id="ai-lignes-tbody"></tbody>
        </table>
      </div>
      <div class="devis-remise-row">
        <label>Remise globale (%)</label>
        <input type="number" id="ai-remise" value="${remise}" min="0" max="100" step="0.5" style="width:80px">
        <button class="btn btn-outline btn-sm" id="btn-apply-remise">Appliquer</button>
      </div>
      <div class="devis-totals" id="ai-totals-display"></div>
    `;

    document.getElementById('btn-add-ligne-ia').addEventListener('click', () => {
      editableLignes.push({
        id: Date.now(),
        designation: '', unite: 'u', quantite: 1,
        prixUnitaireHT: 0, coutMateriau: 0, coutMainOeuvre: 0, heuresMO: 0, notes: ''
      });
      renderLignesBody();
      updateAITotals();
    });

    document.getElementById('btn-apply-remise').addEventListener('click', () => {
      remise = parseFloat(document.getElementById('ai-remise').value) || 0;
      updateAITotals();
    });

    document.getElementById('ai-remise').addEventListener('input', () => {
      remise = parseFloat(document.getElementById('ai-remise').value) || 0;
      updateAITotals();
    });

    renderLignesBody();
    updateAITotals();
  }

  function renderLignesBody() {
    const tbody = $('ai-lignes-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    editableLignes.forEach((ligne, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.id = ligne.id;
      tr.innerHTML = `
        <td><input type="text" class="cell-input" data-f="designation" value="${escHtml(ligne.designation)}" placeholder="Désignation"></td>
        <td><input type="number" class="cell-input cell-num" data-f="quantite" value="${ligne.quantite}" min="0" step="0.01"></td>
        <td><input type="text" class="cell-input cell-sm" data-f="unite" value="${ligne.unite}"></td>
        <td><input type="number" class="cell-input cell-num" data-f="prixUnitaireHT" value="${ligne.prixUnitaireHT}" min="0" step="0.01"></td>
        <td class="cell-total" data-total="${ligne.id}">${fmt(ligne.quantite * ligne.prixUnitaireHT)}</td>
        <td><input type="number" class="cell-input cell-num" data-f="coutMateriau" value="${ligne.coutMateriau}" min="0" step="0.01"></td>
        <td><input type="number" class="cell-input cell-num" data-f="heuresMO" value="${ligne.heuresMO}" min="0" step="0.25"></td>
        <td><button class="btn-del-ligne" data-id="${ligne.id}" title="Supprimer">✕</button></td>
      `;

      tr.querySelectorAll('.cell-input').forEach(input => {
        input.addEventListener('input', () => {
          const field = input.dataset.f;
          const numFields = ['quantite', 'prixUnitaireHT', 'coutMateriau', 'heuresMO'];
          if (numFields.includes(field)) {
            ligne[field] = parseFloat(input.value) || 0;
          } else {
            ligne[field] = input.value;
          }
          const totalEl = tr.querySelector(`[data-total="${ligne.id}"]`);
          if (totalEl) totalEl.textContent = fmt(ligne.quantite * ligne.prixUnitaireHT);
          updateAITotals();
        });
      });

      tr.querySelector('.btn-del-ligne').addEventListener('click', () => {
        editableLignes = editableLignes.filter(l => l.id !== ligne.id);
        tr.remove();
        updateAITotals();
      });

      tbody.appendChild(tr);
    });
  }

  function updateAITotals() {
    const el = $('ai-totals-display');
    if (!el) return;
    const tva = settings?.tva_rate || 10;

    let totalHTBrut = editableLignes.reduce((s, l) => s + l.quantite * l.prixUnitaireHT, 0);
    const remiseAmt = totalHTBrut * (remise / 100);
    const totalHTNet = totalHTBrut - remiseAmt;
    const totalTVA = totalHTNet * tva / 100;
    const totalTTC = totalHTNet + totalTVA;

    el.innerHTML = `
      ${remise > 0 ? `<div class="total-row"><span>Total HT brut</span><span>${fmt(totalHTBrut)}</span></div>
      <div class="total-row total-remise"><span>Remise (${remise}%)</span><span>- ${fmt(remiseAmt)}</span></div>` : ''}
      <div class="total-row"><span>Total HT net</span><span>${fmt(totalHTNet)}</span></div>
      <div class="total-row"><span>TVA (${tva}%)</span><span>${fmt(totalTVA)}</span></div>
      <div class="total-row total-main"><span>Total TTC</span><span>${fmt(totalTTC)}</span></div>
    `;

    // Sync remise dans currentDevisData
    if (currentDevisData) currentDevisData._remise = remise;
  }

  // --- Liste de courses ---
  function renderListeAchats(listeAchats, dureeDetaillee) {
    let container = $('ai-liste-achats');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ai-liste-achats';
      // Insérer après le résultat IA
      const resultEl = $('ai-result');
      resultEl.parentNode.insertBefore(container, resultEl.nextSibling);
    }

    if (!listeAchats || listeAchats.length === 0) { container.innerHTML = ''; return; }

    const totalAchat = listeAchats.reduce((s, a) => s + (a.total || 0), 0);

    container.className = 'liste-achats-card card';
    container.innerHTML = `
      <div class="liste-achats-header">
        <div>
          <h3>🛒 Liste de courses fournisseurs</h3>
          ${dureeDetaillee ? `<p class="duree-detail">⏱️ ${dureeDetaillee}</p>` : ''}
        </div>
        <button class="btn btn-outline btn-sm" id="btn-export-achats">⬇ Export CSV</button>
      </div>
      <div class="table-wrap">
        <table class="data-table achats-table">
          <thead>
            <tr>
              <th>Fourniture</th><th>Qté</th><th>Unité</th>
              <th>Prix achat est.</th><th>Fournisseur conseillé</th>
              <th>Total achat</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${listeAchats.map(a => `
              <tr>
                <td>${escHtml(a.designation || '')}</td>
                <td>${a.quantite || ''}</td>
                <td>${a.unite || ''}</td>
                <td>${fmt(a.prixAchatEstime || 0)}</td>
                <td class="fournisseur-cell">${escHtml(a.fournisseurConseille || '')}</td>
                <td><strong>${fmt(a.total || 0)}</strong></td>
                <td class="notes-cell">${escHtml(a.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5"><strong>Total achats estimé</strong></td>
              <td><strong>${fmt(totalAchat)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    container.querySelector('#btn-export-achats').addEventListener('click', () => exportAchatsCSV(listeAchats));
  }

  function exportAchatsCSV(listeAchats) {
    const header = 'Fourniture;Quantité;Unité;Prix achat estimé (€);Fournisseur;Total achat (€);Notes';
    const rows = listeAchats.map(a =>
      [a.designation, a.quantite, a.unite, a.prixAchatEstime, a.fournisseurConseille, a.total, a.notes]
        .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'liste-courses-fournisseurs.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveFromAI() {
    if (!currentDevisData) return Toast.warning('Générez d\'abord un devis');

    const payload = buildAIPayload();
    if (!payload) return;

    const btn = $('btn-save-devis');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
      const saved = await API.devis.save(payload);
      Toast.success(`Devis ${saved.numero} enregistré`);
      resetAIForm();
      App.navigate('history');
    } catch (err) {
      Toast.error(`Erreur lors de l'enregistrement : ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enregistrer le devis';
    }
  }

  function buildAIPayload() {
    const clientName = $('ai-client-name').value.trim();
    const description = $('ai-description').value.trim();

    if (!clientName) { Toast.warning('Nom du client requis'); return null; }

    // Utiliser les lignes éditées si disponibles, sinon celles du JSON IA
    let lignesData = editableLignes.length > 0
      ? editableLignes
      : (currentDevisData?.devisData?.lignes || []);

    // Appliquer la remise dans les notes si > 0
    const remiseAppliquee = parseFloat($('ai-remise')?.value) || currentDevisData?._remise || 0;

    return {
      clientName,
      clientEmail: $('ai-client-email').value.trim(),
      clientAddress: $('ai-client-address').value.trim(),
      chantierAddress: $('ai-chantier-address').value.trim(),
      description,
      notes: $('ai-notes').value.trim() + (remiseAppliquee > 0 ? ` [Remise ${remiseAppliquee}%]` : ''),
      lignes: lignesData,
      distanceKm: currentDevisData?.devisData?.distanceKm || 0,
      dureeJours: currentDevisData?.devisData?.dureeJours || 1,
      remise: remiseAppliquee,
      listeAchats: currentDevisData?.devisData?.listeAchats || null
    };
  }

  function previewDevis() {
    if (!currentDevisData) return;

    const payload = buildAIPayload();
    if (!payload) return;

    API.devis.save(payload).then(saved => {
      currentDevisData._savedId = saved.id;
      Modal.openPDF(saved.id, saved.numero);
    }).catch(err => Toast.error(err.message));
  }

  function resetAIForm() {
    $('ai-client-name').value = '';
    $('ai-client-email').value = '';
    $('ai-client-address').value = '';
    $('ai-chantier-address').value = '';
    $('ai-description').value = '';
    $('ai-notes').value = '';
    $('ai-result').style.display = 'none';
    $('ai-response-content').innerHTML = '';
    currentDevisData = null;
    editableLignes = [];
    remise = 0;
    const alertesEl = $('ai-alertes');
    if (alertesEl) alertesEl.innerHTML = '';
    const editEl = $('ai-editable-lignes');
    if (editEl) editEl.innerHTML = '';
    const achatsEl = $('ai-liste-achats');
    if (achatsEl) achatsEl.innerHTML = '';
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ============================================================
  //  TAB MANUEL
  // ============================================================
  function bindManual() {
    $('btn-add-ligne').addEventListener('click', addLigne);
    $('btn-manual-save').addEventListener('click', saveManual);
    $('btn-manual-preview').addEventListener('click', previewManual);
  }

  function addLigne() {
    ligneCount++;
    const id = ligneCount;
    lignes.push({ id, designation: '', unite: 'u', quantite: 1, prix_unitaire: 0, cout_materiau: 0, heures_mo: 0 });

    const container = $('lignes-list');
    const row = document.createElement('div');
    row.className = 'ligne-row';
    row.dataset.id = id;
    row.innerHTML = `
      <input type="text" placeholder="Désignation" data-field="designation" value="">
      <input type="number" placeholder="1" data-field="quantite" value="1" min="0" step="0.01">
      <input type="text" placeholder="u" data-field="unite" value="u" style="width:100%">
      <input type="number" placeholder="0.00" data-field="prix_unitaire" value="0" min="0" step="0.01">
      <span class="ligne-total" data-total="${id}">0,00 €</span>
      <input type="number" placeholder="0.00" data-field="cout_materiau" value="0" min="0" step="0.01">
      <input type="number" placeholder="0" data-field="heures_mo" value="0" min="0" step="0.5">
      <button class="btn-delete-ligne" data-ligne="${id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    `;

    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => updateLigne(id, input.dataset.field, input.value));
    });
    row.querySelector('.btn-delete-ligne').addEventListener('click', () => deleteLigne(id));

    container.appendChild(row);
    updateTotals();
  }

  function updateLigne(id, field, value) {
    const ligne = lignes.find(l => l.id === id);
    if (!ligne) return;
    if (['quantite', 'prix_unitaire', 'cout_materiau', 'heures_mo'].includes(field)) {
      ligne[field] = parseFloat(value) || 0;
    } else {
      ligne[field] = value;
    }
    const total = ligne.quantite * ligne.prix_unitaire;
    const totalEl = document.querySelector(`[data-total="${id}"]`);
    if (totalEl) totalEl.textContent = fmt(total);
    updateTotals();
  }

  function deleteLigne(id) {
    lignes = lignes.filter(l => l.id !== id);
    const row = document.querySelector(`.ligne-row[data-id="${id}"]`);
    if (row) row.remove();
    updateTotals();
  }

  function updateTotals() {
    if (!settings) return;
    const tva = settings.tva_rate || 10;
    const kmRate = settings.km_rate || 0.30;
    const hourlyRate = settings.hourly_rate || 15;

    const totalMaterials = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
    const totalLabor = lignes.reduce((s, l) => s + l.heures_mo * hourlyRate, 0);
    const distance = parseFloat($('m-distance').value) || 0;
    const duree = parseInt($('m-duree').value) || 1;
    const totalTravel = distance * 2 * kmRate * duree;

    const totalHT = totalMaterials + totalLabor + totalTravel;
    const totalTVA = totalHT * tva / 100;
    const totalTTC = totalHT + totalTVA;

    $('manual-totals').innerHTML = `
      <div class="total-row"><span>Matériaux HT</span><span>${fmt(totalMaterials)}</span></div>
      <div class="total-row"><span>Main d'œuvre HT</span><span>${fmt(totalLabor)}</span></div>
      <div class="total-row"><span>Déplacements HT</span><span>${fmt(totalTravel)}</span></div>
      <div class="total-row"><span>Total HT</span><span>${fmt(totalHT)}</span></div>
      <div class="total-row"><span>TVA (${tva}%)</span><span>${fmt(totalTVA)}</span></div>
      <div class="total-row total-main"><span>Total TTC</span><span>${fmt(totalTTC)}</span></div>
    `;
  }

  async function saveManual() {
    const payload = buildManualPayload();
    if (!payload) return;

    const btn = $('btn-manual-save');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
      const saved = await API.devis.save(payload);
      Toast.success(`Devis ${saved.numero} enregistré`);
      resetManualForm();
      App.navigate('history');
    } catch (err) {
      Toast.error(`Erreur : ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enregistrer le devis';
    }
  }

  async function previewManual() {
    const payload = buildManualPayload();
    if (!payload) return;
    try {
      const saved = await API.devis.save(payload);
      Modal.openPDF(saved.id, saved.numero);
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function buildManualPayload() {
    const clientName = $('m-client-name').value.trim();
    const chantierAddress = $('m-chantier-address').value.trim();

    if (!clientName) { Toast.warning('Nom du client requis'); return null; }
    if (lignes.length === 0) { Toast.warning('Ajoutez au moins une ligne'); return null; }

    return {
      clientName,
      clientEmail: $('m-client-email').value.trim(),
      clientAddress: $('m-client-address').value.trim(),
      chantierAddress,
      description: $('m-description').value.trim(),
      notes: $('m-notes').value.trim(),
      distanceKm: parseFloat($('m-distance').value) || 0,
      dureeJours: parseInt($('m-duree').value) || 1,
      lignes: lignes.map(l => ({
        designation: l.designation || 'Prestation',
        unite: l.unite || 'u',
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire,
        total_ht: l.quantite * l.prix_unitaire,
        cout_materiau: l.cout_materiau,
        heures_mo: l.heures_mo
      }))
    };
  }

  function resetManualForm() {
    $('m-client-name').value = '';
    $('m-client-email').value = '';
    $('m-client-address').value = '';
    $('m-chantier-address').value = '';
    $('m-description').value = '';
    $('m-notes').value = '';
    $('m-distance').value = '';
    $('m-duree').value = '';
    lignes = [];
    ligneCount = 0;
    $('lignes-list').innerHTML = '';
    $('manual-totals').innerHTML = '';
    addLigne();
  }

  return { init };
})();
