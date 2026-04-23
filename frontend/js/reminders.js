/* =============================================
   REMINDERS — Gestion des templates de relance
   ============================================= */

const Reminders = (() => {
  let templates = [];

  async function init() {
    await load();
  }

  async function load() {
    try {
      templates = await API.reminders.getTemplates();
      render();
    } catch (err) {
      console.error('Erreur templates relances:', err.message);
    }
  }

  function render() {
    const container = document.getElementById('reminders-container');
    if (!container) return;

    container.innerHTML = templates.map(t => `
      <div class="reminder-card card" id="reminder-${t.id}">
        <div class="reminder-header">
          <div>
            <span class="reminder-label">${esc(t.label)}</span>
            <span class="reminder-delay">Délai par défaut : ${t.delay_days} jours</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${t.enabled ? 'checked' : ''} onchange="Reminders.toggleEnabled(${t.id}, this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="form-group">
          <label>Objet de l'email</label>
          <input type="text" id="reminder-subject-${t.id}" value="${esc(t.subject)}" class="reminder-subject-input">
        </div>
        <div class="form-group">
          <label>Corps du message
            <span class="template-vars">Variables : {{client_name}}, {{numero}}, {{total_ttc}}, {{company_name}}, {{signature_link}}, {{acompte_amount}}</span>
          </label>
          <textarea id="reminder-body-${t.id}" rows="5" class="reminder-body-input">${esc(t.body)}</textarea>
        </div>
        <div class="form-group reminder-actions">
          <div style="display:flex;gap:8px;align-items:center">
            <label style="font-size:12px">Délai (j) :</label>
            <input type="number" id="reminder-delay-${t.id}" value="${t.delay_days}" min="1" max="90" style="width:70px">
          </div>
          <button class="btn btn-primary btn-sm" onclick="Reminders.save(${t.id})">Sauvegarder</button>
        </div>
      </div>
    `).join('');
  }

  async function save(id) {
    const subject = document.getElementById(`reminder-subject-${id}`)?.value || '';
    const body = document.getElementById(`reminder-body-${id}`)?.value || '';
    const delay = parseInt(document.getElementById(`reminder-delay-${id}`)?.value || '3');
    const t = templates.find(t => t.id === id);
    if (!t) return;
    try {
      await API.reminders.updateTemplate(id, { subject, body, enabled: t.enabled, delay_days: delay });
      Toast.success('Template sauvegardé');
      await load();
    } catch (err) { Toast.error(err.message); }
  }

  async function toggleEnabled(id, enabled) {
    const t = templates.find(t => t.id === id);
    if (!t) return;
    try {
      await API.reminders.updateTemplate(id, { ...t, enabled });
      t.enabled = enabled;
    } catch (err) { Toast.error(err.message); }
  }

  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return { init, load, save, toggleEnabled };
})();
