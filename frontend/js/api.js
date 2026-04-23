/* =============================================
   API — Client HTTP centralisé
   ============================================= */

const API = {
  async _fetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  chat: {
    send: (body) => API._fetch('/api/chat', { method: 'POST', body: JSON.stringify(body) }),
    deleteSession: (sid) => API._fetch(`/api/chat/${sid}`, { method: 'DELETE' })
  },

  devis: {
    generate: (body) => API._fetch('/api/devis/generate', { method: 'POST', body: JSON.stringify(body) }),
    save: (body) => API._fetch('/api/devis', { method: 'POST', body: JSON.stringify(body) }),
    list: (params = '') => API._fetch(`/api/devis${params}`),
    get: (id) => API._fetch(`/api/devis/${id}`),
    updateStatus: (id, status) => API._fetch(`/api/devis/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    send: (id) => API._fetch(`/api/devis/${id}/send`, { method: 'POST' }),
    delete: (id) => API._fetch(`/api/devis/${id}`, { method: 'DELETE' }),
    pdfUrl: (id) => `/api/devis/${id}/pdf`,
    rentabiliteUrl: (id) => `/api/devis/${id}/rentabilite`
  },

  signature: {
    send: (id) => API._fetch(`/api/signature/${id}/send`, { method: 'POST' }),
    sign: (token, body) => API._fetch(`/api/signature/sign/${token}`, { method: 'POST', body: JSON.stringify(body) })
  },

  reminders: {
    getTemplates: () => API._fetch('/api/reminders/templates'),
    updateTemplate: (id, body) => API._fetch(`/api/reminders/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    send: (devisId, type) => API._fetch('/api/reminders/send', { method: 'POST', body: JSON.stringify({ devisId, type }) }),
    getLog: (devisId) => API._fetch(`/api/reminders/log/${devisId}`)
  },

  kanban: {
    get: () => API._fetch('/api/kanban'),
    move: (id, stage) => API._fetch(`/api/kanban/${id}/move`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
    acompte: (id, amount) => API._fetch(`/api/kanban/${id}/acompte`, { method: 'POST', body: JSON.stringify({ amount }) })
  },

  history: {
    get: (params = '') => API._fetch(`/api/history${params}`)
  },

  dashboard: {
    stats: () => API._fetch('/api/dashboard/stats')
  },

  settings: {
    get: () => API._fetch('/api/settings'),
    save: (body) => API._fetch('/api/settings', { method: 'POST', body: JSON.stringify(body) }),
    testIA: () => API._fetch('/api/settings/test-ia', { method: 'POST' }),
    testMaps: (body) => API._fetch('/api/settings/test-distance', { method: 'POST', body: JSON.stringify(body) })
  }
};
