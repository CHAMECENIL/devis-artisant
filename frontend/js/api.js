/* =============================================
   API — Utilitaires de communication backend
   ============================================= */

const API = {
  BASE: '/api',

  async get(path) {
    const res = await fetch(`${this.BASE}${path}`);
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Erreur inconnue');
      throw new Error(msg);
    }
    return res.json();
  },

  async post(path, data) {
    const res = await fetch(`${this.BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Erreur inconnue');
      throw new Error(msg);
    }
    return res.json();
  },

  async patch(path, data) {
    const res = await fetch(`${this.BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Erreur inconnue');
      throw new Error(msg);
    }
    return res.json();
  },

  async delete(path) {
    const res = await fetch(`${this.BASE}${path}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Erreur inconnue');
      throw new Error(msg);
    }
    return res.json();
  },

  async upload(path, formData) {
    const res = await fetch(`${this.BASE}${path}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Erreur inconnue');
      throw new Error(msg);
    }
    return res.json();
  },

  // ---- Endpoints spécifiques ----

  // Chat
  chat: {
    send: (data) => API.post('/chat', data),
    clear: (sessionId) => API.delete(`/chat/${sessionId}`)
  },

  // Devis
  devis: {
    generate: (data) => API.post('/devis/generate', data),
    save: (data) => API.post('/devis', data),
    list: (params = '') => API.get(`/devis${params}`),
    get: (id) => API.get(`/devis/${id}`),
    updateStatus: (id, status) => API.patch(`/devis/${id}/status`, { status }),
    send: (id) => API.post(`/devis/${id}/send`, {}),
    delete: (id) => API.delete(`/devis/${id}`),
    pdfUrl: (id) => `/api/devis/${id}/pdf`,
    rentabiliteUrl: (id) => `/api/devis/${id}/rentabilite`
  },

  // Upload
  upload: {
    file: (formData) => API.upload('/upload', formData)
  },

  // History
  history: {
    get: (params = '') => API.get(`/history${params}`)
  },

  // Dashboard
  dashboard: {
    stats: () => API.get('/dashboard/stats')
  },

  // Settings
  settings: {
    get: () => API.get('/settings'),
    save: (data) => API.post('/settings', data),
    testIA: () => API.post('/settings/test-ia', {}),
    testMaps: (data) => API.post('/settings/test-distance', data)
  }
};
