/* =============================================
   DEVIS — Génération IA + saisie manuelle
   ============================================= */

const Devis = (() => {
  let lignes = [];
  let ligneCount = 0;
  let currentDevisData = null; // Devis généré par IA en attente de sauvegarde
  let settings = null;

  const $ = (id) => document.getElementById(id);

  function init() {
    loadSettings();
    bindTabs();
    bindAI();
    bindManual();
    addLigne(); // Ajouter une ligne vide par défaut
  }

  async function loadSettings() {
    try {
      settings = await API.settings.get();
    } catch (e) {
      // Settings indisponibles, utiliser valeurs par défaut
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

  // ---- TAB IA ----
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
    btn.innerHTML = '<div class="spinner"></div> Génération en cours...';

    try {
      const data = await API.devis.generate({
        description: `Client: ${clientName}\nAdresse chantier: ${chantierAddress || 'Non précisée'}\n\n${description}`,
        sessionId: localStorage.getItem('chatSessionId')
      });

      currentDevisData = data;

      // Afficher la réponse IA
      const resultEl = $('ai-result');
      const contentEl = $('ai-response-content');

      if (typeof marked !== 'undefined') {
        contentEl.innerHTML = marked.parse(data.aiResponse || '');
      } else {
        contentEl.innerHTML = (data.aiResponse || '').replace(/\n/g, '<br>');
      }

      resultEl.style.display = 'block';
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      Toast.success('Devis généré par l\'IA');
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

  async function saveFromAI() {
    if (!currentDevisData) return;

    const payload = buildAIPayload();
    if (!payload) return;

    try {
      const saved = await API.devis.save(payload);
      Toast.success(`Devis ${saved.numero} enregistré`);
      resetAIForm();
      App.navigate('history');
    } catch (err) {
      Toast.error(`Erreur lors de l'enregistrement : ${err.message}`);
    }
  }

  function buildAIPayload() {
    const clientName = $('ai-client-name').value.trim();
    const description = $('ai-description').value.trim();

    if (!clientName) { Toast.warning('Nom du client requis'); return null; }

    // Extraire les lignes du devis depuis devisData si disponible
    let lignesData = [];
    if (currentDevisData && currentDevisData.devisData && currentDevisData.devisData.lignes) {
      lignesData = currentDevisData.devisData.lignes;
    }

    return {
      clientName,
      clientEmail: $('ai-client-email').value.trim(),
      clientAddress: $('ai-client-address').value.trim(),
      chantierAddress: $('ai-chantier-address').value.trim(),
      description,
      notes: $('ai-notes').value.trim(),
      lignes: lignesData,
      distanceKm: currentDevisData?.devisData?.distanceKm || 0,
      dureeJours: currentDevisData?.devisData?.dureeJours || 1
    };
  }

  function previewDevis() {
    if (!currentDevisData) return;

    const payload = buildAIPayload();
    if (!payload) return;

    // Sauvegarder d'abord, puis ouvrir le PDF
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
  }

  // ---- TAB MANUEL ----
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

    // Mise à jour du total ligne
    const total = ligne.quantite * ligne.prix_unitaire;
    const totalEl = document.querySelector(`[data-total="${id}"]`);
    if (totalEl) totalEl.textContent = formatCurrency(total);

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
      <div class="total-row"><span>Matériaux HT</span><span>${formatCurrency(totalMaterials)}</span></div>
      <div class="total-row"><span>Main d'œuvre HT</span><span>${formatCurrency(totalLabor)}</span></div>
      <div class="total-row"><span>Déplacements HT</span><span>${formatCurrency(totalTravel)}</span></div>
      <div class="total-row"><span>Total HT</span><span>${formatCurrency(totalHT)}</span></div>
      <div class="total-row"><span>TVA (${tva}%)</span><span>${formatCurrency(totalTVA)}</span></div>
      <div class="total-row total-main"><span>Total TTC</span><span>${formatCurrency(totalTTC)}</span></div>
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

  function formatCurrency(val) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }

  return { init };
})();
