/* =============================================
   APP — Routeur principal + utilitaires globaux
   ============================================= */

// ---- TOAST ----
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error', 5000),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info')
};

// ---- MODAL ----
const Modal = {
  open(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  },

  close() {
    document.getElementById('modal').style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-footer').innerHTML = '';
  },

  openPDF(devisId, numero = '') {
    const pdfUrl = `/api/devis/${devisId}/pdf`;
    const rentaUrl = `/api/devis/${devisId}/rentabilite`;

    Modal.open(
      `Devis ${numero || '#' + devisId}`,
      `<iframe src="${pdfUrl}" title="Devis PDF"></iframe>`,
      `
        <a class="btn btn-outline" href="${pdfUrl}" target="_blank" download>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Télécharger PDF
        </a>
        <a class="btn btn-outline" href="${rentaUrl}" target="_blank">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Fiche rentabilité
        </a>
        <button class="btn btn-primary" onclick="sendDevis(${devisId})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Envoyer au client
        </button>
      `
    );
  }
};

// ---- GLOBAL sendDevis ----
async function sendDevis(id) {
  if (!confirm('Envoyer ce devis par email au client ?')) return;
  try {
    await API.devis.send(id);
    Toast.success('Devis envoyé au client');
    Modal.close();
    History.load();
  } catch (err) {
    Toast.error(`Erreur d'envoi : ${err.message}`);
  }
}

// ---- ROUTER ----
const App = {
  currentSection: 'chat',
  initialized: {},

  navigate(section) {
    // Masquer toutes les sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Afficher la section cible
    const sectionEl = document.getElementById(`section-${section}`);
    const navEl = document.querySelector(`.nav-item[data-section="${section}"]`);

    if (!sectionEl) return;

    sectionEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    this.currentSection = section;

    // Initialiser si première visite
    if (!this.initialized[section]) {
      this.initialized[section] = true;
      this.initSection(section);
    } else {
      // Recharger les sections à données dynamiques
      if (section === 'dashboard') Dashboard.load();
      if (section === 'history') History.load();
      if (section === 'settings') Settings.load();
    }
  },

  initSection(section) {
    switch (section) {
      case 'chat':      Chat.init(); break;
      case 'devis':     Devis.init(); break;
      case 'dashboard': Dashboard.init(); break;
      case 'history':   History.init(); break;
      case 'settings':  Settings.init(); break;
    }
  },

  init() {
    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(item.dataset.section);
      });
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', Modal.close);
    document.getElementById('modal-overlay').addEventListener('click', Modal.close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Modal.close();
    });

    // Démarrer sur chat
    this.navigate('chat');
  }
};

// ---- DÉMARRAGE ----
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
