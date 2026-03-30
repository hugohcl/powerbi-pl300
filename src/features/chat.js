import { S, SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/state.js';
import { h } from '../core/render.js';
import { getLevel } from './gamification.js';

var _chatMessages = JSON.parse(localStorage.getItem('pbi-chat') || '[]');
var _chatOpen = false;
var _chatLoading = false;
var _chatPendingImage = null; // { mimeType, data (base64) }
var _lastUserMsgIdx = -1; // index of last user message for scroll targeting

function _renderMarkdown(text) {
  // Lightweight markdown → HTML for chat messages
  var html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML first
    .replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>') // code blocks
    .replace(/`([^`]+)`/g, '<code>$1</code>') // inline code
    .replace(/^### (.+)$/gm, '<strong style="display:block;margin:8px 0 4px;font-size:14px;">$1</strong>') // h3
    .replace(/^## (.+)$/gm, '<strong style="display:block;margin:10px 0 4px;font-size:15px;">$1</strong>') // h2
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // bold
    .replace(/\*([^*]+)\*/g, '<em>$1</em>') // italic
    .replace(/^\* (.+)$/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>') // unordered list
    .replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left:16px;list-style:decimal;">$1</li>') // ordered list
    .replace(/\n{2,}/g, '<br><br>') // double newline = paragraph break
    .replace(/\n/g, '<br>'); // single newline
  return html;
}

function getChatContext() {
  var ctx = 'Niveau : ' + window.LEVELS[getLevel(S.xp)].name;
  if (S.tab === 'formation' && S.chapterIdx !== null && window.CHAPTERS[S.chapterIdx]) {
    ctx += '. Chapitre en cours : ' + window.CHAPTERS[S.chapterIdx].title;
  }
  return ctx;
}

function _handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 4 * 1024 * 1024) {
    alert('Image trop volumineuse (max 4 Mo)');
    return;
  }
  var reader = new FileReader();
  reader.onload = function() {
    var base64 = reader.result.split(',')[1];
    _chatPendingImage = { mimeType: file.type, data: base64 };
    _updateImagePreview();
    _updateSendBtnState();
  };
  reader.readAsDataURL(file);
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

// Incremental update: only rebuild the messages area content
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
    if (scrollToUserMsg && i === _lastUserMsgIdx) {
      userMsgEl = el;
    }
    msgArea.appendChild(el);
  });

  if (_chatLoading) {
    msgArea.appendChild(h('div', { className: 'chat-msg bot typing' }, '...'));
  }

  // Scroll: if we just got a bot response, scroll to show the user question at top
  if (scrollToUserMsg && userMsgEl) {
    setTimeout(function() {
      userMsgEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  } else {
    // Default: scroll to bottom (e.g. when opening panel, or user just sent)
    setTimeout(function() {
      msgArea.scrollTop = msgArea.scrollHeight;
    }, 50);
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
    // Insert before input row
    var inputRow = panel.querySelector('.chat-input-row');
    if (inputRow) panel.insertBefore(preview, inputRow);
    else panel.appendChild(preview);
  }

  // Update placeholder
  var input = document.getElementById('chat-input');
  if (input) {
    input.placeholder = _chatPendingImage ? 'D\u00e9cris ta capture (optionnel)...' : 'Pose ta question...';
  }
}

function _updateSendBtnState() {
  var btn = document.querySelector('.chat-send-btn');
  var input = document.getElementById('chat-input');
  if (!btn) return;
  var hasContent = (input && input.value.trim()) || _chatPendingImage;
  if (hasContent) btn.classList.add('active');
  else btn.classList.remove('active');
}

function _updateLoadingState() {
  var panel = document.querySelector('.chat-panel');
  if (!panel) return;
  // Update buttons disabled state
  var sendBtn = panel.querySelector('.chat-send-btn');
  var imgBtn = panel.querySelector('.chat-img-btn');
  var input = document.getElementById('chat-input');
  if (sendBtn) sendBtn.disabled = _chatLoading;
  if (imgBtn) imgBtn.disabled = _chatLoading;
  if (input) input.disabled = _chatLoading;
}

export function renderChatFab() {
  var existing = document.querySelector('.chat-fab');
  if (existing) existing.remove();
  if (_chatOpen) return;
  var fab = h('button', {
    className: 'chat-fab',
    'aria-label': 'Ouvrir le tuteur IA',
    onClick: function() { _chatOpen = true; renderChatPanel(); renderChatFab(); }
  });
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(fab);
}

export function renderChatPanel() {
  var existing = document.querySelector('.chat-panel');
  if (existing) existing.remove();
  if (!_chatOpen) return;

  var panel = h('div', { className: 'chat-panel' });

  // Header
  panel.appendChild(h('div', { className: 'chat-header' },
    h('span', { className: 'chat-header-title' }, 'Tuteur IA'),
    h('button', { className: 'chat-close', onClick: function() { _chatOpen = false; renderChatPanel(); renderChatFab(); } }, '\u00d7')
  ));

  // Messages
  var msgArea = h('div', { className: 'chat-messages', id: 'chat-messages' });
  panel.appendChild(msgArea);

  // Image preview (will be populated by _updateImagePreview if needed)

  // Input row
  var inputRow = h('div', { className: 'chat-input-row' });

  // Hidden file input
  var fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    style: { display: 'none' },
    id: 'chat-file-input',
    onChange: function(e) {
      _handleImageFile(e.target.files[0]);
      e.target.value = ''; // reset so same file can be re-selected
    }
  });
  inputRow.appendChild(fileInput);

  // Image upload button
  var imgBtn = h('button', {
    className: 'chat-img-btn' + (_chatPendingImage ? ' has-image' : ''),
    'aria-label': 'Joindre une image',
    onClick: function() { document.getElementById('chat-file-input').click(); },
    disabled: _chatLoading
  });
  imgBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  inputRow.appendChild(imgBtn);

  var input = h('input', {
    type: 'text',
    placeholder: _chatPendingImage ? 'D\u00e9cris ta capture (optionnel)...' : 'Pose ta question...',
    id: 'chat-input',
    onKeydown: function(e) { if (e.key === 'Enter' && !_chatLoading) { e.preventDefault(); sendChatMessage(); } },
    onInput: function() { _updateSendBtnState(); }
  });
  var sendBtn = h('button', {
    className: 'chat-send-btn' + (_chatPendingImage ? ' active' : ''),
    onClick: function() { if (!_chatLoading) sendChatMessage(); },
    disabled: _chatLoading
  });
  sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(inputRow);

  // Paste handler for clipboard images (Ctrl+V / Cmd+V)
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

  // Populate messages and image preview
  _updateChatMessages(false);
  _updateImagePreview();

  // Focus input
  setTimeout(function() {
    var ci = document.getElementById('chat-input');
    if (ci) ci.focus();
  }, 50);
}

export async function sendChatMessage() {
  var input = document.getElementById('chat-input');
  var msg = input ? input.value.trim() : '';
  var image = _chatPendingImage;

  // Need at least text or image
  if (!msg && !image) return;

  var historyToSend = _chatMessages.slice(-10);

  // Build the user message for display
  var userMsg = { role: 'user', text: msg || '' };
  if (image) {
    userMsg.image = 'data:' + image.mimeType + ';base64,' + image.data;
  }
  _chatMessages.push(userMsg);
  _lastUserMsgIdx = _chatMessages.length - 1;

  _chatPendingImage = null;
  _chatLoading = true;

  // Clear input without full re-render
  if (input) input.value = '';
  _updateImagePreview();
  _updateSendBtnState();
  _updateLoadingState();
  _updateChatMessages(false); // scroll to bottom to show user msg + typing

  try {
    var body = { message: msg || 'Analyse cette image.', context: getChatContext(), history: historyToSend };
    if (image) {
      body.image = { mimeType: image.mimeType, data: image.data };
    }
    var resp = await fetch(SUPABASE_URL + '/functions/v1/dax-tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    });
    var data = await resp.json();
    if (data.error) {
      _chatMessages.push({ role: 'bot', text: data.error });
    } else {
      _chatMessages.push({ role: 'bot', text: data.reply });
    }
  } catch (err) {
    _chatMessages.push({ role: 'bot', text: 'Erreur de connexion au serveur.' });
  }

  _chatLoading = false;
  _updateLoadingState();

  // Strip base64 images before saving to localStorage (too large)
  var toSave = _chatMessages.slice(-50).map(function(m) {
    if (m.image) return { role: m.role, text: m.text, image: '[image]' };
    return m;
  });
  try { localStorage.setItem('pbi-chat', JSON.stringify(toSave)); } catch(e) {}

  // Update messages, scroll to user question (not bottom)
  _updateChatMessages(true);
}
