/* =============================================
   SETTINGS — Configuration entreprise + APIs
   ============================================= */

const Settings = (() => {
  const $ = (id) => document.getElementById(id);

  function init() {
    bindEvents();
    load();
  }

  function bindEvents() {
    $('btn-save-settings').addEventListener('click', save);
    $('btn-test-ia').addEventListener('click', testIA);
    $('btn-test-maps').addEventListener('click', testMaps);
  }

  async function load() {
    try {
      const s = await API.settings.get();
      populate(s);
    } catch (err) {
      Toast.error('Impossible de charger les paramètres');
    }
  }

  function populate(s) {
    const set = (id, val) => { const el = $(id); if (el) el.value = val || ''; };

    // Entreprise
    set('s-company-name', s.company_name);
    set('s-siret', s.siret);
    set('s-phone', s.phone);
    set('s-email', s.email);
    set('s-address', s.address);
    set('s-depot', s.depot_address);

    // Tarification
    set('s-hourly-rate', s.hourly_rate);
    set('s-margin', s.margin_material);
    set('s-km-rate', s.km_rate);
    set('s-tva', s.tva_rate);

    // SMTP
    set('s-smtp-host', s.smtp_host);
    set('s-smtp-port', s.smtp_port);
    set('s-smtp-user', s.smtp_user);
    // Ne pas préremplir les mots de passe

    // API Keys — afficher des placeholder masqués si déjà configurés
    if (s.anthropic_key_set) {
      $('s-anthropic-key').placeholder = '••••••••••••••••••••••• (configuré)';
    }
    if (s.google_maps_key_set) {
      $('s-gmaps-key').placeholder = '••••••••••••••••••••••• (configuré)';
    }
  }

  async function save() {
    const btn = $('btn-save-settings');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    const data = {
      company_name: $('s-company-name').value.trim(),
      siret: $('s-siret').value.trim(),
      phone: $('s-phone').value.trim(),
      email: $('s-email').value.trim(),
      address: $('s-address').value.trim(),
      depot_address: $('s-depot').value.trim(),

      hourly_rate: parseFloat($('s-hourly-rate').value) || 15,
      margin_material: parseFloat($('s-margin').value) || 30,
      km_rate: parseFloat($('s-km-rate').value) || 0.30,
      tva_rate: parseFloat($('s-tva').value) || 10,

      smtp_host: $('s-smtp-host').value.trim(),
      smtp_port: parseInt($('s-smtp-port').value) || 587,
      smtp_user: $('s-smtp-user').value.trim()
    };

    // Ajouter les champs sensibles seulement s'ils ont été remplis
    const smtpPass = $('s-smtp-pass').value;
    if (smtpPass) data.smtp_pass = smtpPass;

    const anthropicKey = $('s-anthropic-key').value.trim();
    if (anthropicKey && !anthropicKey.includes('•')) data.anthropic_key = anthropicKey;

    const gmapsKey = $('s-gmaps-key').value.trim();
    if (gmapsKey && !gmapsKey.includes('•')) data.google_maps_key = gmapsKey;

    try {
      await API.settings.save(data);
      Toast.success('Paramètres enregistrés');
      load(); // Recharger pour mettre à jour les placeholders
    } catch (err) {
      Toast.error(`Erreur : ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    }
  }

  async function testIA() {
    const btn = $('btn-test-ia');
    const result = $('test-ia-result');
    btn.disabled = true;
    btn.textContent = 'Test...';
    result.textContent = '';
    result.className = 'test-result';

    try {
      const data = await API.settings.testIA();
      result.textContent = '✓ ' + (data.message || 'Connexion réussie');
      result.className = 'test-result ok';
    } catch (err) {
      result.textContent = '✗ ' + err.message;
      result.className = 'test-result error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Tester';
    }
  }

  async function testMaps() {
    const btn = $('btn-test-maps');
    const result = $('test-maps-result');
    btn.disabled = true;
    btn.textContent = 'Test...';
    result.textContent = '';
    result.className = 'test-result';

    const origin = $('s-depot').value.trim();
    if (!origin) {
      result.textContent = '✗ Adresse dépôt requise pour tester';
      result.className = 'test-result error';
      btn.disabled = false;
      btn.textContent = 'Tester';
      return;
    }

    try {
      const data = await API.settings.testMaps({
        origin,
        destination: 'Paris, France'
      });
      result.textContent = `✓ ${data.distanceText || ''} — ${data.durationText || ''}`;
      result.className = 'test-result ok';
    } catch (err) {
      result.textContent = '✗ ' + err.message;
      result.className = 'test-result error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Tester';
    }
  }

  return { init, load };
})();
