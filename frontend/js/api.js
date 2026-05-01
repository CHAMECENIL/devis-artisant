/* =============================================
   API — Client HTTP centralisé
   Authentifié via JWT Bearer (Auth.js requis)
   ============================================= */

const API = {
  async _fetch(url, options = {}) {
    // Injection automatique du token Bearer
    const token = (typeof Auth !== 'undefined') ? Auth.getAccessToken() : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    let res = await fetch(url, { ...options, headers });

    // Token expiré (401) → refresh puis 1 retry
    if (res.status === 401 && typeof Auth !== 'undefined') {
      try {
        const newToken = await Auth.refreshTokens();
        res = await fetch(url, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
        });
      } catch {
        // Refresh impossible → retour login
        Auth.redirectToLogin('Session expirée. Veuillez vous reconnecter.');
        throw new Error('SESSION_EXPIRED');
      }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
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
    rentabiliteUrl: (id) => `/api/devis/${id}/rentabilite`,
    listeAchatsUrl: (id) => `/api/devis/${id}/liste-achats`
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
  },

  // ── Admin (token admin distinct — utilise AdminAuth) ──────────────────────
  admin: {
    _fetch: (url, opts = {}) => {
      if (typeof AdminAuth === 'undefined') throw new Error('AdminAuth non chargé');
      return AdminAuth.fetchAdmin(`/api/v1${url}`, opts);
    },
    _post: (url, body) => API.admin._fetch(url, { method: 'POST', body: JSON.stringify(body) }),
    _patch: (url, body) => API.admin._fetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
    _delete: (url) => API.admin._fetch(url, { method: 'DELETE' }),

    // Platform
    dashboard: () => API.admin._fetch('/admin/dashboard'),
    auditLogs: (params = '') => API.admin._fetch(`/admin/audit-logs${params}`),

    // Tenants
    tenants: {
      list:     (params = '') => API.admin._fetch(`/admin/tenants${params}`),
      stats:    () => API.admin._fetch('/admin/tenants/stats'),
      get:      (id) => API.admin._fetch(`/admin/tenants/${id}`),
      create:   (body) => API.admin._post('/admin/tenants', body),
      update:   (id, body) => API.admin._patch(`/admin/tenants/${id}`, body),
      delete:   (id) => API.admin._delete(`/admin/tenants/${id}`),
      suspend:  (id, reason) => API.admin._post(`/admin/tenants/${id}/suspend`, { reason }),
      reactivate: (id) => API.admin._post(`/admin/tenants/${id}/reactivate`, {}),
      resendValidation: (id) => API.admin._post(`/admin/tenants/${id}/resend-validation`, {}),
      resetPassword: (id, sendByEmail) => API.admin._post(`/admin/tenants/${id}/reset-password`, { sendByEmail }),
      impersonate: (id, adminId) => API.admin._post(`/admin/tenants/${id}/impersonate`, { adminId }),
      updatePlan: (id, planId, billingCycle) => API.admin._patch(`/admin/tenants/${id}/plan`, { planId, billingCycle }),
    },
  }
};
