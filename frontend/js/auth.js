/* =============================================
   AUTH.JS — Gestionnaire d'authentification
   Flux complet : login, refresh, logout, verify
   ============================================= */

const API_BASE = 'http://localhost:3001/api/v1';

const Auth = (() => {

  // ─────────────────────────────────────────────
  // STOCKAGE DES TOKENS
  // ─────────────────────────────────────────────

  const KEYS = {
    ACCESS:  'accessToken',
    REFRESH: 'refreshToken',
    USER:    'user',
    TENANT:  'tenant',
  };

  function store(accessToken, refreshToken, user, tenant) {
    localStorage.setItem(KEYS.ACCESS,  accessToken);
    localStorage.setItem(KEYS.REFRESH, refreshToken);
    if (user)   localStorage.setItem(KEYS.USER,   JSON.stringify(user));
    if (tenant) localStorage.setItem(KEYS.TENANT, JSON.stringify(tenant));
  }

  function clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  function getAccessToken()  { return localStorage.getItem(KEYS.ACCESS);  }
  function getRefreshToken() { return localStorage.getItem(KEYS.REFRESH); }
  function getCurrentUser()  {
    try { return JSON.parse(localStorage.getItem(KEYS.USER)); } catch { return null; }
  }
  function getCurrentTenant() {
    try { return JSON.parse(localStorage.getItem(KEYS.TENANT)); } catch { return null; }
  }

  // ─────────────────────────────────────────────
  // DÉCODAGE JWT (sans librairie)
  // ─────────────────────────────────────────────

  function decodeJwt(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64));
    } catch { return null; }
  }

  /** Renvoie les secondes restantes avant expiration (négatif = expiré) */
  function tokenTTL(token) {
    const payload = decodeJwt(token);
    if (!payload?.exp) return -1;
    return payload.exp - Math.floor(Date.now() / 1000);
  }

  /** True si le token existe et n'est pas expiré */
  function isAuthenticated() {
    const token = getAccessToken();
    if (!token) return false;
    return tokenTTL(token) > 0;
  }

  // ─────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────

  let _refreshPromise = null; // évite les rafraîchissements parallèles

  async function refreshTokens() {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Session compromise ou refresh expiré → forcer reconnexion
        clear();
        throw new Error(data.message || 'SESSION_EXPIRED');
      }

      // Mettre à jour uniquement les tokens (user/tenant restent les mêmes)
      localStorage.setItem(KEYS.ACCESS,  data.accessToken);
      localStorage.setItem(KEYS.REFRESH, data.refreshToken);

      return data.accessToken;
    })().finally(() => { _refreshPromise = null; });

    return _refreshPromise;
  }

  // ─────────────────────────────────────────────
  // FETCH AUTHENTIFIÉ (avec auto-refresh)
  // ─────────────────────────────────────────────

  async function fetchAuth(url, options = {}) {
    let token = getAccessToken();

    // Si le token expire dans moins de 60s → rafraîchir proactivement
    if (token && tokenTTL(token) < 60) {
      try { token = await refreshTokens(); }
      catch (err) {
        redirectToLogin('Session expirée. Veuillez vous reconnecter.');
        throw err;
      }
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    // Token invalide côté serveur → tenter refresh puis réessayer
    if (res.status === 401) {
      try {
        token = await refreshTokens();
        const retry = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        });
        return retry;
      } catch {
        redirectToLogin('Session expirée. Veuillez vous reconnecter.');
        throw new Error('UNAUTHORIZED');
      }
    }

    return res;
  }

  // ─────────────────────────────────────────────
  // CONNEXION
  // ─────────────────────────────────────────────

  async function login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const error = new Error(data.message || `Erreur ${res.status}`);
      error.status = res.status;
      error.code   = data.code || null;
      error.data   = data;
      throw error;
    }

    store(data.accessToken, data.refreshToken, data.user, data.tenant);
    return data;
  }

  // ─────────────────────────────────────────────
  // DÉCONNEXION
  // ─────────────────────────────────────────────

  async function logout() {
    const refreshToken = getRefreshToken();
    const accessToken  = getAccessToken();

    if (refreshToken && accessToken) {
      try {
        await fetch(`${API_BASE}/auth/déconnexion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch { /* on efface quand même */ }
    }

    clear();
    window.location.replace('/login.html');
  }

  // ─────────────────────────────────────────────
  // VÉRIFICATION EMAIL
  // ─────────────────────────────────────────────

  async function verifyEmail(token) {
    const res = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (!res.ok) {
      const error = new Error(data.message || `Erreur ${res.status}`);
      error.status = res.status;
      throw error;
    }

    // L'API retourne directement les tokens après vérification
    store(data.accessToken, data.refreshToken, data.user, data.tenant);
    return data;
  }

  // ─────────────────────────────────────────────
  // RENVOI EMAIL DE VÉRIFICATION
  // ─────────────────────────────────────────────

  async function resendVerification(email) {
    const res = await fetch(`${API_BASE}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    return data;
  }

  // ─────────────────────────────────────────────
  // MOT DE PASSE OUBLIÉ
  // ─────────────────────────────────────────────

  async function forgotPassword(email) {
    const res = await fetch(`${API_BASE}/auth/mot-de-passe-oublié`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    return data;
  }

  // ─────────────────────────────────────────────
  // RÉINITIALISATION MOT DE PASSE
  // ─────────────────────────────────────────────

  async function resetPassword(token, newPassword) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    return data;
  }

  // ─────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────

  function redirectToLogin(message) {
    const url = message
      ? `/login.html?info=${encodeURIComponent(message)}`
      : '/login.html';
    window.location.replace(url);
  }

  function requireAuth() {
    if (!getAccessToken()) {
      redirectToLogin();
      return false;
    }
    // Si expiré → tenter refresh en arrière-plan
    if (tokenTTL(getAccessToken()) <= 0) {
      refreshTokens().catch(() => redirectToLogin('Session expirée. Veuillez vous reconnecter.'));
    }
    return true;
  }

  // ─────────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────────

  return {
    // Tokens
    store,
    clear,
    getAccessToken,
    getRefreshToken,
    getCurrentUser,
    getCurrentTenant,
    decodeJwt,
    tokenTTL,
    isAuthenticated,

    // Actions
    login,
    logout,
    refreshTokens,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,

    // Navigation
    fetchAuth,
    redirectToLogin,
    requireAuth,
  };
})();

// Exposé globalement pour les pages HTML
window.Auth = Auth;
