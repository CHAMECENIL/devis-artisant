/* =============================================
   HISTORY — Historique + actions enrichies
   ============================================= */

const History = (() => {
  let currentPage = 0;
  const PAGE_SIZE = 20;
  const $ = (id) => document.getElementById(id);

  function init() {
    bindFilters();
    load();
  }

  function bindFilters() {
    $('btn-apply-filters').addEventListener('click', () => { currentPage = 0; load(); });
    $('btn-reset-filters').addEventListener('click', resetFilters);
    ['filter-search', 'filter-status'].forEach(id => {
      $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    });
  }

  function resetFilters() {
    ['filter-search','filter-status','filter-date-from','filter-date-to','filter-marge-min']
      .forEach(id => { const el = $(id); if (el) el.value = ''; });
    currentPage = 0;
    load();
  }

  async function load() {
    const params = buildParams();
    const tbody = $('history-tbody');
    const emptyEl = $('history-empty');
    tbody.innerHTML = `<tr><td colspan="9"><div class="loading-overlay"><div class="spinner spinner-dark"></div> Chargement...</div></td></tr>`;

    try {
      const data = await API.history.get(params);
      const devis = data.devis || [];
      emptyEl.style.display = devis.length ? 'none' : 'flex';
      if (!devis.length) { tbody.innerHTML = ''; $('history-pagination').innerHTML = ''; return; }

      tbody.innerHTML = devis.map(d => renderRow(d)).join('');
      renderPagination(data.total || devis.length);

      tbody.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); handleAction(btn.dataset.action, btn.dataset.id, btn.dataset.numero, btn.dataset.email); });
      });
      tbody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', () => openDevis(row.dataset.id));
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" style="color:var(--danger);padding:20px;text-align:center">Erreur : ${err.message}</td></tr>`;
    }
  }

  function buildParams() {
    const p = new URLSearchParams();
    const v = id => $(id)?.value?.trim() || '';
    if (v('filter-search')) p.set('search', v('filter-search'));
    if (v('filter-status')) p.set('status', v('filter-status'));
    if (v('filter-date-from')) p.set('dateFrom', v('filter-date-from'));
    if (v('filter-date-to')) p.set('dateTo', v('filter-date-to'));
    if (v('filter-marge-min')) p.set('minMarge', v('filter-marge-min'));
    p.set('limit', PAGE_SIZE);
    p.set('offset', currentPage * PAGE_SIZE);
    return `?${p.toString()}`;
  }

  function renderRow(d) {
    const hasEmail = !!d.client_email;
    const isSigned = !!d.signed_at;
    const statusBadge = kanbanBadge(d);
    return `
      <tr data-id="${d.id}" style="cursor:pointer">
        <td class="font-mono" style="font-size:12px">${esc(d.numero)}</td>
        <td>
          <div style="font-weight:600">${esc(d.client_name||'—')}</div>
          ${d.client_email ? `<div style="font-size:11px;color:var(--text-muted)">${esc(d.client_email)}</div>` : ''}
        </td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-muted)">${esc(d.chantier_address||'—')}</td>
        <td class="font-bold">${fmtCur(d.total_ttc)}</td>
        <td class="${mrgCls(d.taux_marge)}">${Math.round(d.taux_marge||0)}%</td>
        <td>${statusBadge}</td>
        <td style="font-size:12px;color:var(--text-muted)">${fmtDate(d.created_at)}</td>
        <td>
          <div class="table-actions">
            <!-- PDF Devis -->
            <button class="action-btn" data-action="pdf" data-id="${d.id}" data-numero="${esc(d.numero)}" title="Télécharger le devis PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
              Devis
            </button>
            <!-- PDF Rentabilité -->
            <button class="action-btn action-btn-orange" data-action="rentabilite" data-id="${d.id}" title="Fiche de rentabilité">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Renta
            </button>
            <!-- Signature -->
            ${!isSigned && hasEmail ? `
            <button class="action-btn action-btn-blue" data-action="sign" data-id="${d.id}" data-numero="${esc(d.numero)}" title="Envoyer pour signature électronique">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Signer
            </button>` : ''}
            ${isSigned ? `<span style="color:#16a34a;font-size:11px;font-weight:700">✅ Signé</span>` : ''}
            <!-- Relances -->
            <div class="dropdown-wrap" onclick="event.stopPropagation()">
              <button class="action-btn action-btn-purple" title="Relances email">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Relance▾
              </button>
              <div class="dropdown-menu">
                <button class="dropdown-item" data-action="remind" data-id="${d.id}" data-type="devis_relance">📋 Relance devis</button>
                <button class="dropdown-item" data-action="remind" data-id="${d.id}" data-type="signature_relance">✍️ Relance signature</button>
                <button class="dropdown-item" data-action="remind" data-id="${d.id}" data-type="acompte_relance">💰 Relance acompte</button>
                <button class="dropdown-item" data-action="remind" data-id="${d.id}" data-type="paiement_relance">🏦 Relance paiement</button>
              </div>
            </div>
            <!-- Statut rapide -->
            ${d.status === 'draft' || d.status === 'sent' ? `
            <button class="action-btn action-btn-green" data-action="accept" data-id="${d.id}" title="Marquer accepté">✓</button>` : ''}
            ${d.status === 'draft' ? `
            <button class="action-btn action-btn-red" data-action="delete" data-id="${d.id}" data-numero="${esc(d.numero)}" title="Supprimer">✕</button>` : ''}
          </div>
        </td>
      </tr>`;
  }

  function kanbanBadge(d) {
    const stageMap = {
      devis: ['badge-draft', d.status === 'sent' ? 'Envoyé' : 'Brouillon'],
      signed: ['badge-signed', '✍️ Signé'],
      acompte: ['badge-acompte', '💰 Acompte'],
      in_progress: ['badge-inprogress', '🔨 En cours'],
      done: ['badge-done', '✅ Terminé'],
      rejected: ['badge-rejected', 'Refusé'],
      archived: ['badge-archived', 'Archivé']
    };
    const stage = d.kanban_stage || d.status || 'devis';
    const [cls, label] = stageMap[stage] || ['badge-draft', stage];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const el = $('history-pagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    let html = `<button ${currentPage === 0 ? 'disabled' : ''} onclick="History.goPage(${currentPage - 1})">‹</button>`;
    for (let i = 0; i < pages; i++) html += `<button class="${i === currentPage ? 'active' : ''}" onclick="History.goPage(${i})">${i + 1}</button>`;
    html += `<button ${currentPage >= pages - 1 ? 'disabled' : ''} onclick="History.goPage(${currentPage + 1})">›</button>`;
    html += `<span style="font-size:12px;color:var(--text-muted);margin-left:8px">${total} résultat${total > 1 ? 's' : ''}</span>`;
    el.innerHTML = html;
  }

  async function handleAction(action, id, numero, email) {
    switch (action) {
      case 'pdf':
        window.open(API.devis.pdfUrl(id), '_blank');
        break;

      case 'rentabilite':
        window.open(API.devis.rentabiliteUrl(id), '_blank');
        break;

      case 'sign':
        if (!confirm(`Envoyer le devis ${numero} pour signature électronique ?`)) return;
        try {
          const r = await API.signature.send(id);
          Toast.success(`Lien de signature envoyé ! ${r.signLink ? `<br><small>${r.signLink}</small>` : ''}`);
          load();
        } catch (err) { Toast.error(`Erreur : ${err.message}`); }
        break;

      case 'remind':
        // Géré via dropdown, type dans dataset
        break;

      case 'accept':
        try {
          await API.devis.updateStatus(id, 'accepted');
          Toast.success('Devis marqué comme accepté');
          load();
        } catch (err) { Toast.error(err.message); }
        break;

      case 'delete':
        if (!confirm(`Supprimer le devis ${numero} ?`)) return;
        try {
          await API.devis.delete(id);
          Toast.success('Devis supprimé');
          load();
        } catch (err) { Toast.error(err.message); }
        break;
    }
  }

  async function sendReminder(devisId, type) {
    const typeLabels = { devis_relance: 'relance devis', signature_relance: 'relance signature', acompte_relance: 'relance acompte', paiement_relance: 'relance paiement' };
    if (!confirm(`Envoyer une ${typeLabels[type] || type} ?`)) return;
    try {
      const r = await API.reminders.send(parseInt(devisId), type);
      Toast.success(r.message);
    } catch (err) { Toast.error(err.message); }
  }

  function openDevis(id) {
    window.open(API.devis.pdfUrl(id), '_blank');
  }

  function goPage(page) { currentPage = page; load(); }

  // Helpers
  const fmtCur = v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const fmtDate = s => s ? new Date(s).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
  const mrgCls = v => v < 20 ? 'marge-low' : v < 30 ? 'marge-ok' : v < 40 ? 'marge-good' : 'marge-excellent';
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Délégation globale pour dropdowns relance
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item[data-action="remind"]');
    if (item) { e.stopPropagation(); sendReminder(item.dataset.id, item.dataset.type); }
    // Fermer dropdowns
    if (!e.target.closest('.dropdown-wrap')) {
      document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
    }
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.dropdown-wrap > button');
    if (btn) {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      document.querySelectorAll('.dropdown-menu').forEach(m => { if (m !== menu) m.classList.remove('open'); });
      menu?.classList.toggle('open');
    }
  });

  return { init, load, openDevis, goPage, sendReminder };
})();
