import { S, getSaveData, applyData, save, setSyncCallback, SUPABASE_URL, SUPABASE_ANON_KEY, supabaseClient } from '../core/state.js';
import { h, render } from '../core/render.js';
import { icon } from '../core/icons.js';
import { showNotification } from './gamification.js';

let _syncCode = localStorage.getItem('pbi-sync-code') || null;
let _syncUpdatedAt = parseInt(localStorage.getItem('pbi-sync-updated') || '0');
let _syncPending = false;
let _syncDebounceTimer = null;

export function getSyncCode() { return _syncCode; }

export async function syncPush() {
  if (!_syncCode || _syncPending || !supabaseClient) return;
  _syncPending = true;
  try {
    var now = Date.now();
    var { error } = await supabaseClient.from('users').upsert({
      code: _syncCode,
      data: getSaveData(),
      updated_at: now
    });
    if (!error) {
      _syncUpdatedAt = now;
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
    }
  } catch(e) { /* offline */ }
  _syncPending = false;
}

export async function syncPull() {
  if (!_syncCode || !supabaseClient) return;
  try {
    var { data: row, error } = await supabaseClient.from('users').select('data, updated_at').eq('code', _syncCode).single();
    if (!error && row) {
      _syncUpdatedAt = row.updated_at;
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
      applyData(row.data);
      try { localStorage.setItem('pbi-pl300', JSON.stringify(row.data)); } catch(e) {}
      render();
    }
  } catch(e) { /* offline */ }
}

function _generateCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (var j = 0; j < 4; j++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function syncGenerate() {
  if (!supabaseClient) { showNotification('Supabase non disponible.', 'xp'); return null; }
  try {
    var code = _generateCode();
    var now = Date.now();
    var { error } = await supabaseClient.from('users').insert({
      code: code, data: getSaveData(), updated_at: now, created_at: now
    });
    if (!error) {
      _syncCode = code;
      localStorage.setItem('pbi-sync-code', _syncCode);
      _syncUpdatedAt = now;
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
      render();
      showNotification('Code cr\u00e9\u00e9 : ' + _syncCode, 'xp');
      return code;
    }
  } catch(e) {
    showNotification('Erreur r\u00e9seau. R\u00e9essaie.', 'xp');
  }
  return null;
}

export async function syncConnect(code) {
  if (!supabaseClient) return false;
  code = code.toUpperCase().trim();
  try {
    var { data: row, error } = await supabaseClient.from('users').select('code, data, updated_at').eq('code', code).single();
    if (!error && row) {
      _syncCode = row.code;
      localStorage.setItem('pbi-sync-code', _syncCode);
      _syncUpdatedAt = row.updated_at;
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
      applyData(row.data);
      try { localStorage.setItem('pbi-pl300', JSON.stringify(row.data)); } catch(e) {}
      render();
      showNotification('Connect\u00e9 ! Progression r\u00e9cup\u00e9r\u00e9e.', 'xp');
      return true;
    } else {
      showNotification('Code introuvable.', 'xp');
      return false;
    }
  } catch(e) {
    showNotification('Erreur r\u00e9seau. R\u00e9essaie.', 'xp');
    return false;
  }
}

export function syncDisconnect() {
  _syncCode = null;
  _syncUpdatedAt = 0;
  localStorage.removeItem('pbi-sync-code');
  localStorage.removeItem('pbi-sync-updated');
  render();
  showNotification('D\u00e9connect\u00e9 de la synchro.', 'xp');
}

export function showSyncModal() {
  // Remove existing modal
  var existing = document.getElementById('sync-modal');
  if (existing) { existing.remove(); return; }

  var overlay = h('div', {
    id: 'sync-modal',
    className: 'onboarding-overlay',
    onClick: (e) => { if (e.target.id === 'sync-modal') e.target.remove(); }
  });

  var card = h('div', { className: 'onboarding-card', style: { textAlign: 'left', maxWidth: '400px' } });
  card.appendChild(h('h2', { style: { textAlign: 'center', marginBottom: '16px' } }, icon('cloud', 24), ' Synchronisation'));

  if (_syncCode) {
    // Connected state
    card.appendChild(h('p', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '12px' } }, 'Ta progression est synchronis\u00e9e sur tous tes appareils.'));
    card.appendChild(h('div', { style: { textAlign: 'center', marginBottom: '16px' } },
      h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginBottom: '4px' } }, 'Ton code de synchro :'),
      h('div', {
        id: 'sync-code-display',
        style: { fontSize: '28px', fontWeight: '700', fontFamily: 'var(--mono)', letterSpacing: '2px', color: 'var(--accent)', padding: '12px', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--bd)' }
      }, _syncCode)
    ));
    card.appendChild(h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } },
      h('button', {
        onClick: () => {
          navigator.clipboard.writeText(_syncCode).then(() => showNotification('Code copi\u00e9 !', 'xp'));
        },
        style: { padding: '8px 16px', fontSize: '13px' }
      }, icon('copy', 14), ' Copier'),
      h('button', {
        onClick: () => { syncPull(); var m = document.getElementById('sync-modal'); if (m) m.remove(); },
        style: { padding: '8px 16px', fontSize: '13px', color: 'var(--accent)', borderColor: 'var(--accent)' }
      }, icon('cloud', 14), ' Forcer la synchro'),
      h('button', {
        onClick: () => { syncDisconnect(); var m = document.getElementById('sync-modal'); if (m) m.remove(); },
        style: { padding: '8px 16px', fontSize: '13px', color: 'var(--red)', borderColor: 'var(--red)' }
      }, 'D\u00e9connecter')
    ));
  } else {
    // Not connected state
    card.appendChild(h('p', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '16px', textAlign: 'center' } },
      'Synchronise ta progression entre tous tes appareils (PC, t\u00e9l\u00e9phone, tablette).'
    ));

    // Option 1: Generate new code
    card.appendChild(h('div', { style: { marginBottom: '20px' } },
      h('div', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' } }, 'Premier appareil ?'),
      h('button', {
        onClick: async () => {
          var code = await syncGenerate();
          if (code) { var m = document.getElementById('sync-modal'); if (m) m.remove(); showSyncModal(); }
        },
        style: { width: '100%', padding: '12px', fontSize: '14px', fontWeight: '500', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)' }
      }, 'Cr\u00e9er un code de synchro')
    ));

    // Option 2: Enter existing code
    card.appendChild(h('div', null,
      h('div', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--green)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' } }, 'D\u00e9j\u00e0 un code ?'),
      h('input', {
        id: 'sync-code-input',
        type: 'text',
        placeholder: 'XXXX-XXXX',
        maxLength: 9,
        style: { width: '100%', padding: '12px', fontSize: '18px', fontFamily: 'var(--mono)', textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase', border: '1px solid var(--bd)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--tx)', fontFamily: 'var(--mono)', outline: 'none', marginBottom: '8px' },
        onInput: (e) => {
          var v = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
          if (v.length > 4 && v.indexOf('-') === -1) v = v.slice(0, 4) + '-' + v.slice(4);
          e.target.value = v.slice(0, 9);
        },
        onKeydown: (e) => {
          if (e.key === 'Enter') {
            document.getElementById('sync-connect-btn')?.click();
          }
        }
      }),
      h('button', {
        id: 'sync-connect-btn',
        onClick: async () => {
          var inp = document.getElementById('sync-code-input');
          if (inp && inp.value.length === 9) {
            var ok = await syncConnect(inp.value);
            if (ok) { var m = document.getElementById('sync-modal'); if (m) m.remove(); }
          } else {
            showNotification('Entre un code complet : XXXX-XXXX', 'xp');
          }
        },
        style: { width: '100%', padding: '12px', fontSize: '14px', fontWeight: '500', background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--radius)' }
      }, 'Se connecter')
    ));
  }

  // Close button
  card.appendChild(h('button', {
    onClick: () => { var m = document.getElementById('sync-modal'); if (m) m.remove(); },
    style: { width: '100%', marginTop: '16px', padding: '8px', fontSize: '13px', color: 'var(--tx3)' }
  }, 'Fermer'));

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export function initSync() {
  setSyncCallback(function() {
    if (_syncCode) {
      clearTimeout(_syncDebounceTimer);
      _syncDebounceTimer = setTimeout(function() { syncPush(); }, 3000);
    }
  });
}
