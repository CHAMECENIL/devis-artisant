/* =============================================
   APP — Router SPA + init globale
   ============================================= */

(function () {
  const sections = ['chat', 'devis', 'dashboard', 'history', 'kanban', 'reminders', 'settings'];
  let current = 'chat';

  function navigate(section) {
    if (!sections.includes(section)) section = 'chat';
    current = section;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === section));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));

    // Init lazy au premier accès
    if (section === 'dashboard' && typeof Dashboard !== 'undefined') Dashboard.load();
    if (section === 'history' && typeof History !== 'undefined') History.load();
    if (section === 'kanban' && typeof Kanban !== 'undefined') Kanban.load();
    if (section === 'reminders' && typeof Reminders !== 'undefined') Reminders.load();
  }

  // Expose App globally
  window.App = { navigate };

  // Navigation sidebar
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.section));
  });

  // =====================
  // MODAL
  // =====================
  const Modal = window.Modal = {
    open(title, bodyHtml, footerHtml = '') {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = bodyHtml;
      document.getElementById('modal-footer').innerHTML = footerHtml;
      document.getElementById('modal').style.display = 'flex';
    },
    close() { document.getElementById('modal').style.display = 'none'; },
    openPDF(devisId) {
      const url = API.devis.pdfUrl(devisId);
      Modal.open('Aperçu du devis',
        `<iframe src="${url}" style="width:100%;height:65vh;border:none;border-radius:6px"></iframe>`,
        `<a href="${url}" target="_blank" class="btn btn-primary btn-sm">Télécharger PDF</a>
         <a href="${API.devis.rentabiliteUrl(devisId)}" target="_blank" class="btn btn-outline btn-sm">Fiche rentabilité</a>
         <button class="btn btn-outline btn-sm" onclick="Modal.close()">Fermer</button>`
      );
    }
  };

  document.getElementById('modal-close')?.addEventListener('click', Modal.close);
  document.getElementById('modal-overlay')?.addEventListener('click', Modal.close);

  // =====================
  // TOAST
  // =====================
  const Toast = window.Toast = {
    show(msg, type = 'info', duration = 4000) {
      const container = document.getElementById('toast-container');
      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.innerHTML = msg;
      container.appendChild(el);
      setTimeout(() => el.classList.add('show'), 10);
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, duration);
    },
    success: (m) => Toast.show(m, 'success'),
    error: (m) => Toast.show(m, 'error'),
    info: (m) => Toast.show(m, 'info'),
    warning: (m) => Toast.show(m, 'warning')
  };

  // =====================
  // STATUS SIDEBAR
  // =====================
  async function checkStatus() {
    const statusEl = document.getElementById('sidebar-status');
    const indicatorEl = document.querySelector('.status-indicator');
    if (!statusEl && !indicatorEl) return; // éléments supprimés (nouveau layout)
    try {
      await fetch('/api/settings');
      if (statusEl) statusEl.textContent = 'Prêt';
      if (indicatorEl) indicatorEl.style.background = '#22c55e';
    } catch {
      if (statusEl) statusEl.textContent = 'Hors ligne';
      if (indicatorEl) indicatorEl.style.background = '#ef4444';
    }
  }

  // =====================
  // INIT
  // =====================
  document.addEventListener('DOMContentLoaded', () => {
    Chat.init();
    Devis.init();
    Dashboard.init();
    History.init();
    Kanban.init();
    Reminders.init();
    Settings.init();
    checkStatus();
    navigate('chat');
  });
})();
