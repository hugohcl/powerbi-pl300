import { S, SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/state.js';
import { h } from '../core/render.js';
import { getLevel } from './gamification.js';

var _chatMessages = JSON.parse(localStorage.getItem('pbi-chat') || '[]');
var _chatOpen = false;
var _chatLoading = false;

function getChatContext() {
  var ctx = 'Niveau : ' + window.LEVELS[getLevel(S.xp)].name;
  if (S.tab === 'formation' && S.chapterIdx !== null && window.CHAPTERS[S.chapterIdx]) {
    ctx += '. Chapitre en cours : ' + window.CHAPTERS[S.chapterIdx].title;
  }
  ctx += '. IMPORTANT : Réponds de façon très concise (2-3 phrases max). Ne développe que si l\'utilisateur le demande explicitement.';
  return ctx;
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

function _scrollChatToBottom() {
  var ma = document.getElementById('chat-messages');
  if (ma) ma.scrollTop = ma.scrollHeight;
}

function _renderMessageEl(m) {
  return h('div', { className: 'chat-msg ' + m.role }, m.text);
}

function _updateChatMessages() {
  var msgArea = document.getElementById('chat-messages');
  if (!msgArea) return;

  msgArea.innerHTML = '';
  if (_chatMessages.length === 0) {
    msgArea.appendChild(h('div', { className: 'chat-msg bot' }, 'Salut ! Je suis ton tuteur Power BI. Pose-moi une question sur DAX, Power Query, ou la certification PL-300.'));
  }
  _chatMessages.forEach(function(m) {
    msgArea.appendChild(_renderMessageEl(m));
  });
  if (_chatLoading) {
    msgArea.appendChild(h('div', { className: 'chat-msg bot typing' }, '...'));
  }
  _scrollChatToBottom();
}

export function renderChatPanel() {
  var existing = document.querySelector('.chat-panel');
  if (existing) {
    if (!_chatOpen) { existing.remove(); return; }
    // Panel already exists — just update messages in-place
    _updateChatMessages();
    return;
  }
  if (!_chatOpen) return;

  var panel = h('div', { className: 'chat-panel' });

  // Header
  panel.appendChild(h('div', { className: 'chat-header' },
    h('span', { className: 'chat-header-title' }, 'Tuteur IA'),
    h('button', { className: 'chat-close', onClick: function() { _chatOpen = false; document.querySelector('.chat-panel').remove(); renderChatFab(); } }, '\u00d7')
  ));

  // Messages
  var msgArea = h('div', { className: 'chat-messages', id: 'chat-messages' });
  panel.appendChild(msgArea);

  // Input
  var inputRow = h('div', { className: 'chat-input-row' });
  var input = h('input', {
    type: 'text',
    placeholder: 'Pose ta question...',
    id: 'chat-input',
    onKeydown: function(e) { if (e.key === 'Enter' && !_chatLoading) sendChatMessage(); },
    onInput: function(e) {
      var btn = e.target.parentElement.querySelector('button');
      if (btn) { if (e.target.value.trim()) btn.classList.add('active'); else btn.classList.remove('active'); }
    }
  });
  var sendBtn = h('button', {
    onClick: function() { if (!_chatLoading) sendChatMessage(); },
    disabled: _chatLoading,
    id: 'chat-send-btn'
  });
  sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(inputRow);

  document.body.appendChild(panel);

  // Populate messages and focus
  _updateChatMessages();
  var ci = document.getElementById('chat-input');
  if (ci) ci.focus();
}

export async function sendChatMessage() {
  var input = document.getElementById('chat-input');
  if (!input || !input.value.trim()) return;
  var msg = input.value.trim();
  input.value = '';

  // Disable send button
  var sendBtn = document.getElementById('chat-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  var historyToSend = _chatMessages.slice(-10);
  _chatMessages.push({ role: 'user', text: msg });
  _chatLoading = true;
  _updateChatMessages();

  try {
    var resp = await fetch(SUPABASE_URL + '/functions/v1/dax-tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ message: msg, context: getChatContext(), history: historyToSend })
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
  if (sendBtn) sendBtn.disabled = false;
  try { localStorage.setItem('pbi-chat', JSON.stringify(_chatMessages.slice(-50))); } catch(e) {}
  _updateChatMessages();
}
