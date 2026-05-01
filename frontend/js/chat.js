/* =============================================
   CHAT — Interface conversation IA + voix + images
   ============================================= */

const Chat = (() => {
  let sessionId = localStorage.getItem('chatSessionId') || null;
  let isLoading = false;
  let attachedImage = null; // { base64, mimeType, name }
  let recognition = null;
  let isRecording = false;

  // ---- DOM refs ----
  const $ = (id) => document.getElementById(id);

  function init() {
    bindEvents();
    if (sessionId) {
      // Session existante — on affiche l'invite de continuation
      appendWelcomeBack();
    }
  }

  function bindEvents() {
    $('btn-chat-send').addEventListener('click', sendMessage);
    $('btn-new-session').addEventListener('click', newSession);
    $('btn-chat-attach').addEventListener('click', () => $('chat-file-input').click());
    $('chat-file-input').addEventListener('change', handleFileSelect);
    $('btn-remove-image').addEventListener('click', removeAttachment);
    $('btn-voice').addEventListener('click', toggleVoice);

    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    $('chat-input').addEventListener('input', () => {
      const ta = $('chat-input');
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    });

    // Suggestions de démarrage
    document.querySelectorAll('.suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        $('chat-input').value = btn.dataset.text;
        sendMessage();
      });
    });

    // Bouton générer devis depuis chat
    $('btn-chat-generate-devis').addEventListener('click', () => {
      App.navigate('devis');
    });
  }

  async function sendMessage() {
    const input = $('chat-input');
    const text = input.value.trim();

    if (!text && !attachedImage) return;
    if (isLoading) return;

    // Masquer écran d'accueil
    const welcome = document.querySelector('.chat-welcome');
    if (welcome) welcome.style.display = 'none';

    // Afficher message utilisateur
    appendMessage('user', text, attachedImage ? attachedImage.base64 : null);

    const imageData = attachedImage ? { ...attachedImage } : null;
    const payload = {
      message: text || 'Analyse cette image',
      sessionId
    };

    if (imageData) {
      payload.imageBase64 = imageData.base64;
      payload.imageMimeType = imageData.mimeType;
    }

    // Reset input
    input.value = '';
    input.style.height = 'auto';
    removeAttachment();
    setLoading(true);

    // Typing indicator
    const typingEl = appendTyping();

    try {
      const data = await API.chat.send(payload);
      sessionId = data.sessionId;
      localStorage.setItem('chatSessionId', sessionId);

      typingEl.remove();
      appendMessage('assistant', data.response);

      // Montrer le bouton "Générer devis" si la réponse contient une estimation
      if (data.response && (data.response.includes('devis') || data.response.includes('€') || data.response.includes('Total'))) {
        $('btn-chat-generate-devis').style.display = 'flex';
      }
    } catch (err) {
      typingEl.remove();
      appendMessage('assistant', `Désolé, une erreur s'est produite : ${err.message}`);
      Toast.error('Erreur de communication avec l\'IA');
    } finally {
      setLoading(false);
    }
  }

  function appendMessage(role, text, imageBase64 = null) {
    const container = $('chat-messages');
    const el = document.createElement('div');
    el.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'assistant' ? 'IA' : 'Moi';

    const content = document.createElement('div');
    content.className = 'message-content';

    if (imageBase64) {
      const img = document.createElement('img');
      img.src = `data:image/jpeg;base64,${imageBase64}`;
      img.className = 'message-image';
      content.appendChild(img);
    }

    if (text) {
      if (role === 'assistant') {
        // Render markdown
        const mdDiv = document.createElement('div');
        mdDiv.innerHTML = typeof marked !== 'undefined'
          ? marked.parse(text)
          : text.replace(/\n/g, '<br>');
        content.appendChild(mdDiv);
      } else {
        const p = document.createElement('p');
        p.textContent = text;
        content.appendChild(p);
      }
    }

    el.appendChild(avatar);
    el.appendChild(content);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;

    return el;
  }

  function appendTyping() {
    const container = $('chat-messages');
    const el = document.createElement('div');
    el.className = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'IA';
    avatar.style.background = 'var(--primary)';
    avatar.style.color = '#fff';
    avatar.style.borderRadius = '50%';
    avatar.style.width = '32px';
    avatar.style.height = '32px';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.fontSize = '11px';
    avatar.style.fontWeight = '700';

    const dots = document.createElement('div');
    dots.className = 'typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';

    el.appendChild(avatar);
    el.appendChild(dots);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;

    return el;
  }

  function appendWelcomeBack() {
    // Session existante — simple message discret
    const container = $('chat-messages');
    const welcome = container.querySelector('.chat-welcome');
    if (welcome) {
      const note = document.createElement('div');
      note.style.cssText = 'text-align:center; font-size:12px; color:var(--text-muted); padding:8px 0';
      note.textContent = 'Session précédente restaurée';
      welcome.parentNode.insertBefore(note, welcome);
    }
  }

  function newSession() {
    if (sessionId) {
      API.chat.clear(sessionId).catch(() => {});
    }
    sessionId = null;
    localStorage.removeItem('chatSessionId');

    const container = $('chat-messages');
    container.innerHTML = `
      <div class="chat-welcome">
        <div class="welcome-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <h2>Bonjour, je suis votre expert BTP</h2>
        <p>Décrivez votre projet de travaux, uploadez des plans ou des photos de chantier. Je génère votre devis professionnel avec analyse de rentabilité.</p>
        <div class="welcome-suggestions">
          <button class="suggestion-chip" data-text="Je dois refaire une salle de bain de 8m²">Salle de bain 8m²</button>
          <button class="suggestion-chip" data-text="Pose de carrelage 25m² en cuisine">Carrelage cuisine 25m²</button>
          <button class="suggestion-chip" data-text="Rénovation complète d'un appartement de 60m²">Rénovation appartement 60m²</button>
          <button class="suggestion-chip" data-text="Installation électrique maison neuve">Électricité maison neuve</button>
        </div>
      </div>
    `;

    // Rebind suggestion chips
    container.querySelectorAll('.suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        $('chat-input').value = btn.dataset.text;
        sendMessage();
      });
    });

    $('btn-chat-generate-devis').style.display = 'none';
    Toast.info('Nouvelle session démarrée');
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      Toast.error('Fichier trop volumineux (max 20 Mo)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      attachedImage = { base64, mimeType: file.type, name: file.name };

      const preview = $('chat-image-preview');
      const img = $('chat-preview-img');
      const name = $('chat-preview-name');

      if (file.type.startsWith('image/')) {
        img.src = ev.target.result;
        img.style.display = 'block';
      } else {
        img.style.display = 'none';
      }

      name.textContent = file.name;
      preview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function removeAttachment() {
    attachedImage = null;
    $('chat-image-preview').style.display = 'none';
    $('chat-preview-img').src = '';
    $('chat-preview-name').textContent = '';
  }

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      Toast.warning('La reconnaissance vocale n\'est pas supportée par ce navigateur');
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      $('chat-input').value = transcript;
      stopRecording();
      sendMessage();
    };

    recognition.onerror = () => stopRecording();
    recognition.onend = () => stopRecording();

    recognition.start();
    isRecording = true;
    $('btn-voice').classList.add('recording');
    Toast.info('Parlez maintenant...');
  }

  function stopRecording() {
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
    isRecording = false;
    $('btn-voice').classList.remove('recording');
  }

  function setLoading(state) {
    isLoading = state;
    $('btn-chat-send').disabled = state;
    $('chat-input').disabled = state;
  }

  return { init, newSession };
})();
