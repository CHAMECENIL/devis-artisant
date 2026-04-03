/* =============================================
   HISTORY — Historique des devis + filtres
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

    ['filter-search', 'filter-status', 'filter-date-from', 'filter-date-to'].forEach(id => {
      $(id).addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    });
  }

  function resetFilters() {
    $('filter-search').value = '';
    $('filter-status').value = '';
    $('filter-date-from').value = '';
    $('filter-date-to').value = '';
    $('filter-marge-min').value = '';
    currentPage = 0;
    load();
  }

  async function load() {
    const params = buildParams();
    const tbody = $('history-tbody');
    const emptyEl = $('history-empty');

    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-overlay"><div class="spinner spinner-dark"></div> Chargement...</div></td></tr>`;

    try {
      const data = await API.history.get(params);
      const devis = data.devis || [];
      const total = data.total || devis.length;

      if (!devis.length) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'flex';
        $('history-pagination').innerHTML = '';
        return;
      }

      emptyEl.style.display = 'none';
      tbody.innerHTML = devis.map(d => renderRow(d)).join('');
      renderPagination(total);

      // Bind actions
      tbody.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleAction(btn.dataset.action, btn.dataset.id, btn.dataset.numero);
        });
      });

      tbody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', () => openDevis(row.dataset.id));
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--danger);padding:20px;text-align:center">Erreur : ${err.message}</td></tr>`;
    }
  }

  function buildParams() {
    const p = new URLSearchParams();
    const search = $('filter-search').value.trim();
    const status = $('filter-status').value;
    const from = $('filter-date-from').value;
    const to = $('filter-date-to').value;
    const margeMin = $('filter-marge-min').value;

    if (search) p.set('search', search);
    if (status) p.set('status', status);
    if (from) p.set('dateFrom', from);
    if (to) p.set('dateTo', to);
    if (margeMin) p.set('minMarge', margeMin);
    p.set('limit', PAGE_SIZE);
    p.set('offset', currentPage * PAGE_SIZE);

    return `?${p.toString()}`;
  }

  function renderRow(d) {
    return `
      <tr data-id="${d.id}" style="cursor:pointer">
        <td class="font-mono" style="font-size:12.5px">${escapeHtml(d.numero)}</td>
        <td>${escapeHtml(d.client_name || '—')}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--text-muted)">${escapeHtml(d.chantier_address || '—')}</td>
        <td class="font-bold">${formatCurrency(d.total_ttc)}</td>
        <td class="${margeClass(d.taux_marge)}">${Math.round(d.taux_marge || 0)}%</td>
        <td>${badgeHtml(d.status)}</td>
        <td style="font-size:12.5px;color:var(--text-muted)">${formatDate(d.created_at)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" data-action="pdf" data-id="${d.id}" data-numero="${escapeHtml(d.numero)}" title="Télécharger PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
              PDF
            </button>
            ${d.status === 'draft' ? `
            <button class="btn btn-outline btn-sm" data-action="send" data-id="${d.id}" data-numero="${escapeHtml(d.numero)}" title="Envoyer par email">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
            ` : ''}
            ${d.status === 'sent' ? `
            <button class="btn btn-outline btn-sm" data-action="accept" data-id="${d.id}" title="Marquer accepté" style="color:var(--success)">✓</button>
            <button class="btn btn-outline btn-sm" data-action="reject" data-id="${d.id}" title="Marquer refusé" style="color:var(--danger)">✗</button>
            ` : ''}
            <button class="btn btn-outline btn-sm" data-action="delete" data-id="${d.id}" title="Supprimer" style="color:var(--danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const el = $('history-pagination');

    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = `<button ${currentPage === 0 ? 'disabled' : ''} onclick="History.goPage(${currentPage - 1})">‹</button>`;

    for (let i = 0; i < pages; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="History.goPage(${i})">${i + 1}</button>`;
    }

    html += `<button ${currentPage >= pages - 1 ? 'disabled' : ''} onclick="History.goPage(${currentPage + 1})">›</button>`;
    html += `<span style="font-size:12px;color:var(--text-muted);margin-left:8px">${total} résultat${total > 1 ? 's' : ''}</span>`;

    el.innerHTML = html;
  }

  async function handleAction(action, id, numero) {
    switch (action) {
      case 'pdf':
        window.open(API.devis.pdfUrl(id), '_blank');
        break;

      case 'send':
        if (!confirm(`Envoyer le devis ${numero} par email ?`)) return;
        try {
          await API.devis.send(id);
          Toast.success('Devis envoyé avec succès');
          load();
        } catch (err) {
          Toast.error(`Erreur d'envoi : ${err.message}`);
        }
        break;

      case 'accept':
        try {
          await API.devis.updateStatus(id, 'accepted');
          Toast.success('Devis marqué comme accepté');
          load();
        } catch (err) {
          Toast.error(err.message);
        }
        break;

      case 'reject':
        try {
          await API.devis.updateStatus(id, 'rejected');
          Toast.info('Devis marqué comme refusé');
          load();
        } catch (err) {
          Toast.error(err.message);
        }
        break;

      case 'delete':
        if (!confirm(`Supprimer le devis ${numero} ? Cette action est irréversible.`)) return;
        try {
          await API.devis.delete(id);
          Toast.success('Devis supprimé');
          load();
        } catch (err) {
          Toast.error(err.message);
        }
        break;
    }
  }

  async function openDevis(id) {
    Modal.openPDF(id);
  }

  function goPage(page) {
    currentPage = page;
    load();
  }

  // ---- Helpers ----
  function formatCurrency(val) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val || 0);
  }

  function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function margeClass(val) {
    if (!val || val < 20) return 'marge-low';
    if (val < 30) return 'marge-ok';
    if (val < 40) return 'marge-good';
    return 'marge-excellent';
  }

  function badgeHtml(status) {
    const map = {
      draft: ['badge-draft', 'Brouillon'],
      sent: ['badge-sent', 'Envoyé'],
      accepted: ['badge-accepted', 'Accepté'],
      rejected: ['badge-rejected', 'Refusé'],
      archived: ['badge-archived', 'Archivé']
    };
    const [cls, label] = map[status] || ['badge-draft', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init, load, openDevis, goPage };
})();
