import { S, SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/state.js';
import { h } from '../core/render.js';
import { getLevel } from './gamification.js';

var _chatMessages = JSON.parse(localStorage.getItem('pbi-chat') || '[]');
var _chatOpen = false;
var _chatLoading = false;
var _chatPendingImage = null; // { mimeType, data (base64) }
var _lastUserMsgIdx = -1;
var _panelMounted = false; // panel is always in DOM once mounted

function _renderMarkdown(text) {
  var html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<strong style="display:block;margin:8px 0 4px;font-size:14px;">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="display:block;margin:10px 0 4px;font-size:15px;">$1</strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^\* (.+)$/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left:16px;list-style:decimal;">$1</li>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return html;
}

function getChatContext() {
  var ctx = 'Niveau : ' + window.LEVELS[getLevel(S.xp)].name;
  if (S.tab === 'formation' && S.chapterIdx !== null && window.CHAPTERS[S.chapterIdx]) {
    ctx += '. Chapitre en cours : ' + window.CHAPTERS[S.chapterIdx].title;
  }
  return ctx;
}

// Compress image via canvas before sending (max 1200px, quality 0.75)
function _compressImage(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var maxDim = 1200;
      var w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      var base64 = dataUrl.split(',')[1];
      callback({ mimeType: 'image/jpeg', data: base64 });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function _handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 10 * 1024 * 1024) {
    alert('Image trop volumineuse (max 10 Mo)');
    return;
  }
  _compressImage(file, function(compressed) {
    _chatPendingImage = compressed;
    _updateImagePreview();
    _updateSendBtnState();
  });
}

function _buildMsgEl(m) {
  var msgEl = h('div', { className: 'chat-msg ' + m.role });
  if (m.image && m.image !== '[image]') {
    var img = h('img', { src: m.image, className: 'chat-msg-img', alt: 'Image' });
    msgEl.appendChild(img);
  }
  if (m.text) {
    var textDiv = document.createElement('div');
    textDiv.innerHTML = _renderMarkdown(m.text);
    msgEl.appendChild(textDiv);
  }
  return msgEl;
}

function _updateChatMessages(scrollToUserMsg) {
  var msgArea = document.getElementById('chat-messages');
  if (!msgArea) return;
  msgArea.innerHTML = '';
  if (_chatMessages.length === 0) {
    msgArea.appendChild(h('div', { className: 'chat-msg bot' }, 'Salut ! Je suis ton tuteur Power BI. Pose-moi une question sur DAX, Power Query, ou la certification PL-300. Tu peux aussi coller une capture d\'\u00e9cran (Ctrl+V) !'));
  }
  var userMsgEl = null;
  _chatMessages.forEach(function(m, i) {
    var el = _buildMsgEl(m);
    if (scrollToUserMsg && i === _lastUserMsgIdx) userMsgEl = el;
    msgArea.appendChild(el);
  });
  if (_chatLoading) {
    msgArea.appendChild(h('div', { className: 'chat-msg bot typing' }, '...'));
  }
  if (scrollToUserMsg && userMsgEl) {
    setTimeout(function() { userMsgEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  } else {
    setTimeout(function() { msgArea.scrollTop = msgArea.scrollHeight; }, 50);
  }
}

function _updateImagePreview() {
  var panel = document.querySelector('.chat-panel');
  if (!panel) return;
  var existing = panel.querySelector('.chat-img-preview');
  if (existing) existing.remove();
  if (_chatPendingImage) {
    var preview = h('div', { className: 'chat-img-preview' });
    var previewImg = h('img', { src: 'data:' + _chatPendingImage.mimeType + ';base64,' + _chatPendingImage.data });
    var removeBtn = h('button', {
      className: 'chat-img-remove',
      onClick: function() { _chatPendingImage = null; _updateImagePreview(); _updateSendBtnState(); }
    }, '\u00d7');
    preview.appendChild(previewImg);
    preview.appendChild(removeBtn);
    var inputRow = panel.querySelector('.chat-input-row');
    if (inputRow) panel.insertBefore(preview, inputRow);
    else panel.appendChild(preview);
  }
  var input = document.getElementById('chat-input');
  if (input) input.placeholder = _chatPendingImage ? 'D\u00e9cris ta capture (optionnel)...' : 'Pose ta question...';
}

function _updateSendBtnState() {
  var btn = document.querySelector('.chat-send-btn');
  var input = document.getElementById('chat-input');
  if (!btn) return;
  var hasContent = (input && input.value.trim()) || _chatPendingImage;
  btn.classList.toggle('active', !!hasContent);
}

function _updateLoadingState() {
  var sendBtn = document.querySelector('.chat-send-btn');
  var imgBtn = document.querySelector('.chat-img-btn');
  var input = document.getElementById('chat-input');
  if (sendBtn) sendBtn.disabled = _chatLoading;
  if (imgBtn) imgBtn.disabled = _chatLoading;
  if (input) input.disabled = _chatLoading;
}

// Mount FAB and panel once — called once at app init
export function renderChatFab() {
  if (_panelMounted) return;
  _panelMounted = true;

  // FAB
  var fab = h('button', {
    className: 'chat-fab',
    'aria-label': 'Ouvrir le tuteur IA',
    onClick: function() { _chatOpen ? _closeChat() : _openChat(); }
  });
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(fab);

  // Panel (always in DOM, hidden by default via CSS)
  var panel = h('div', { className: 'chat-panel' });

  // Header
  var closeBtn = h('button', { className: 'chat-close', 'aria-label': 'R\u00e9duire', onClick: function() { _closeChat(); } });
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  panel.appendChild(h('div', { className: 'chat-header' },
    h('span', { className: 'chat-header-title' }, 'Tuteur IA'),
    closeBtn
  ));

  // Messages area
  panel.appendChild(h('div', { className: 'chat-messages', id: 'chat-messages' }));

  // Input row
  var inputRow = h('div', { className: 'chat-input-row' });

  var fileInput = h('input', {
    type: 'file', accept: 'image/*', style: { display: 'none' }, id: 'chat-file-input',
    onChange: function(e) { _handleImageFile(e.target.files[0]); e.target.value = ''; }
  });
  inputRow.appendChild(fileInput);

  var imgBtn = h('button', {
    className: 'chat-img-btn',
    'aria-label': 'Joindre une image',
    onClick: function() { document.getElementById('chat-file-input').click(); }
  });
  imgBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  inputRow.appendChild(imgBtn);

  var input = h('input', {
    type: 'text', placeholder: 'Pose ta question...', id: 'chat-input', autocomplete: 'off',
    onKeydown: function(e) { if (e.key === 'Enter' && !_chatLoading) { e.preventDefault(); sendChatMessage(); } },
    onInput: function() { _updateSendBtnState(); }
  });
  var sendBtn = h('button', { className: 'chat-send-btn', onClick: function() { if (!_chatLoading) sendChatMessage(); } });
  sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(inputRow);

  // Paste handler
  panel.addEventListener('paste', function(e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (file) _handleImageFile(file);
        return;
      }
    }
  });

  document.body.appendChild(panel);

  // Populate messages area
  _updateChatMessages(false);
}

// renderChatPanel is kept for API compatibility but is a no-op after init
export function renderChatPanel() {}

function _saveToStorage() {
  var toSave = _chatMessages.slice(-50).map(function(m) {
    if (m.image) return { role: m.role, text: m.text, image: '[image]' };
    return m;
  });
  try { localStorage.setItem('pbi-chat', JSON.stringify(toSave)); } catch(e) {}
}

function _openChat() {
  _chatOpen = true;
  if (_chatMessages.length === 0) {
    try {
      var stored = JSON.parse(localStorage.getItem('pbi-chat') || '[]');
      if (stored.length > 0) _chatMessages = stored;
    } catch(e) {}
  }
  var panel = document.querySelector('.chat-panel');
  if (panel) panel.classList.add('is-open');
  _updateChatMessages(false);
  setTimeout(function() {
    var ci = document.getElementById('chat-input');
    if (ci) ci.focus();
  }, 50);
}

function _closeChat() {
  _chatOpen = false;
  _saveToStorage();
  var panel = document.querySelector('.chat-panel');
  if (panel) panel.classList.remove('is-open');
}

export async function sendChatMessage() {
  var input = document.getElementById('chat-input');
  var msg = input ? input.value.trim() : '';
  var image = _chatPendingImage;
  if (!msg && !image) return;

  var historyToSend = _chatMessages.slice(-10);
  var userMsg = { role: 'user', text: msg || '' };
  if (image) userMsg.image = 'data:' + image.mimeType + ';base64,' + image.data;
  _chatMessages.push(userMsg);
  _lastUserMsgIdx = _chatMessages.length - 1;

  _chatPendingImage = null;
  _chatLoading = true;
  if (input) input.value = '';
  _updateImagePreview();
  _updateSendBtnState();
  _updateLoadingState();
  _updateChatMessages(false);

  try {
    var body = { message: msg || 'Analyse cette image.', context: getChatContext(), history: historyToSend };
    if (image) body.image = { mimeType: image.mimeType, data: image.data };
    var resp = await fetch(SUPABASE_URL + '/functions/v1/dax-tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    });
    var data = await resp.json();
    if (data.error) {
      _chatMessages.push({ role: 'bot', text: data.error });
    } else {
      _chatMessages.push({ role: 'bot', text: data.reply || 'Pas de r\u00e9ponse.' });
    }
  } catch (err) {
    _chatMessages.push({ role: 'bot', text: 'Erreur r\u00e9seau. V\u00e9rifie ta connexion.' });
  }

  _chatLoading = false;
  _updateLoadingState();
  _saveToStorage();
  _updateChatMessages(true);
}
