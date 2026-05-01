/* =============================================
   ADMIN AUTH — Gestion des sessions admin
   Token distinct du token utilisateur (scope admin)
   ============================================= */

const AdminAuth = (() => {
  const API_BASE = '/api/v1';
  const KEY_TOKEN = 'adminToken';
  const KEY_ADMIN  = 'adminUser';

  // ─── Stockage ──────────────────────────────────────────────────────────────

  function getToken()      { return localStorage.getItem(KEY_TOKEN); }
  function setToken(t)     { localStorage.setItem(KEY_TOKEN, t); }
  function getAdmin()      { try { return JSON.parse(localStorage.getItem(KEY_ADMIN)); } catch { return null; } }
  function setAdmin(u)     { localStorage.setItem(KEY_ADMIN, JSON.stringify(u)); }
  function clear()         { localStorage.removeItem(KEY_TOKEN); localStorage.removeItem(KEY_ADMIN); }

  // ─── JWT utils ─────────────────────────────────────────────────────────────

  function decodeJwt(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64));
    } catch { return null; }
  }

  function tokenTTL(token) {
    const p = decodeJwt(token);
    return p?.exp ? p.exp - Math.floor(Date.now() / 1000) : -1;
  }

  function isAuthenticated() {
    const t = getToken();
    return !!t && tokenTTL(t) > 0;
  }

  // ─── Requête authentifiée ──────────────────────────────────────────────────

  async function fetchAdmin(url, options = {}) {
    const t = getToken();
    if (!t) { redirectToLogin(); throw new Error('NOT_AUTH'); }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${t}`,
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      clear();
      redirectToLogin('Session expirée. Reconnectez-vous.');
      throw new Error('SESSION_EXPIRED');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
    return data;
  }

  // ─── Auth flow ─────────────────────────────────────────────────────────────

  /** Étape 1 : email + password → tempToken */
  async function login(email, password) {
    const res = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.message || 'Identifiants invalides'), { status: res.status });
    return data; // { tempToken }
  }

  /** Étape 2 : tempToken + code OTP → accessToken admin */
  async function verify2fa(tempToken, code) {
    const res = await fetch(`${API_BASE}/admin/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code }),
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.message || 'Code invalide'), { status: res.status });

    setToken(data.accessToken);
    if (data.admin) setAdmin(data.admin);
    return data;
  }

  async function logout() {
    try {
      const t = getToken();
      if (t) {
        await fetch(`${API_BASE}/admin/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}` },
        });
      }
    } finally {
      clear();
      window.location.replace('/admin-login.html');
    }
  }

  // ─── Guards ────────────────────────────────────────────────────────────────

  function redirectToLogin(msg) {
    const url = msg
      ? `/admin-login.html?msg=${encodeURIComponent(msg)}`
      : '/admin-login.html';
    window.location.replace(url);
  }

  /** À appeler en haut de admin.html */
  function requireAuth() {
    const t = getToken();
    if (!t) { redirectToLogin(); return; }
    if (tokenTTL(t) <= 0) { clear(); redirectToLogin('Session expirée.'); }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    getToken, getAdmin,
    decodeJwt, tokenTTL, isAuthenticated,
    login, verify2fa, logout,
    fetchAdmin, requireAuth, redirectToLogin, clear,
  };
})();

window.AdminAuth = AdminAuth;
