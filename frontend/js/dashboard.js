/* =============================================
   DASHBOARD — Analytics + graphiques Chart.js
   ============================================= */

const Dashboard = (() => {
  let charts = {};
  let loaded = false;

  const $ = (id) => document.getElementById(id);

  function init() {
    $('btn-refresh-dashboard').addEventListener('click', load);
    load();
  }

  async function load() {
    const btn = $('btn-refresh-dashboard');
    btn.disabled = true;

    try {
      const stats = await API.dashboard.stats();
      renderKPIs(stats);
      renderCharts(stats);
      renderTopClients(stats.topClients || []);
      renderRecentDevis(stats.recentDevis || []);
      loaded = true;
    } catch (err) {
      Toast.error('Impossible de charger le dashboard');
    } finally {
      btn.disabled = false;
    }
  }

  function renderKPIs(stats) {
    const g = stats.global || {};
    const kpis = [
      {
        label: 'Devis créés',
        value: g.totalDevis || 0,
        sub: 'total',
        cls: ''
      },
      {
        label: 'Devis envoyés',
        value: g.devisEnvoyes || 0,
        sub: `${g.totalDevis ? Math.round((g.devisEnvoyes / g.totalDevis) * 100) : 0}% du total`,
        cls: 'kpi-accent'
      },
      {
        label: 'Devis acceptés',
        value: g.devisAcceptes || 0,
        sub: `${g.devisEnvoyes ? Math.round((g.devisAcceptes / g.devisEnvoyes) * 100) : 0}% de conversion`,
        cls: 'kpi-success'
      },
      {
        label: 'CA Total HT',
        value: formatCurrency(g.caTotal || 0),
        sub: `Panier moyen : ${formatCurrency(g.panierMoyen || 0)}`,
        cls: 'kpi-accent',
        large: true
      },
      {
        label: 'Marge moyenne',
        value: `${Math.round(g.margeMoyenne || 0)}%`,
        sub: margeLabel(g.margeMoyenne),
        cls: margeClass(g.margeMoyenne)
      }
    ];

    $('dashboard-kpis').innerHTML = kpis.map(k => `
      <div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value ${k.cls}" style="${k.large ? 'font-size:20px' : ''}">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>
    `).join('');
  }

  function renderCharts(stats) {
    const months = stats.byMonth || [];
    const statuts = stats.byStatus || {};
    const marges = stats.marginDistribution || {};

    // CA par mois
    destroyChart('chart-ca');
    charts['chart-ca'] = new Chart($('chart-ca'), {
      type: 'bar',
      data: {
        labels: months.map(m => formatMonth(m.month)),
        datasets: [{
          label: 'CA HT (€)',
          data: months.map(m => m.caHT || 0),
          backgroundColor: 'rgba(26,86,219,0.75)',
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatCurrency(ctx.raw)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => formatCurrencyShort(v) },
            grid: { color: '#f3f4f6' }
          },
          x: { grid: { display: false } }
        }
      }
    });

    // Statuts
    const statusLabels = { draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé', archived: 'Archivé' };
    const statusColors = {
      draft: '#9ca3af',
      sent: '#60a5fa',
      accepted: '#34d399',
      rejected: '#f87171',
      archived: '#a78bfa'
    };

    const statutKeys = Object.keys(statuts).filter(k => statuts[k] > 0);
    destroyChart('chart-statuts');
    charts['chart-statuts'] = new Chart($('chart-statuts'), {
      type: 'doughnut',
      data: {
        labels: statutKeys.map(k => statusLabels[k] || k),
        datasets: [{
          data: statutKeys.map(k => statuts[k]),
          backgroundColor: statutKeys.map(k => statusColors[k] || '#9ca3af'),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11 }, padding: 8 }
          }
        },
        cutout: '60%'
      }
    });

    // Distribution marges
    const margeLabels = {
      faible: 'Faible (<20%)',
      correct: 'Correct (20-30%)',
      bon: 'Bon (30-40%)',
      excellent: 'Excellent (>40%)'
    };
    const margeColors = ['#f87171', '#fbbf24', '#34d399', '#059669'];
    const margeKeys = ['faible', 'correct', 'bon', 'excellent'];

    destroyChart('chart-marges');
    charts['chart-marges'] = new Chart($('chart-marges'), {
      type: 'doughnut',
      data: {
        labels: margeKeys.map(k => margeLabels[k]),
        datasets: [{
          data: margeKeys.map(k => marges[k] || 0),
          backgroundColor: margeColors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11 }, padding: 8 }
          }
        },
        cutout: '60%'
      }
    });
  }

  function renderTopClients(clients) {
    const el = $('top-clients-list');
    if (!clients.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Aucun client pour l\'instant</p>';
      return;
    }

    el.innerHTML = `
      <table class="mini-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Devis</th>
            <th>CA HT</th>
            <th>Marge moy.</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map((c, i) => `
            <tr>
              <td>
                <span style="background:var(--primary-light);color:var(--primary);font-weight:700;font-size:11px;padding:2px 6px;border-radius:4px;margin-right:6px">#${i + 1}</span>
                ${escapeHtml(c.name || 'Inconnu')}
              </td>
              <td>${c.nbDevis}</td>
              <td class="font-bold">${formatCurrency(c.caTotal)}</td>
              <td class="${margeClass(c.margeMoyenne)}">${Math.round(c.margeMoyenne || 0)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderRecentDevis(devis) {
    const el = $('recent-devis-list');
    if (!devis.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Aucun devis pour l\'instant</p>';
      return;
    }

    el.innerHTML = `
      <table class="mini-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Client</th>
            <th>Total TTC</th>
            <th>Marge</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${devis.map(d => `
            <tr style="cursor:pointer" onclick="History.openDevis(${d.id})">
              <td class="font-mono" style="font-size:12px">${escapeHtml(d.numero)}</td>
              <td>${escapeHtml(d.client_name || '')}</td>
              <td class="font-bold">${formatCurrency(d.total_ttc)}</td>
              <td class="${margeClass(d.taux_marge)}">${Math.round(d.taux_marge || 0)}%</td>
              <td>${badgeHtml(d.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  // ---- Helpers ----
  function formatCurrency(val) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val || 0);
  }

  function formatCurrencyShort(val) {
    if (val >= 1000) return `${Math.round(val / 1000)}k€`;
    return `${Math.round(val)}€`;
  }

  function formatMonth(str) {
    if (!str) return '';
    const [y, m] = str.split('-');
    const months = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return `${months[parseInt(m)] || m}`;
  }

  function margeClass(val) {
    if (!val || val < 20) return 'marge-low';
    if (val < 30) return 'marge-ok';
    if (val < 40) return 'marge-good';
    return 'marge-excellent';
  }

  function margeLabel(val) {
    if (!val || val < 20) return 'Faible — à améliorer';
    if (val < 30) return 'Correct';
    if (val < 40) return 'Bon';
    return 'Excellent';
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

  return { init, load };
})();
