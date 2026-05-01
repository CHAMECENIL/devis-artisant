/* =============================================
   KANBAN — Suivi de projets par étapes
   ============================================= */

const Kanban = (() => {
  const STAGES = [
    { id: 'devis',       label: '📋 Devis',              color: '#6b7280' },
    { id: 'signed',      label: '✍️ Devis Signé',         color: '#3b82f6' },
    { id: 'acompte',     label: '💰 Acompte Reçu',        color: '#f59e0b' },
    { id: 'in_progress', label: '🔨 Chantier en cours',   color: '#8b5cf6' },
    { id: 'done',        label: '✅ Terminé',              color: '#22c55e' }
  ];

  let board = {};
  let dragId = null;
  let dragStage = null;

  function init() {
    const el = document.getElementById('btn-refresh-kanban');
    if (el) el.addEventListener('click', load);
    load();
  }

  async function load() {
    const container = document.getElementById('kanban-board');
    if (!container) return;
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)"><div class="spinner"></div> Chargement...</div>';
    try {
      board = await API.kanban.get();
      render();
    } catch (err) {
      container.innerHTML = `<p style="color:var(--danger);padding:20px">Erreur : ${err.message}</p>`;
    }
  }

  function render() {
    const container = document.getElementById('kanban-board');
    if (!container) return;

    const total = STAGES.reduce((s, st) => s + (board[st.id]?.length || 0), 0);
    document.getElementById('kanban-total')?.setAttribute('data-count', total);

    container.innerHTML = `
      <div class="kanban-columns">
        ${STAGES.map(stage => renderColumn(stage)).join('')}
      </div>`;

    // Drag & Drop
    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        dragId = card.dataset.id;
        dragStage = card.dataset.stage;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        container.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
      });
    });

    container.querySelectorAll('.kanban-col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const targetStage = col.dataset.stage;
        if (dragId && targetStage !== dragStage) moveCard(dragId, targetStage);
      });
    });

    // Actions boutons
    container.querySelectorAll('[data-card-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleCardAction(btn.dataset.cardAction, btn.dataset.id, btn.dataset.stage);
      });
    });
  }

  function renderColumn(stage) {
    const cards = board[stage.id] || [];
    const caTotal = cards.reduce((s, c) => s + (c.total_ttc || 0), 0);
    return `
      <div class="kanban-col" data-stage="${stage.id}">
        <div class="kanban-col-header" style="border-top:3px solid ${stage.color}">
          <div>
            <span class="kanban-col-title">${stage.label}</span>
            <span class="kanban-badge-count">${cards.length}</span>
          </div>
          ${caTotal > 0 ? `<div class="kanban-col-ca">${fmtCur(caTotal)}</div>` : ''}
        </div>
        <div class="kanban-cards">
          ${cards.length ? cards.map(c => renderCard(c, stage.id)).join('') : `
            <div class="kanban-empty-col">
              <p>Glissez un projet ici</p>
            </div>`}
        </div>
      </div>`;
  }

  function renderCard(d, stageId) {
    const margeColor = d.taux_marge < 20 ? '#ef4444' : d.taux_marge < 30 ? '#f59e0b' : '#22c55e';
    const daysSince = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000);
    return `
      <div class="kanban-card" draggable="true" data-id="${d.id}" data-stage="${stageId}">
        <div class="kanban-card-header">
          <span class="kanban-numero">${esc(d.numero)}</span>
          ${d.reminder_count > 0 ? `<span class="kanban-reminder-badge" title="${d.reminder_count} relance(s)">${d.reminder_count}✉️</span>` : ''}
        </div>
        <div class="kanban-client">${esc(d.client_name || '—')}</div>
        <div class="kanban-chantier">${esc((d.chantier_address || '').substring(0, 45))}${d.chantier_address?.length > 45 ? '...' : ''}</div>
        <div class="kanban-card-footer">
          <span class="kanban-montant">${fmtCur(d.total_ttc)}</span>
          <span class="kanban-marge" style="color:${margeColor}">${Math.round(d.taux_marge || 0)}%</span>
        </div>
        ${daysSince > 7 ? `<div class="kanban-aging" title="Inactif depuis ${daysSince}j">⏱️ ${daysSince}j</div>` : ''}
        <div class="kanban-card-actions">
          <button class="kanban-action-btn" data-card-action="pdf" data-id="${d.id}" title="Télécharger PDF">📄</button>
          <button class="kanban-action-btn" data-card-action="rentabilite" data-id="${d.id}" title="Fiche rentabilité">📊</button>
          <button class="kanban-action-btn" data-card-action="remind" data-id="${d.id}" data-stage="${stageId}" title="Envoyer relance">📧</button>
          ${stageId === 'acompte' ? `<button class="kanban-action-btn" data-card-action="acompte" data-id="${d.id}" title="Saisir acompte">💰</button>` : ''}
        </div>
      </div>`;
  }

  async function moveCard(id, targetStage) {
    try {
      await API.kanban.move(parseInt(id), targetStage);
      await load();
      Toast.success('Projet déplacé');
    } catch (err) { Toast.error(err.message); }
  }

  async function handleCardAction(action, id, stage) {
    switch (action) {
      case 'pdf': window.open(API.devis.pdfUrl(id), '_blank'); break;
      case 'rentabilite': window.open(API.devis.rentabiliteUrl(id), '_blank'); break;
      case 'remind': showReminderMenu(id, stage); break;
      case 'acompte': {
        const amount = prompt('Montant de l\'acompte reçu (€) :');
        if (amount && !isNaN(parseFloat(amount))) {
          try {
            await API.kanban.acompte(parseInt(id), parseFloat(amount));
            Toast.success('Acompte enregistré');
            await load();
          } catch (err) { Toast.error(err.message); }
        }
        break;
      }
    }
  }

  function showReminderMenu(id, stage) {
    const options = [
      { type: 'devis_relance', label: '📋 Relance devis' },
      { type: 'signature_relance', label: '✍️ Relance signature' },
      { type: 'acompte_relance', label: '💰 Relance acompte' },
      { type: 'paiement_relance', label: '🏦 Relance paiement' }
    ];
    const choice = prompt(`Choisir le type de relance :\n${options.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}\n\nEntrez le numéro :`);
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < options.length) {
      History.sendReminder(id, options[idx].type);
    }
  }

  const fmtCur = v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return { init, load };
})();
