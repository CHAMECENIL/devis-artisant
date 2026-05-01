/* =============================================
   ADMIN APP — Tous les modules
   Dashboard | Clients | API | Billing | GED | Audit
   Requiert : admin-auth.js
   ============================================= */

const AdminApp = (() => {
  const BASE = '/api/v1';

  /* ── Helpers fetch ─────────────────────────────────────────────────────── */
  const api   = (url, opts={})    => AdminAuth.fetchAdmin(`${BASE}${url}`, opts);
  const apost  = (url, body)      => api(url, { method:'POST',   body:JSON.stringify(body) });
  const apatch = (url, body)      => api(url, { method:'PATCH',  body:JSON.stringify(body) });
  const adel   = (url)            => api(url, { method:'DELETE' });

  /** Variante sans redirection sur 401 — pour les endpoints optionnels */
  async function safeApi(url, opts={}) {
    const t = AdminAuth.getToken();
    if (!t) return null;
    try {
      const res = await fetch(`${BASE}${url}`, {
        ...opts,
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${t}`, ...opts.headers },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  /* ── $ helper ──────────────────────────────────────────────────────────── */
  const $  = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ── Formatters ────────────────────────────────────────────────────────── */
  const fDate  = (d) => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fDT    = (d) => d ? new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  const fMoney = (n) => n!=null ? Number(n).toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:0}) : '—';
  const fNum   = (n) => n!=null ? Number(n).toLocaleString('fr-FR') : '—';
  const esc    = (s) => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';

  const statusBadge = (s) => {
    const m = { active:['Actif','bg-g'], trial:['Essai','bg-b'], suspended:['Suspendu','bg-r'], cancelled:['Résilié','bg-grey'], pending:['En attente','bg-y'] };
    const [l,c] = m[s] || [s,'bg-grey'];
    return `<span class="badge ${c}">${l}</span>`;
  };
  const planBadge = (p) => {
    if (!p) return '<span class="badge bg-grey">—</span>';
    const cls = p.toLowerCase().includes('gold') ? 'plan-gold' : p.toLowerCase().includes('silver') ? 'plan-silver' : p.toLowerCase().includes('bronze') ? 'plan-bronze' : 'bg-p';
    return `<span class="badge ${cls}">${esc(p)}</span>`;
  };
  const payBadge = (s) => {
    const m = { paid:['Payé','bg-g'], pending:['En attente','bg-y'], failed:['Échoué','bg-r'], refunded:['Remboursé','bg-b'] };
    const [l,c] = m[s] || [s,'bg-grey'];
    return `<span class="badge ${c}">${l}</span>`;
  };
  const boolBadge = (v, yes='Oui', no='Non') =>
    v ? `<span class="badge bg-g">${yes}</span>` : `<span class="badge bg-r">${no}</span>`;

  /* ═══════════════════════════════════════════════════════════════
     TOAST
  ═══════════════════════════════════════════════════════════════ */
  const Toast = {
    show(msg, type='i', duration=4000) {
      const box = $('at-box');
      const el = document.createElement('div');
      el.className = `at at-${type}`;
      el.textContent = msg;
      box.appendChild(el);
      setTimeout(() => el.classList.add('show'), 10);
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, duration);
    },
    s: (m, d) => Toast.show(m,'s', d),
    e: (m, d) => Toast.show(m,'e', d),
    i: (m, d) => Toast.show(m,'i', d),
    w: (m, d) => Toast.show(m,'w', d),
  };

  /* ═══════════════════════════════════════════════════════════════
     MODAL
  ═══════════════════════════════════════════════════════════════ */
  const Modal = {
    open(title, body, footer='') {
      $('am-title').innerHTML = title;
      $('am-body').innerHTML  = body;
      $('am-foot').innerHTML  = footer;
      $('am').style.display   = 'flex';
    },
    close() { $('am').style.display = 'none'; },
  };
  $('am-close')?.addEventListener('click', Modal.close);
  $('am-ov')?.addEventListener('click', Modal.close);

  /* ═══════════════════════════════════════════════════════════════
     DRAWER — Fiche client complète
  ═══════════════════════════════════════════════════════════════ */
  const Drawer = (() => {
    let currentId   = null;
    let currentData = null;
    let activeTab   = 'profil';

    function open(id) {
      currentId = id;
      $('a-drawer-ov').style.display = 'block';
      $('a-drawer').classList.add('open');
      loadClient(id);
    }

    function close() {
      $('a-drawer').classList.remove('open');
      $('a-drawer-ov').style.display = 'none';
      currentId = null; currentData = null;
    }

    async function loadClient(id) {
      $('dr-body').innerHTML = '<div class="a-ld">Chargement…</div>';
      try {
        const t = await api(`/admin/tenants/${id}`);
        currentData = t;
        $('dr-title').textContent   = t.companyName || t.name || '—';
        $('dr-subtitle').textContent = t.ownerEmail || '';
        $('dr-status-badge').innerHTML = statusBadge(t.status);
        renderTab(activeTab);
      } catch(err) {
        $('dr-body').innerHTML = `<div class="a-er">Erreur : ${esc(err.message)}</div>`;
      }
    }

    function renderTab(tab) {
      activeTab = tab;
      $$('#dr-tabs .dr-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      const t = currentData || {};
      switch(tab) {
        case 'profil':      $('dr-body').innerHTML = renderProfil(t);      break;
        case 'acces':       $('dr-body').innerHTML = renderAcces(t);       bindAccesEvents(t); break;
        case 'facturation': $('dr-body').innerHTML = renderFacturation(t); bindFacturationEvents(t); break;
        case 'documents':   $('dr-body').innerHTML = renderDocuments(t);   bindDocEvents(t);   break;
        case 'activite':    $('dr-body').innerHTML = renderActivite(t);    loadActivite(t);    break;
      }
    }

    // ── Onglet Profil ─────────────────────────────────────────────────────
    function renderProfil(t) {
      return `
      <div class="dr-section-title">Informations entreprise</div>
      <div class="dr-grid2">
        <div class="fg"><label>Nom de l'entreprise</label>
          <input id="dr-company" value="${esc(t.companyName||t.name||'')}"></div>
        <div class="fg"><label>SIREN / SIRET</label>
          <input id="dr-siren" value="${esc(t.companySiret||t.siret||t.siren||'')}"></div>
        <div class="fg"><label>Email (owner)</label>
          <input id="dr-email" type="email" value="${esc(t.ownerEmail||t.email||'')}"></div>
        <div class="fg"><label>Téléphone</label>
          <input id="dr-phone" value="${esc(t.phone||'')}"></div>
        <div class="fg fg-full"><label>Adresse</label>
          <input id="dr-address" value="${esc(t.address||'')}"></div>
      </div>
      <div class="dr-section-title">Contact référent</div>
      <div class="dr-grid2">
        <div class="fg"><label>Prénom</label>
          <input id="dr-firstname" value="${esc(t.ownerFirstName||t.firstName||'')}"></div>
        <div class="fg"><label>Nom</label>
          <input id="dr-lastname" value="${esc(t.ownerLastName||t.lastName||'')}"></div>
      </div>
      <div class="dr-section-title">Dates</div>
      <div class="dr-grid3">
        <div class="fg"><label>Date souscription</label>
          <input id="dr-sub-date" type="date" value="${t.createdAt ? t.createdAt.substring(0,10) : ''}"></div>
        <div class="fg"><label>Date résiliation</label>
          <input id="dr-end-date" type="date" value="${t.cancelledAt||t.canceledAt ? (t.cancelledAt||t.canceledAt).substring(0,10) : ''}"></div>
        <div class="fg"><label>Fin période d'essai</label>
          <input id="dr-trial-end" type="date" value="${t.trialEndsAt||t.trialEndDate ? (t.trialEndsAt||t.trialEndDate).substring(0,10) : ''}"></div>
      </div>`;
    }

    // ── Onglet Accès & Sécurité ──────────────────────────────────────────
    function renderAcces(t) {
      const tokenUsed = t.tokenUsage || t.aiTokensUsed || 0;
      const tokenMax  = t.tokenLimit || t.aiTokensLimit || 100000;
      const tokenPct  = Math.min(100, Math.round(tokenUsed / Math.max(tokenMax, 1) * 100));
      return `
      <div class="dr-section-title">Statut du compte</div>
      <div class="dr-row"><span class="dr-row-lbl">Statut actif</span><span>${statusBadge(t.status)}</span></div>
      <div class="dr-row"><span class="dr-row-lbl">Email validé</span><span>${boolBadge(t.emailVerified||t.isEmailVerified,'Validé','Non validé')}</span></div>
      <div class="dr-row"><span class="dr-row-lbl">Créé le</span><span>${fDate(t.createdAt)}</span></div>
      <div class="dr-row"><span class="dr-row-lbl">Dernière connexion</span><span>${fDT(t.lastLoginAt||t.lastLogin)}</span></div>

      <div class="dr-section-title" style="margin-top:16px">Consommation tokens IA</div>
      <div class="dr-row"><span class="dr-row-lbl">Utilisés / Limite</span>
        <span style="font-weight:600">${fNum(tokenUsed)} / ${fNum(tokenMax)}</span></div>
      <div class="token-bar"><div class="token-fill" style="width:${tokenPct}%"></div></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${tokenPct}% de la limite mensuelle</div>

      <div class="dr-section-title" style="margin-top:16px">Historique validation email</div>
      <div id="validation-hist">
        ${(t.validationHistory||[]).length
          ? (t.validationHistory||[]).map(h=>`
            <div class="hist-item">
              <div class="hist-dot" style="background:${h.success?'var(--ok)':'var(--err)'}"></div>
              <div>
                <div class="hist-txt">${h.success?'Email de validation envoyé':'Envoi échoué'}</div>
                <div class="hist-date">${fDT(h.sentAt||h.createdAt)}</div>
              </div>
            </div>`).join('')
          : '<div style="color:var(--dim);font-size:12px;padding:8px 0">Aucun historique</div>'
        }
      </div>

      <div class="dr-section-title" style="margin-top:16px">Actions sécurité</div>
      <div class="dr-actions">
        <button class="btn btn-sec" id="btn-resend-validation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Renvoyer lien de validation
        </button>
        <button class="btn btn-sec" id="btn-gen-temp-password">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Générer mot de passe temporaire
        </button>
        <div id="temp-password-display" style="display:none;padding:10px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Mot de passe temporaire :</div>
          <code id="temp-pwd-value" style="font-size:16px;font-family:monospace;letter-spacing:2px;color:#86efac"></code>
          <button onclick="navigator.clipboard.writeText(document.getElementById('temp-pwd-value').textContent).then(()=>Toast.s('Copié !'))"
                  style="background:none;border:none;cursor:pointer;color:var(--ap-l);font-size:11px;margin-left:10px">Copier</button>
        </div>
        <button class="btn btn-sec" id="btn-send-temp-password" style="display:none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Envoyer le MDP par email
        </button>
        ${t.status === 'suspended'
          ? `<button class="btn btn-ok" id="btn-reactivate">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
               Réactiver le compte
             </button>`
          : `<button class="btn btn-red" id="btn-suspend">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
               Suspendre le compte
             </button>`
        }
      </div>`;
    }

    function bindAccesEvents(t) {
      const id = currentId;
      $('btn-resend-validation')?.addEventListener('click', async () => {
        try { await apost(`/admin/tenants/${id}/resend-validation`, {}); Toast.s('Email renvoyé'); loadClient(id); }
        catch(err) { Toast.e(err.message); }
      });
      $('btn-gen-temp-password')?.addEventListener('click', async () => {
        try {
          const d = await apost(`/admin/tenants/${id}/reset-password`, { sendByEmail: false });
          const pwd = d.tempPassword || d.password || d.temp_password;
          if (pwd) {
            $('temp-pwd-value').textContent = pwd;
            $('temp-password-display').style.display = 'block';
            $('btn-send-temp-password').style.display = 'flex';
          } else { Toast.i('Mot de passe réinitialisé (envoyé par email)'); }
        } catch(err) { Toast.e(err.message); }
      });
      $('btn-send-temp-password')?.addEventListener('click', async () => {
        try { await apost(`/admin/tenants/${id}/reset-password`, { sendByEmail: true }); Toast.s('MDP temporaire envoyé par email'); }
        catch(err) { Toast.e(err.message); }
      });
      $('btn-suspend')?.addEventListener('click', async () => {
        const reason = prompt('Raison de la suspension (obligatoire) :');
        if (!reason) return;
        try { await apost(`/admin/tenants/${id}/suspend`, { reason }); Toast.s('Compte suspendu'); loadClient(id); Clients.reload(); }
        catch(err) { Toast.e(err.message); }
      });
      $('btn-reactivate')?.addEventListener('click', async () => {
        if (!confirm('Réactiver ce compte ?')) return;
        try { await apost(`/admin/tenants/${id}/reactivate`, {}); Toast.s('Compte réactivé'); loadClient(id); Clients.reload(); }
        catch(err) { Toast.e(err.message); }
      });
    }

    // ── Onglet Facturation ──────────────────────────────────────────────
    function renderFacturation(t) {
      const iban = t.iban || t.bankIban || '';
      const ibanMasked = iban ? iban.slice(0,4) + ' •••• •••• ' + iban.slice(-4) : '—';
      return `
      <div class="dr-section-title">Plan &amp; Abonnement</div>
      <div class="dr-grid2">
        <div class="fg"><label>Plan actuel</label>
          <select id="dr-plan">
            ${['trial','bronze','silver','gold'].map(p =>
              `<option value="${p}" ${(t.plan||t.planName||'').toLowerCase()===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="fg"><label>Cycle de facturation</label>
          <select id="dr-billing-cycle">
            <option value="monthly" ${(t.billingCycle||'monthly')==='monthly'?'selected':''}>Mensuel</option>
            <option value="annual"  ${(t.billingCycle||'')==='annual' ?'selected':''}>Annuel</option>
          </select>
        </div>
      </div>
      <button class="btn btn-pri" id="btn-update-plan" style="margin-bottom:16px">Mettre à jour le plan</button>

      <div class="dr-section-title">Coordonnées bancaires</div>
      <div class="dr-grid2">
        <div class="fg"><label>IBAN</label>
          <input id="dr-iban" placeholder="FR76 •••• •••• •••• •••• •••• •••" value="${esc(iban)}"></div>
        <div class="fg"><label>BIC / SWIFT</label>
          <input id="dr-bic" value="${esc(t.bic||t.bankBic||'')}"></div>
        <div class="fg"><label>Titulaire du compte</label>
          <input id="dr-bank-holder" value="${esc(t.bankHolder||t.companyName||'')}"></div>
        <div class="fg"><label>Nom de la banque</label>
          <input id="dr-bank-name" value="${esc(t.bankName||'')}"></div>
      </div>
      <div class="dr-row" style="margin-bottom:8px"><span class="dr-row-lbl">IBAN enregistré</span><span style="font-family:monospace;font-size:12px">${ibanMasked}</span></div>
      <button class="btn btn-sec" id="btn-save-banking" style="margin-bottom:16px">Enregistrer RIB/IBAN</button>

      <div class="dr-section-title">Prélèvements</div>
      <div class="dr-row"><span class="dr-row-lbl">Dernier prélèvement</span><span>${fDate(t.lastPaymentAt||t.lastPaymentDate)}</span></div>
      <div class="dr-row"><span class="dr-row-lbl">Statut dernier paiement</span><span>${payBadge(t.lastPaymentStatus||'pending')}</span></div>
      <div class="dr-row"><span class="dr-row-lbl">Prochain prélèvement</span><span>${fDate(t.nextPaymentAt||t.nextPaymentDate)}</span></div>
      <div class="dr-row"><span class="dr-row-lbl">Montant mensuel</span><span style="font-weight:600">${fMoney(t.monthlyAmount||t.planPrice)}</span></div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-ok" id="btn-validate-payment">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
          Valider prélèvement
        </button>
        <button class="btn btn-red" id="btn-manual-reminder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Relance manuelle
        </button>
        <button class="btn btn-sec" id="btn-gen-contract">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Générer contrat PDF
        </button>
      </div>
      <div id="fact-bind-result" style="margin-top:10px;font-size:12px;display:none"></div>`;
    }

    // ── Bind Facturation events ───────────────────────────────────────────
    function bindFacturationEvents(t) {
      const id = currentId;

      // Mettre à jour le plan
      $('btn-update-plan')?.addEventListener('click', async () => {
        const planId       = $('dr-plan')?.value;
        const billingCycle = $('dr-billing-cycle')?.value || 'monthly';
        try {
          await apatch(`/admin/tenants/${id}/plan`, { planId, billingCycle });
          Toast.s('Plan mis à jour');
          loadClient(id);
          Clients.reload();
        } catch(err) { Toast.e(err.message); }
      });

      // Enregistrer coordonnées bancaires
      $('btn-save-banking')?.addEventListener('click', async () => {
        const body = {};
        const v = (eid) => $(eid)?.value?.trim();
        if (v('dr-iban'))        body.iban        = v('dr-iban');
        if (v('dr-bic'))         body.bic         = v('dr-bic');
        if (v('dr-bank-holder')) body.bankHolder  = v('dr-bank-holder');
        if (v('dr-bank-name'))   body.bankName    = v('dr-bank-name');
        try {
          await apatch(`/admin/tenants/${id}`, body);
          Toast.s('Coordonnées bancaires enregistrées');
          loadClient(id);
        } catch(err) { Toast.e(err.message); }
      });

      // Valider un prélèvement manuellement
      $('btn-validate-payment')?.addEventListener('click', async () => {
        if (!confirm('Marquer le dernier prélèvement comme validé ?')) return;
        try {
          await apost(`/admin/tenants/${id}/validate-payment`, {})
            .catch(() => apatch(`/admin/tenants/${id}`, { lastPaymentStatus: 'paid' }));
          Toast.s('Prélèvement validé');
          loadClient(id);
        } catch(err) { Toast.e(err.message); }
      });

      // Relance manuelle paiement
      $('btn-manual-reminder')?.addEventListener('click', async () => {
        try {
          await apost(`/admin/tenants/${id}/payment-reminder`, {})
            .catch(() => apost('/reminders/send', { devisId: id, type: 'payment' }));
          Toast.s('Email de relance envoyé');
        } catch(err) { Toast.e(err.message); }
      });

      // Générer contrat PDF
      $('btn-gen-contract')?.addEventListener('click', async () => {
        const btn = $('btn-gen-contract');
        const res = $('fact-bind-result');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Génération…';
        try {
          const d = await apost(`/admin/tenants/${id}/generate-contract`, {})
            .catch(() => ({ pdfUrl: `/api/v1/pdf/contract/${id}` }));
          const url = d.pdfUrl || d.url;
          if (url) {
            res.style.display = 'block';
            res.innerHTML = `<a href="${url}" target="_blank" style="color:var(--ap-l)">✓ Contrat généré — Télécharger le PDF</a>`;
          } else { Toast.s('Contrat généré'); }
        } catch(err) { Toast.e(err.message); }
        finally { btn.disabled=false; btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Générer contrat PDF'; }
      });
    }

    // ── Onglet Documents ─────────────────────────────────────────────────
    function renderDocuments(t) {
      return `
      <div class="a-sec-hdr" style="margin-bottom:12px">
        <span style="font-size:13px;font-weight:600">Documents de ${esc(t.companyName||t.name||'ce client')}</span>
        <button class="btn btn-pri" id="btn-doc-upload-init">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter document
        </button>
      </div>
      <div id="dr-docs-container"><div class="a-ld">Chargement…</div></div>
      <input type="file" id="dr-file-input" style="display:none" multiple>`;
    }

    function bindDocEvents(t) {
      loadDocuments(t.id || currentId);
      $('btn-doc-upload-init')?.addEventListener('click', () => $('dr-file-input')?.click());
      $('dr-file-input')?.addEventListener('change', (e) => handleDocUpload(e, t.id || currentId));
    }

    async function loadDocuments(tenantId) {
      const el = $('dr-docs-container');
      if (!el) return;
      try {
        const data = await safeApi(`/ged?tenantId=${tenantId}`) || { data: [] };
        const docs = data.data || data.files || data || [];
        if (!docs.length) {
          el.innerHTML = `
            <div class="doc-upload-area" id="drop-zone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <div style="font-size:13px;font-weight:500">Aucun document</div>
              <div style="font-size:11px;margin-top:4px">Cliquez pour uploader</div>
            </div>`;
          $('drop-zone')?.addEventListener('click', () => $('dr-file-input')?.click());
          return;
        }
        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${docs.map(d => `
            <div class="doc-row">
              <div class="doc-ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div class="doc-info">
                <div class="doc-name">${esc(d.originalName||d.name||d.key||'Document')}</div>
                <div class="doc-meta">${esc(d.category||d.type||'—')} · ${fDate(d.createdAt||d.uploadedAt)} · ${d.size ? (d.size/1024).toFixed(0)+' Ko' : ''}</div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="ibtn ibtn-p" title="Télécharger" onclick="Drawer.downloadDoc('${esc(d.id||d.key)}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button class="ibtn ibtn-r" title="Supprimer" onclick="Drawer.deleteDoc('${esc(d.id||d.key)}','${esc(tenantId)}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>`).join('')}
          </div>`;
      } catch(err) {
        el.innerHTML = `<div class="a-er">Impossible de charger les documents</div>`;
      }
    }

    async function handleDocUpload(e, tenantId) {
      const files = e.target.files;
      if (!files || !files.length) return;
      const cat = prompt('Catégorie (contract / sepa / invoice / other) :', 'contract') || 'other';
      for (const file of files) {
        try {
          const { uploadUrl, key } = await safeApi(`/ged/upload-url?tenantId=${tenantId}&category=${cat}&filename=${encodeURIComponent(file.name)}`) || await (async () => {
            // fallback: upload via formdata
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', tenantId);
            fd.append('category', cat);
            const r = await AdminAuth.fetchAdmin(`${BASE}/ged/upload`, { method:'POST', body:fd, headers:{} });
            return r;
          });
          if (uploadUrl) {
            await fetch(uploadUrl, { method:'PUT', body:file });
          }
          Toast.s(`${file.name} uploadé`);
        } catch(err) { Toast.e(`Erreur upload ${file.name} : ${err.message}`); }
      }
      loadDocuments(tenantId);
      e.target.value = '';
    }

    async function downloadDoc(docId) {
      try {
        const d = await api(`/ged/${docId}/download-url`);
        window.open(d.url || d.downloadUrl, '_blank');
      } catch { Toast.e('Impossible de télécharger'); }
    }

    async function deleteDoc(docId, tenantId) {
      if (!confirm('Supprimer ce document définitivement ?')) return;
      try { await adel(`/ged/${docId}`); Toast.s('Document supprimé'); loadDocuments(tenantId); }
      catch(err) { Toast.e(err.message); }
    }

    // ── Onglet Activité ───────────────────────────────────────────────────
    function renderActivite(t) {
      return `<div id="activite-content"><div class="a-ld">Chargement activité…</div></div>`;
    }

    async function loadActivite(t) {
      try {
        const data = await api(`/admin/audit-logs?tenantId=${t.id}&limit=30`);
        const logs = data.data || data.logs || data || [];
        const el = $('activite-content');
        if (!el) return;
        if (!logs.length) { el.innerHTML = '<div style="color:var(--dim);padding:20px">Aucune activité enregistrée</div>'; return; }
        el.innerHTML = `
          <div class="hist-list">
            ${logs.map(l => `
            <div class="hist-item">
              <div class="hist-dot" style="background:var(--ap)"></div>
              <div>
                <div class="hist-txt"><code class="monobadge">${esc(l.action||'—')}</code></div>
                <div class="hist-date">${fDT(l.createdAt||l.timestamp)} — par ${esc(l.performedBy||l.adminEmail||'système')}</div>
                ${l.meta ? `<div style="font-size:11px;color:var(--dim);margin-top:2px">${esc(JSON.stringify(l.meta).slice(0,100))}</div>` : ''}
              </div>
            </div>`).join('')}
          </div>`;
      } catch { $('activite-content').innerHTML = '<div class="a-er">Impossible de charger l\'activité</div>'; }
    }

    // ── Save profil ───────────────────────────────────────────────────────
    async function save() {
      if (!currentId) return;
      const btn = $('dr-save-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        const body = {};
        const fv = (id) => $(id)?.value?.trim();
        if (fv('dr-company'))  body.companyName   = fv('dr-company');
        if (fv('dr-siren'))    body.siret          = fv('dr-siren');
        if (fv('dr-email'))    body.ownerEmail     = fv('dr-email');
        if (fv('dr-phone'))    body.phone          = fv('dr-phone');
        if (fv('dr-address'))  body.address        = fv('dr-address');
        if (fv('dr-firstname'))body.ownerFirstName = fv('dr-firstname');
        if (fv('dr-lastname')) body.ownerLastName  = fv('dr-lastname');
        if (fv('dr-end-date')) body.cancelledAt    = fv('dr-end-date');
        if (fv('dr-trial-end'))body.trialEndsAt    = fv('dr-trial-end');
        // Banking (si onglet facturation actif)
        if (fv('dr-iban'))     body.iban           = fv('dr-iban');
        if (fv('dr-bic'))      body.bic            = fv('dr-bic');
        if (fv('dr-bank-holder')) body.bankHolder  = fv('dr-bank-holder');
        if (fv('dr-bank-name'))   body.bankName    = fv('dr-bank-name');
        await apatch(`/admin/tenants/${currentId}`, body);
        Toast.s('Modifications enregistrées');
        Clients.reload();
        loadClient(currentId);
      } catch(err) { Toast.e(err.message); }
      finally { btn.disabled=false; btn.textContent='Enregistrer'; }
    }

    // ── Init drawer ───────────────────────────────────────────────────────
    function init() {
      $('dr-close')?.addEventListener('click', close);
      $('dr-close-btn')?.addEventListener('click', close);
      $('a-drawer-ov')?.addEventListener('click', close);
      $('dr-save-btn')?.addEventListener('click', save);
      $('dr-impersonate-btn')?.addEventListener('click', () => {
        if (!currentId) return;
        Clients.impersonate(currentId);
      });
      $('dr-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.dr-tab');
        if (tab && tab.dataset.tab) renderTab(tab.dataset.tab);
      });
    }

    return { open, close, save, downloadDoc, deleteDoc, init };
  })();

  /* ═══════════════════════════════════════════════════════════════
     DASHBOARD
  ═══════════════════════════════════════════════════════════════ */
  const Dashboard = (() => {
    let loaded = false;

    async function load(force=false) {
      if (loaded && !force) return;
      const sec = $('a-sec-dashboard');
      sec.innerHTML = '<div class="a-ld">Chargement…</div>';
      try {
        const [stats, tenantStats] = await Promise.all([
          api('/admin/dashboard').catch(()=>({})),
          api('/admin/tenants/stats').catch(()=>({})),
        ]);
        const s = { ...stats, ...tenantStats };
        loaded = true;
        sec.innerHTML = `
          <div class="kpi-grid">
            ${kpi('Tenants total',    fNum(s.totalTenants),   'ico-p', svgUsers())}
            ${kpi('Actifs',           fNum(s.activeTenants),  'ico-g', svgCheck())}
            ${kpi('MRR estimé',       fMoney(s.mrr),          'ico-b', svgMoney())}
            ${kpi('En essai',         fNum(s.trialTenants),   'ico-y', svgClock())}
            ${kpi('Suspendus',        fNum(s.suspendedTenants),'ico-r', svgBlock())}
            ${kpi('Nouveaux (mois)',  fNum(s.newThisMonth),   'ico-p', svgGrid())}
          </div>
          <div class="a-card mt24">
            <div class="a-card-hdr"><h3>Actions rapides</h3></div>
            <div class="a-card-body" style="display:flex;gap:10px;flex-wrap:wrap">
              ${qBtn('Gérer les clients','clients')}
              ${qBtn('Plans & Facturation','billing')}
              ${qBtn('GED Documents','ged')}
              ${qBtn('Journal d\'audit','audit')}
            </div>
          </div>`;
      } catch(err) {
        sec.innerHTML = `<div class="a-er">Erreur : ${esc(err.message)}</div>`;
      }
    }

    function kpi(label,val,icoClass,svg) {
      return `<div class="kpi-card"><div class="kpi-ico ${icoClass}">${svg}</div><div><div class="kpi-val">${val}</div><div class="kpi-lbl">${label}</div></div></div>`;
    }
    function qBtn(label, sec) {
      return `<button class="btn btn-sec" onclick="AdminApp.navigate('${sec}')" style="font-size:12.5px">${label}</button>`;
    }
    const svgUsers = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    const svgCheck = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    const svgMoney = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    const svgClock = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const svgBlock = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
    const svgGrid  = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;

    return { load };
  })();

  /* ═══════════════════════════════════════════════════════════════
     CLIENTS
  ═══════════════════════════════════════════════════════════════ */
  const Clients = (() => {
    let page=1, total=1, loading=false;
    let search='', fStatus='', fPlan='', fValid='';

    async function load(reset=true) {
      if (loading) return;
      if (reset) page=1;
      loading=true;
      const tbody = $('cl-tbody');
      tbody.innerHTML = '<tr><td colspan="8" class="t-empty">Chargement…</td></tr>';
      try {
        const p = new URLSearchParams({ page, limit:25 });
        if (search)  p.set('search', search);
        if (fStatus) p.set('status', fStatus);
        if (fPlan)   p.set('plan', fPlan);
        if (fValid)  p.set('emailVerified', fValid);
        const data = await api(`/admin/tenants?${p}`);
        const list = data.data || data.tenants || data || [];
        total = data.meta?.totalPages || data.totalPages || 1;
        renderTable(list);
        renderPages('cl-pages', page, total, (n)=>{ page=n; load(false); });
      } catch(err) {
        tbody.innerHTML = `<tr><td colspan="8" class="t-empty" style="color:#fca5a5">Erreur : ${esc(err.message)}</td></tr>`;
      } finally { loading=false; }
    }

    function reload() { load(false); }

    function renderTable(list) {
      const tbody = $('cl-tbody');
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="t-empty">Aucun client trouvé</td></tr>'; return; }
      tbody.innerHTML = list.map(t => `
        <tr>
          <td>
            <div class="t-cell-main">${esc(t.companyName||t.name||'—')}</div>
            <div class="t-cell-sub">${esc(t.ownerEmail||t.email||'')}</div>
          </td>
          <td style="font-family:monospace;font-size:11.5px">${esc(t.companySiret||t.siret||t.siren||'—')}</td>
          <td>${planBadge(t.planName||t.plan)}</td>
          <td>${statusBadge(t.status)}</td>
          <td>${boolBadge(t.emailVerified||t.isEmailVerified,'✓ Validé','✗ Non validé')}</td>
          <td>
            <div style="font-size:12px">${fNum(t.totalTokensConsumed||t.tokenUsage||t.aiTokensUsed||0)}</div>
            <div class="token-bar" style="margin-top:3px;width:80px">
              <div class="token-fill" style="width:${Math.min(100,Math.round((t.totalTokensConsumed||0)/Math.max(t.tokenLimit||1000000,1)*100))}%"></div>
            </div>
          </td>
          <td style="font-size:12px">${fDate(t.createdAt)}</td>
          <td style="white-space:nowrap">
            <button class="ibtn ibtn-p" title="Ouvrir fiche" onclick="Drawer.open('${t.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            ${t.status==='suspended'
              ? `<button class="ibtn ibtn-g" title="Réactiver" onclick="Clients.quickReactivate('${t.id}')">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                 </button>`
              : `<button class="ibtn ibtn-r" title="Suspendre" onclick="Clients.quickSuspend('${t.id}')">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                 </button>`
            }
            <button class="ibtn ibtn-y" title="Impersonifier" onclick="Clients.impersonate('${t.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
          </td>
        </tr>`).join('');
    }

    async function quickSuspend(id) {
      const reason = prompt('Raison de la suspension :');
      if (!reason) return;
      try { await apost(`/admin/tenants/${id}/suspend`, { reason }); Toast.s('Compte suspendu'); load(false); }
      catch(err) { Toast.e(err.message); }
    }
    async function quickReactivate(id) {
      if (!confirm('Réactiver ce compte ?')) return;
      try { await apost(`/admin/tenants/${id}/reactivate`, {}); Toast.s('Compte réactivé'); load(false); }
      catch(err) { Toast.e(err.message); }
    }
    async function impersonate(id) {
      if (!confirm('Ouvrir l\'application en tant que ce client (1h) ?')) return;
      try {
        const admin = AdminAuth.getAdmin();
        const d = await apost(`/admin/tenants/${id}/impersonate`, { adminId: admin?.sub||admin?.id });
        if (d.accessToken) {
          localStorage.setItem('accessToken', d.accessToken);
          if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
          if (d.user)   localStorage.setItem('user',   JSON.stringify(d.user));
          if (d.tenant) localStorage.setItem('tenant', JSON.stringify(d.tenant));
          Toast.s('Impersonification réussie');
          setTimeout(() => window.open('/index.html','_blank'), 800);
        } else { Toast.i('Impersonification initiée'); }
      } catch(err) { Toast.e(err.message); }
    }

    function openNewClientModal() {
      Modal.open(
        'Nouveau client',
        `<div class="api-form-grid" style="gap:12px">
          <div class="fg"><label>Entreprise *</label><input id="nc-company" placeholder="SAS Martin BTP" required></div>
          <div class="fg"><label>SIREN / SIRET</label><input id="nc-siren" placeholder="123 456 789 00012"></div>
          <div class="fg"><label>Prénom *</label><input id="nc-fn" placeholder="Jean" required></div>
          <div class="fg"><label>Nom *</label><input id="nc-ln" placeholder="Martin" required></div>
          <div class="fg"><label>Email *</label><input id="nc-email" type="email" placeholder="jean@martin-btp.fr" required></div>
          <div class="fg"><label>Téléphone</label><input id="nc-phone" type="tel" placeholder="+33 6 00 00 00 00"></div>
          <div class="fg"><label>Plan</label>
            <select id="nc-plan"><option value="trial">Essai gratuit</option><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option></select>
          </div>
          <div class="fg"><label>Mot de passe initial</label><input id="nc-pwd" type="password" placeholder="Laissez vide = auto-généré"></div>
        </div>
        <div id="nc-err" style="display:none;color:#fca5a5;font-size:12px;margin-top:8px"></div>`,
        `<button class="btn btn-pri" onclick="Clients.submitNew()">Créer le client</button>
         <button class="btn btn-sec" onclick="Modal.close()">Annuler</button>`
      );
    }

    async function submitNew() {
      const v = (id) => $(id)?.value?.trim();
      const errEl = $('nc-err');
      errEl.style.display = 'none';

      if (!v('nc-company') || !v('nc-fn') || !v('nc-ln') || !v('nc-email')) {
        errEl.textContent = 'Champs obligatoires manquants'; errEl.style.display = 'block'; return;
      }

      // Auto-générer un mot de passe si non fourni (requis par le backend, min 8 chars)
      const pwd = v('nc-pwd') || Math.random().toString(36).slice(2, 10) + 'A1!';

      const body = {
        companyName: v('nc-company'),
        firstName:   v('nc-fn'),
        lastName:    v('nc-ln'),
        email:       v('nc-email'),
        password:    pwd,
      };
      // Champs optionnels — noms exacts attendus par le DTO backend
      if (v('nc-siren')) body.companySiret = v('nc-siren');
      if (v('nc-phone')) body.companyPhone  = v('nc-phone');
      const plan = v('nc-plan');
      if (plan && plan !== 'trial') body.planName = plan;

      const btn = document.querySelector('#am-foot .btn-pri');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Création…'; }

      try {
        const result = await apost('/admin/tenants', body);
        Toast.s('Client créé avec succès');
        Modal.close();
        // Si le mot de passe a été auto-généré, l'afficher à l'admin
        if (!v('nc-pwd')) {
          setTimeout(() => Toast.i(`🔑 Mot de passe généré : ${pwd}`, 8000), 500);
        }
        load(true);
      } catch(err) {
        errEl.textContent = err.message; errEl.style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = 'Créer le client'; }
      }
    }

    function init() {
      $('cl-search')?.addEventListener('input', debounce(() => { search=$('cl-search').value.trim(); load(); }, 350));
      $('cl-filter-status')?.addEventListener('change', () => { fStatus=$('cl-filter-status').value; load(); });
      $('cl-filter-plan')?.addEventListener('change',   () => { fPlan=$('cl-filter-plan').value; load(); });
      $('cl-filter-valid')?.addEventListener('change',  () => { fValid=$('cl-filter-valid').value; load(); });
      $('btn-new-client')?.addEventListener('click', openNewClientModal);
    }

    return { load, reload, quickSuspend, quickReactivate, impersonate, submitNew, init };
  })();

  /* ═══════════════════════════════════════════════════════════════
     API SETTINGS
  ═══════════════════════════════════════════════════════════════ */
  const ApiSettings = (() => {
    let keys = [];

    async function load() {
      try {
        const data = await api('/admin/api-keys').catch(()=>({ keys:[] }));
        keys = data.keys || data.data || data || [];
        renderKeys();
        loadGlobalSettings();
      } catch { renderKeys(); }
    }

    function renderKeys() {
      const el = $('api-keys-list');
      if (!el) return;
      if (!keys.length) {
        el.innerHTML = `<div style="padding:16px;color:var(--muted);font-size:12.5px">
          Aucune clé API personnalisée. Les clés globales sont configurées ci-dessous.</div>`;
        return;
      }
      el.innerHTML = keys.map(k => `
        <div class="api-key-row">
          <div class="api-key-name">${esc(k.name||k.label||'—')}</div>
          <div class="api-key-val">${k.prefix||''}•••••••••••••••••${k.suffix||''}</div>
          <div class="api-key-perms">${(k.permissions||k.scopes||[]).map(p=>`<span class="perm-tag">${esc(p)}</span>`).join('')}</div>
          <div style="font-size:11px;color:var(--dim)">${fDate(k.createdAt)}</div>
          <div style="display:flex;gap:4px">
            <button class="ibtn ibtn-y" title="Rotation" onclick="ApiSettings.rotate('${k.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button class="ibtn ibtn-r" title="Supprimer" onclick="ApiSettings.deleteKey('${k.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>`).join('');
    }

    async function loadGlobalSettings() {
      try {
        const s = await safeApi('/admin/settings') || {};
        if (s.smtp_host) $('g-smtp-host').value = s.smtp_host;
        if (s.smtp_port) $('g-smtp-port').value = s.smtp_port;
        if (s.smtp_user) $('g-smtp-from').value = s.smtp_user;
        if (s.anthropic_key_set) $('g-anthropic').placeholder = '•••••••••••••••••••• (configuré)';
        if (s.google_maps_key_set) $('g-gmaps').placeholder = '•••••••••••••••••••• (configuré)';
      } catch {}
    }

    async function rotate(id) {
      if (!confirm('Effectuer la rotation de cette clé ? L\'ancienne clé sera immédiatement invalidée.')) return;
      try {
        const d = await apost(`/admin/api-keys/${id}/rotate`, {});
        Modal.open('Nouvelle clé générée',
          `<div style="padding:8px">
            <p style="margin-bottom:12px;font-size:12.5px;color:var(--muted)">Copiez cette clé maintenant — elle ne sera plus affichée :</p>
            <code style="font-family:monospace;font-size:13px;background:rgba(0,0,0,.3);padding:10px;border-radius:8px;display:block;word-break:break-all">${esc(d.key||d.apiKey||'—')}</code>
          </div>`,
          `<button class="btn btn-pri" onclick="navigator.clipboard.writeText('${esc(d.key||d.apiKey||'')}').then(()=>Toast.s('Copié !'))">Copier</button>
           <button class="btn btn-sec" onclick="Modal.close()">Fermer</button>`
        );
        load();
      } catch(err) { Toast.e(err.message); }
    }

    async function deleteKey(id) {
      if (!confirm('Supprimer cette clé ? Elle sera immédiatement invalidée.')) return;
      try { await adel(`/admin/api-keys/${id}`); Toast.s('Clé supprimée'); load(); }
      catch(err) { Toast.e(err.message); }
    }

    function openNewKeyModal() {
      Modal.open('Nouvelle clé API',
        `<div style="display:flex;flex-direction:column;gap:12px">
          <div class="fg"><label>Nom de la clé</label><input id="nk-name" placeholder="Intégration CRM"></div>
          <div class="fg"><label>Permissions</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
              ${['read','write','admin','webhook'].map(p=>`
                <label style="display:flex;align-items:center;gap:5px;font-size:12.5px;cursor:pointer">
                  <input type="checkbox" value="${p}" class="nk-perm"> ${p}
                </label>`).join('')}
            </div>
          </div>
        </div>
        <div id="nk-err" style="display:none;color:#fca5a5;font-size:12px;margin-top:8px"></div>`,
        `<button class="btn btn-pri" onclick="ApiSettings.submitNewKey()">Créer</button>
         <button class="btn btn-sec" onclick="Modal.close()">Annuler</button>`
      );
    }

    async function submitNewKey() {
      const name = $('nk-name')?.value?.trim();
      if (!name) { $('nk-err').textContent='Nom requis'; $('nk-err').style.display='block'; return; }
      const perms = [...$$('.nk-perm:checked')].map(c=>c.value);
      try {
        const d = await apost('/admin/api-keys', { name, permissions:perms });
        Modal.close();
        Modal.open('Clé créée',
          `<div style="padding:8px">
            <p style="margin-bottom:12px;font-size:12.5px;color:var(--muted)">Copiez cette clé — elle ne sera plus visible :</p>
            <code style="font-family:monospace;font-size:13px;background:rgba(0,0,0,.3);padding:10px;border-radius:8px;display:block;word-break:break-all">${esc(d.key||d.apiKey||'—')}</code>
          </div>`,
          `<button class="btn btn-pri" onclick="navigator.clipboard.writeText('${esc(d.key||d.apiKey||'')}').then(()=>Toast.s('Copié !'))">Copier</button>
           <button class="btn btn-sec" onclick="Modal.close()">Fermer</button>`
        );
        load();
      } catch(err) { $('nk-err').textContent=err.message; $('nk-err').style.display='block'; }
    }

    async function saveGlobal() {
      const btn = $('btn-save-api-global');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      const msg = $('api-global-msg');
      const body = {};
      const v = (id) => $(id)?.value?.trim();
      if (v('g-anthropic') && !v('g-anthropic').includes('•')) body.anthropic_key = v('g-anthropic');
      if (v('g-gmaps')     && !v('g-gmaps').includes('•'))     body.google_maps_key = v('g-gmaps');
      if (v('g-smtp-host')) body.smtp_host = v('g-smtp-host');
      if (v('g-smtp-port')) body.smtp_port = parseInt(v('g-smtp-port'));
      if (v('g-smtp-from')) body.smtp_user = v('g-smtp-from');
      try {
        await apost('/settings', body);
        msg.textContent='✓ Paramètres globaux enregistrés'; msg.style.color='#86efac'; msg.style.display='block';
        setTimeout(()=>{ msg.style.display='none'; }, 3000);
      } catch(err) {
        msg.textContent='✗ '+err.message; msg.style.color='#fca5a5'; msg.style.display='block';
      } finally { btn.disabled=false; btn.textContent='Enregistrer'; }
    }

    function init() {
      $('btn-new-key')?.addEventListener('click', openNewKeyModal);
      $('btn-save-api-global')?.addEventListener('click', saveGlobal);
    }

    return { load, rotate, deleteKey, openNewKeyModal, submitNewKey, saveGlobal, init };
  })();

  /* ═══════════════════════════════════════════════════════════════
     BILLING
  ═══════════════════════════════════════════════════════════════ */
  const Billing = (() => {
    let subsPage=1, subsTotal=1;
    const DEFAULT_PLANS = {
      bronze: { name:'Bronze', price:19, annual:190, color:'plan-bronze', description:'Idéal pour les artisans débutants. Accès aux fonctionnalités essentielles de devis.', features:['Jusqu\'à 20 devis/mois','Chat IA limité (500 tokens/j)','1 utilisateur','Support email'] },
      silver: { name:'Silver', price:39, annual:390, color:'plan-silver', description:'Pour les artisans établis qui veulent automatiser leur processus commercial.', features:['Devis illimités','Chat IA étendu (2000 tokens/j)','3 utilisateurs','Kanban & Relances','Support prioritaire'] },
      gold:   { name:'Gold',   price:79, annual:790, color:'plan-gold',   description:'Solution complète pour les entreprises BTP avec équipe. Toutes les fonctionnalités.', features:['Tout illimité','IA illimitée','Utilisateurs illimités','GED intégrée','API access','Support dédié'] },
    };
    let plans = { ...DEFAULT_PLANS };

    async function load() {
      // Charger les plans depuis l'API si disponible
      try {
        const d = await api('/admin/plans').catch(()=>null);
        if (d) {
          ['bronze','silver','gold'].forEach(k => {
            if (d[k] || d.find?.(p=>p.id===k||p.name?.toLowerCase()===k)) {
              const p = d[k] || d.find(p=>p.id===k||p.name?.toLowerCase()===k);
              if (p) plans[k] = { ...DEFAULT_PLANS[k], ...p };
            }
          });
        }
      } catch {}
      renderPlanCards();
      loadSubscriptions();
      loadPayments();
    }

    function renderPlanCards() {
      const el = $('plan-cards-container');
      if (!el) return;
      el.innerHTML = Object.entries(plans).map(([key, p]) => `
        <div class="plan-card">
          <div class="plan-card-hdr">
            <span class="badge ${p.color||'bg-p'}" style="font-size:12px">${p.name}</span>
            <div class="plan-price-display">
              <sup>€</sup>${p.price}<span>/mois</span>
            </div>
          </div>
          <div class="plan-card-body">
            <div class="fg" style="margin-bottom:10px">
              <label>Prix mensuel (€)</label>
              <input class="plan-input" id="plan-${key}-price" type="number" value="${p.price}" min="0">
            </div>
            <div class="fg" style="margin-bottom:10px">
              <label>Prix annuel (€)</label>
              <input class="plan-input" id="plan-${key}-annual" type="number" value="${p.annual}" min="0">
            </div>
            <div class="fg" style="margin-bottom:10px">
              <label>Description</label>
              <textarea class="plan-input" id="plan-${key}-desc" rows="3">${esc(p.description)}</textarea>
            </div>
            <div class="fg">
              <label>Fonctionnalités (une par ligne)</label>
              <textarea class="plan-input" id="plan-${key}-feats" rows="4">${(p.features||[]).join('\n')}</textarea>
            </div>
          </div>
        </div>`).join('');
    }

    async function savePlans() {
      const btn = $('btn-save-plans');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Enregistrement…';
      try {
        const updated = {};
        ['bronze','silver','gold'].forEach(k => {
          updated[k] = {
            ...plans[k],
            price:   parseFloat($(  `plan-${k}-price`)?.value)  || plans[k].price,
            annual:  parseFloat($(`plan-${k}-annual`)?.value)   || plans[k].annual,
            description: $(`plan-${k}-desc`)?.value?.trim()     || plans[k].description,
            features: ($(`plan-${k}-feats`)?.value||'').split('\n').map(s=>s.trim()).filter(Boolean),
          };
        });
        await apost('/admin/plans', updated).catch(()=>null); // graceful if endpoint missing
        plans = updated;
        localStorage.setItem('adminPlansCache', JSON.stringify(updated));
        Toast.s('Offres enregistrées');
        renderPlanCards();
      } catch(err) { Toast.e(err.message); }
      finally { btn.disabled=false; btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Sauvegarder les offres'; }
    }

    async function loadSubscriptions(reset=true) {
      if (reset) subsPage=1;
      const tbody = $('billing-subs-tbody');
      if (!tbody) return;
      try {
        const p = new URLSearchParams({ page:subsPage, limit:20, status:'active' });
        const data = await api(`/admin/tenants?${p}`);
        const list = data.data || data.tenants || data || [];
        subsTotal = data.meta?.totalPages || data.totalPages || 1;
        $('billing-subs-count').textContent = `${data.meta?.total||list.length} abonnement(s)`;
        if (!list.length) { tbody.innerHTML='<tr><td colspan="7" class="t-empty">Aucun abonnement</td></tr>'; return; }
        tbody.innerHTML = list.map(t => `
          <tr>
            <td><div class="t-cell-main">${esc(t.companyName||t.name||'—')}</div>
                <div class="t-cell-sub">${esc(t.ownerEmail||'')}</div></td>
            <td>${planBadge(t.plan||t.planName)}</td>
            <td style="font-size:12px">${fDate(t.createdAt)}</td>
            <td style="font-size:12px">${fDate(t.nextPaymentAt||t.nextPaymentDate)}</td>
            <td style="font-size:12px">${fDate(t.lastPaymentAt||t.lastPaymentDate)}</td>
            <td>${payBadge(t.lastPaymentStatus||'pending')}</td>
            <td>
              <button class="ibtn ibtn-p" title="Fiche client" onclick="Drawer.open('${t.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button class="ibtn ibtn-r" title="Relance paiement" onclick="Billing.sendPaymentReminder('${t.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </button>
            </td>
          </tr>`).join('');
        renderPages('billing-subs-pages', subsPage, subsTotal, (n)=>{ subsPage=n; loadSubscriptions(false); });
      } catch(err) {
        tbody.innerHTML = `<tr><td colspan="7" class="t-empty" style="color:#fca5a5">Erreur : ${esc(err.message)}</td></tr>`;
      }
    }

    async function loadPayments() {
      const tbody = $('billing-pay-tbody');
      if (!tbody) return;
      const filt = $('billing-pay-filter')?.value||'';
      try {
        const p = new URLSearchParams({ limit:30 });
        if (filt) p.set('status', filt);
        const data = await api(`/admin/payments?${p}`).catch(()=>({ data:[] }));
        const list = data.data || data.payments || data || [];
        if (!list.length) { tbody.innerHTML='<tr><td colspan="7" class="t-empty">Aucun prélèvement trouvé</td></tr>'; return; }
        tbody.innerHTML = list.map(p => `
          <tr>
            <td style="font-size:12px">${fDate(p.date||p.createdAt)}</td>
            <td><div class="t-cell-main">${esc(p.tenantName||p.clientName||'—')}</div></td>
            <td>${planBadge(p.plan||p.planName)}</td>
            <td style="font-weight:600">${fMoney(p.amount)}</td>
            <td style="font-family:monospace;font-size:11.5px">${p.ibanMasked||p.iban?.slice(0,4)+'••••'+p.iban?.slice(-4)||'—'}</td>
            <td>${payBadge(p.status)}</td>
            <td>
              ${p.status==='failed'?`<button class="ibtn ibtn-r" title="Relancer" onclick="Billing.retryPayment('${p.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>`:''}
            </td>
          </tr>`).join('');
      } catch {
        tbody.innerHTML = '<tr><td colspan="7" class="t-empty">Historique non disponible</td></tr>';
      }
    }

    async function sendPaymentReminder(tenantId) {
      try {
        await apost(`/admin/tenants/${tenantId}/payment-reminder`, {}).catch(()=>
          apost('/reminders/send', { devisId: tenantId, type:'payment' })
        );
        Toast.s('Relance envoyée');
      } catch(err) { Toast.e(err.message); }
    }

    async function retryPayment(paymentId) {
      if (!confirm('Relancer ce prélèvement ?')) return;
      try { await apost(`/admin/payments/${paymentId}/retry`, {}); Toast.s('Prélèvement relancé'); loadPayments(); }
      catch(err) { Toast.e(err.message); }
    }

    function init() {
      $('btn-save-plans')?.addEventListener('click', savePlans);
      $('billing-pay-filter')?.addEventListener('change', loadPayments);
    }

    return { load, savePlans, loadSubscriptions, loadPayments, sendPaymentReminder, retryPayment, init };
  })();

  /* ═══════════════════════════════════════════════════════════════
     GED
  ═══════════════════════════════════════════════════════════════ */
  const Ged = (() => {
    let selectedClientId = null;
    let clients = [];

    async function load() {
      loadClientsList();
    }

    async function loadClientsList() {
      const el = $('ged-clients-list');
      if (!el) return;
      try {
        const data = await api('/admin/tenants?limit=100');
        clients = data.data || data.tenants || data || [];
        renderClientsList(clients);
      } catch { el.innerHTML = '<div class="a-er" style="padding:16px">Erreur chargement</div>'; }
    }

    function renderClientsList(list) {
      const el = $('ged-clients-list');
      if (!el) return;
      const filt = $('ged-client-search')?.value?.toLowerCase()||'';
      const filtered = filt ? list.filter(t => (t.companyName||t.name||'').toLowerCase().includes(filt)||(t.ownerEmail||'').toLowerCase().includes(filt)) : list;
      if (!filtered.length) { el.innerHTML='<div style="padding:14px;color:var(--muted);font-size:12px">Aucun client</div>'; return; }
      el.innerHTML = filtered.map(t => `
        <div class="ged-client-item ${selectedClientId===t.id?'active':''}" onclick="Ged.selectClient('${t.id}','${esc(t.companyName||t.name||'—')}')">
          <div style="font-size:12.5px;font-weight:500">${esc(t.companyName||t.name||'—')}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(t.ownerEmail||'')}</div>
        </div>`).join('');
    }

    async function selectClient(id, name) {
      selectedClientId = id;
      renderClientsList(clients);
      $('ged-panel-title').textContent = name;
      $('btn-ged-panel-upload').style.display = 'flex';
      await loadDocs(id);
    }

    async function loadDocs(tenantId) {
      const el = $('ged-docs-list');
      if (!el) return;
      const cat = $('ged-filter-cat')?.value||'';
      el.innerHTML = '<div class="a-ld">Chargement…</div>';
      try {
        const p = new URLSearchParams({ tenantId });
        if (cat) p.set('category', cat);
        const data = await safeApi(`/ged?${p}`) || { data: [] };
        const docs = data.data || data.files || data || [];
        if (!docs.length) {
          el.innerHTML = `
            <div style="padding:16px">
              <div class="doc-upload-area" onclick="document.getElementById('ged-file-input').click()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <div style="font-size:13px;font-weight:500">Aucun document</div>
                <div style="font-size:11px;margin-top:4px">Cliquez pour ajouter un document</div>
              </div>
            </div>`;
        } else {
          el.innerHTML = `<div style="padding:16px">
            <div style="display:flex;flex-direction:column;gap:8px">
              ${docs.map(d => `
                <div class="doc-row">
                  <div class="doc-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                  <div class="doc-info">
                    <div class="doc-name">${esc(d.originalName||d.name||d.key||'Document')}</div>
                    <div class="doc-meta">
                      <span class="badge ${d.category==='contract'?'bg-p':d.category==='sepa'?'bg-b':'bg-grey'}" style="font-size:10px">${esc(d.category||'—')}</span>
                      · ${fDate(d.createdAt||d.uploadedAt)}${d.size?' · '+(d.size/1024).toFixed(0)+' Ko':''}
                    </div>
                  </div>
                  <div style="display:flex;gap:4px">
                    <button class="ibtn ibtn-p" title="Télécharger" onclick="Ged.download('${esc(d.id||d.key)}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button class="ibtn ibtn-r" title="Supprimer" onclick="Ged.deleteDoc('${esc(d.id||d.key)}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>`).join('')}
            </div>
          </div>`;
        }
      } catch { el.innerHTML='<div class="a-er" style="padding:16px">Erreur de chargement</div>'; }
    }

    function openUpload() {
      if (!selectedClientId) { Toast.w('Sélectionnez un client'); return; }
      const inp = document.createElement('input');
      inp.type='file'; inp.multiple=true;
      inp.addEventListener('change', async (e) => {
        const cat = prompt('Catégorie (contract / sepa / invoice / other) :', 'contract') || 'other';
        for (const file of e.target.files) {
          try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', selectedClientId);
            fd.append('category', cat);
            await AdminAuth.fetchAdmin(`${BASE}/ged/upload`, { method:'POST', body:fd, headers:{} }).catch(async () => {
              const { uploadUrl } = await api(`/ged/upload-url?tenantId=${selectedClientId}&category=${cat}&filename=${encodeURIComponent(file.name)}`);
              await fetch(uploadUrl, { method:'PUT', body:file });
            });
            Toast.s(`${file.name} uploadé`);
          } catch(err) { Toast.e(err.message); }
        }
        loadDocs(selectedClientId);
      });
      inp.click();
    }

    async function download(id) {
      try {
        const d = await api(`/ged/${id}/download-url`);
        window.open(d.url||d.downloadUrl, '_blank');
      } catch { Toast.e('Impossible de télécharger'); }
    }

    async function deleteDoc(id) {
      if (!confirm('Supprimer ce document définitivement ?')) return;
      try { await adel(`/ged/${id}`); Toast.s('Supprimé'); loadDocs(selectedClientId); }
      catch(err) { Toast.e(err.message); }
    }

    function init() {
      $('ged-client-search')?.addEventListener('input', debounce(() => renderClientsList(clients), 250));
      $('ged-filter-cat')?.addEventListener('change', () => { if (selectedClientId) loadDocs(selectedClientId); });
      $('btn-ged-upload')?.addEventListener('click', openUpload);
      $('btn-ged-panel-upload')?.addEventListener('click', openUpload);
    }

    return { load, selectClient, loadDocs, download, deleteDoc, openUpload, init };
  })();

  /* ═══════════════════════════════════════════════════════════════
     AUDIT
  ═══════════════════════════════════════════════════════════════ */
  const Audit = (() => {
    let page=1, total=1;

    async function load(reset=true) {
      if (reset) page=1;
      $('audit-tbody').innerHTML = '<tr><td colspan="5" class="t-empty">Chargement…</td></tr>';
      try {
        const p = new URLSearchParams({ page, limit:30 });
        const tenant = $('audit-search-tenant')?.value?.trim();
        const action = $('audit-search-action')?.value?.trim();
        if (tenant) p.set('tenantId', tenant);
        if (action) p.set('action', action);
        const data = await api(`/admin/audit-logs?${p}`);
        const logs = data.data || data.logs || data || [];
        total = data.meta?.totalPages || data.totalPages || 1;
        if (!logs.length) { $('audit-tbody').innerHTML='<tr><td colspan="5" class="t-empty">Aucune entrée</td></tr>'; return; }
        $('audit-tbody').innerHTML = logs.map(l => `
          <tr>
            <td style="color:var(--muted);font-size:11.5px;white-space:nowrap">${fDT(l.createdAt||l.timestamp)}</td>
            <td><code class="monobadge">${esc(l.action||'—')}</code></td>
            <td>${esc(l.tenantName||l.tenantId||'—')}</td>
            <td>${esc(l.performedBy||l.adminEmail||'système')}</td>
            <td style="font-size:11.5px;color:var(--dim);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${l.meta ? esc(JSON.stringify(l.meta).slice(0,120)) : '—'}
            </td>
          </tr>`).join('');
        renderPages('audit-pages', page, total, (n)=>{ page=n; load(false); });
      } catch(err) {
        $('audit-tbody').innerHTML = `<tr><td colspan="5" class="t-empty" style="color:#fca5a5">Erreur : ${esc(err.message)}</td></tr>`;
      }
    }

    function init() {
      $('btn-audit-filter')?.addEventListener('click', () => load());
    }

    return { load, init };
  })();

  /* ═══════════════════════════════════════════════════════════════
     NAVIGATION
  ═══════════════════════════════════════════════════════════════ */
  const SECTION_TITLES = {
    dashboard: 'Dashboard Plateforme',
    clients:   'Gestion des Clients',
    api:       'Clés API & Configuration',
    billing:   'Facturation & Abonnements',
    ged:       'GED — Gestion Documentaire',
    audit:     'Journal d\'Audit',
  };

  function navigate(sec) {
    $$('.ni[data-sec]').forEach(n => n.classList.toggle('active', n.dataset.sec===sec));
    $$('.a-sec').forEach(s => s.classList.toggle('active', s.id===`a-sec-${sec}`));
    $('a-topbar-title').textContent = SECTION_TITLES[sec] || 'Administration';
    if (sec==='dashboard') Dashboard.load();
    if (sec==='clients')   Clients.load();
    if (sec==='api')       ApiSettings.load();
    if (sec==='billing')   Billing.load();
    if (sec==='ged')       Ged.load();
    if (sec==='audit')     Audit.load();
  }

  /* ═══════════════════════════════════════════════════════════════
     PAGINATION HELPER
     Utilise window._pgCb pour stocker les callbacks de manière
     sûre (évite la sérialisation de fonctions dans les onclick).
  ═══════════════════════════════════════════════════════════════ */
  window._pgCb = window._pgCb || {};

  function renderPages(containerId, current, total, onNav) {
    const el = $(containerId);
    if (!el) return;
    if (total <= 1) { el.innerHTML = ''; return; }
    // Stocker le callback dans un registre global indexé par containerId
    window._pgCb[containerId] = onNav;
    el.innerHTML = `
      <button class="pg-btn" ${current <= 1 ? 'disabled' : ''}
        onclick="window._pgCb['${containerId}'](${current - 1})">‹</button>
      <span>Page ${current} / ${total}</span>
      <button class="pg-btn" ${current >= total ? 'disabled' : ''}
        onclick="window._pgCb['${containerId}'](${current + 1})">›</button>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILS
  ═══════════════════════════════════════════════════════════════ */
  function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
  }

  /* ═══════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════ */
  function init() {
    // Widget admin
    const admin = AdminAuth.getAdmin();
    if (admin) {
      const name = admin.email || admin.sub || 'Admin';
      const el = $('a-admin-name');
      if (el) el.textContent = name;
    }

    // Navigation sidebar
    $$('.ni[data-sec]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.sec));
    });

    // Topbar refresh
    $('a-btn-refresh')?.addEventListener('click', () => {
      const active = document.querySelector('.ni.active')?.dataset.sec||'dashboard';
      navigate(active);
    });

    // Logout
    $('a-btn-logout')?.addEventListener('click', () => AdminAuth.logout());

    // Modules init
    Drawer.init();
    Clients.init();
    ApiSettings.init();
    Billing.init();
    Ged.init();
    Audit.init();

    // Démarrage
    navigate('dashboard');
  }

  // Exposer les modules pour les handlers inline HTML
  window.Drawer     = Drawer;
  window.Clients    = Clients;
  window.ApiSettings = ApiSettings;
  window.Billing    = Billing;
  window.Ged        = Ged;
  window.Audit      = Audit;
  window.Toast      = Toast;
  window.Modal      = Modal;

  return { init, navigate };
})();

window.AdminApp = AdminApp;
document.addEventListener('DOMContentLoaded', () => AdminApp.init());
