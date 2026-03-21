// ═══════════════════════════════════════════════════════════
// APP.JS — Logique applicative Formation PowerBI + PL-300
// ═══════════════════════════════════════════════════════════
const APP_VERSION = '1.3.13';

// ─── Syntax highlighting for DAX / M / SQL code blocks ───
function highlightCode(code) {
  const DAX_KEYWORDS = ['VAR','RETURN','EVALUATE','ORDER BY','DEFINE','MEASURE','COLUMN','TABLE','ASC','DESC','TRUE','FALSE','BLANK','IN','NOT','AND','OR','IF','ELSE','SWITCH','THEN'];
  const DAX_FUNCTIONS = [
    'CALCULATE','CALCULATETABLE','FILTER','ALL','ALLEXCEPT','ALLSELECTED','ALLNOBLANKROW',
    'VALUES','DISTINCT','RELATED','RELATEDTABLE','USERELATIONSHIP','CROSSFILTER','TREATAS',
    'SUM','SUMX','AVERAGE','AVERAGEX','MIN','MINX','MAX','MAXX','COUNT','COUNTA','COUNTX','COUNTROWS','COUNTBLANK','DISTINCTCOUNT','DISTINCTCOUNTNOBLANK',
    'DIVIDE','ROUND','ROUNDUP','ROUNDDOWN','INT','ABS','FIXED','CURRENCY',
    'RANKX','TOPN','EARLIER','EARLIEST',
    'ADDCOLUMNS','SELECTCOLUMNS','SUMMARIZE','SUMMARIZECOLUMNS','GROUPBY','CROSSJOIN','UNION','INTERSECT','EXCEPT','NATURALINNERJOIN','NATURALLEFTOUTERJOIN','DATATABLE','ROW','GENERATESERIES','GENERATE','GENERATEALL',
    'SELECTEDVALUE','HASONEVALUE','HASONEFILTER','ISFILTERED','ISCROSSFILTERED','ISBLANK','ISINSCOPE',
    'FIRSTDATE','LASTDATE','DATEADD','DATESYTD','DATESQTD','DATESMTD','TOTALYTD','TOTALQTD','TOTALMTD','SAMEPERIODLASTYEAR','PARALLELPERIOD','PREVIOUSMONTH','PREVIOUSQUARTER','PREVIOUSYEAR','NEXTMONTH','NEXTQUARTER','NEXTYEAR','STARTOFMONTH','STARTOFQUARTER','STARTOFYEAR','ENDOFMONTH','ENDOFQUARTER','ENDOFYEAR','CALENDARAUTO','CALENDAR',
    'FORMAT','CONCATENATE','CONCATENATEX','LEFT','RIGHT','MID','LEN','FIND','SEARCH','SUBSTITUTE','REPLACE','TRIM','UPPER','LOWER','PROPER','UNICHAR','REPT','COMBINEVALUES','PATHCONTAINS','PATHITEM','PATHITEMREVERSE','PATHLENGTH',
    'YEAR','MONTH','DAY','QUARTER','WEEKNUM','WEEKDAY','HOUR','MINUTE','SECOND','NOW','TODAY','DATE','TIME','EOMONTH','EDATE',
    'KEEPFILTERS','REMOVEFILTERS','LOOKUPVALUE','CONTAINS','CONTAINSROW','CONTAINSSTRING','CONTAINSSTRINGEXACT','USERPRINCIPALNAME','USERNAME','CUSTOMDATA',
    'SELECTEDMEASURE','SELECTEDMEASURENAME','ISSELECTEDMEASURE',
    'MAXA','MINA','AVERAGEA','PRODUCT','PRODUCTX','GEOMEAN','GEOMEANX','MEDIAN','MEDIANX','PERCENTILE.INC','PERCENTILE.EXC',
    'NORM.DIST','NORM.INV','NORM.S.DIST','NORM.S.INV','POISSON.DIST','BETA.DIST','BETA.INV','CHISQ.DIST','CHISQ.INV',
    // M / Power Query
    'Table.AddColumn','Table.TransformColumnTypes','Table.SelectRows','Table.RemoveColumns','Table.RenameColumns','Table.ExpandTableColumn','Table.Group','Table.Sort','Table.Distinct','Table.Buffer','Table.NestedJoin','Table.Join','Table.Combine','Table.UnpivotColumns','Table.Pivot','Table.FillDown','Table.FillUp','Table.ReplaceValue','Table.TransformColumns','Table.PromoteHeaders','Table.Skip','Table.FirstN','Table.Range','Table.SplitColumn',
    'PostgreSQL.Database','Sql.Database','Excel.Workbook','Csv.Document','Json.Document','Web.Contents','SharePoint.Files','Folder.Files',
    'List.Sum','List.Average','List.Min','List.Max','List.Count','List.Distinct','List.Sort','List.Contains','List.Transform','List.Select','List.Generate','List.Dates','List.Numbers',
    'Text.Combine','Text.Replace','Text.Split','Text.Contains','Text.Start','Text.End','Text.Length','Text.Trim','Text.Upper','Text.Lower','Text.Proper',
    'Number.Round','Number.RoundUp','Number.RoundDown','Number.From','Number.ToText',
    'Date.From','DateTime.From','Duration.From',
    'Record.Field','Record.AddField','Record.TransformFields',
    'Expression.Evaluate','Value.Type','Value.Is'
  ];
  const M_KEYWORDS = ['let','in','each','if','then','else','true','false','null','type','is','as','try','otherwise','not','and','or','meta','error','section','shared'];

  // Escape HTML
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // Comments
    if (code[i] === '/' && code[i+1] === '/') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      tokens.push({ type: 'com', text: code.slice(i, end) });
      i = end;
      continue;
    }
    // Strings
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') j++;
      tokens.push({ type: 'str', text: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Table[Column] references
    if (code[i] === '[') {
      let j = code.indexOf(']', i);
      if (j !== -1) {
        tokens.push({ type: 'ref', text: code.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
    }
    // Numbers (standalone)
    if (/\d/.test(code[i]) && (i === 0 || /[\s,(\-+*/=<>]/.test(code[i-1]))) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: 'num', text: code.slice(i, j) });
      i = j;
      continue;
    }
    // Words (identifiers, keywords, functions)
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_.]/.test(code[j])) j++;
      tokens.push({ type: 'word', text: code.slice(i, j) });
      i = j;
      continue;
    }
    // Everything else
    tokens.push({ type: 'other', text: code[i] });
    i++;
  }

  // Build highlighted HTML
  const kwSet = new Set(DAX_KEYWORDS.map(k => k.toUpperCase()));
  const fnSet = new Set(DAX_FUNCTIONS);
  const mKwSet = new Set(M_KEYWORDS);

  return tokens.map(t => {
    const e = esc(t.text);
    if (t.type === 'com') return '<span class="hl-com">' + e + '</span>';
    if (t.type === 'str') return '<span class="hl-str">' + e + '</span>';
    if (t.type === 'ref') return '<span class="hl-ref">' + e + '</span>';
    if (t.type === 'num') return '<span class="hl-num">' + e + '</span>';
    if (t.type === 'word') {
      if (kwSet.has(t.text.toUpperCase())) return '<span class="hl-kw">' + e + '</span>';
      if (mKwSet.has(t.text)) return '<span class="hl-kw">' + e + '</span>';
      if (fnSet.has(t.text)) return '<span class="hl-fn">' + e + '</span>';
      return e;
    }
    return e;
  }).join('');
}

// ─── State ───
const S = {
  tab: 'formation',
  // Formation
  chapterIdx: null, // null = chapter list
  // Quiz
  quizMode: 'training', // training | exam
  quizFilter: 'all', // all | PQ | MO | VA | DE | ch1-ch7
  quizQuestions: [],
  qi: 0,
  sel: null,
  shown: false,
  score: 0,
  total: 0,
  quizHistory: [], // {wrong question indices for review}
  multiSel: [],    // selected indices for type:"multi"
  orderSel: [],    // selected indices for type:"order"
  // Case studies
  caseMode: false,
  caseIdx: null,    // which case is selected
  caseQi: 0,        // current question in case
  caseSel: null,
  caseShown: false,
  caseScore: 0,
  caseTotal: 0,
  // Exam
  examActive: false,
  examTimer: null,
  examTimeLeft: 0,
  examAnswers: [],
  // Flashcards
  fcFilter: 'all',
  fcIdx: 0,
  fcFlipped: false,
  // Progress
  missions: {},    // {missionId: true}
  checklist: {},   // {cl-chId-idx: true} — checklist séparée des missions
  known: {},       // {flashcardIdx: {ef, interval, repetitions, nextReview}} SM-2 data (migrated from old 0|1|2|3)
  quizStats: {},   // {questionHash: {right, wrong}}
  examHistory: [], // [{date, score, total, pct, byDomain}]
  examUserAnswers: [], // user answers during exam (parallel to quizQuestions)
  examReview: false,
  examFullReview: false,
  examReviewData: [],
  // Exercises
  exMode: false,
  exFilter: 'all',
  exDiffFilter: 0,
  exIdx: 0,
  exInput: '',
  exChecked: false,
  exCorrect: false,
  exHintLevel: 0,
  exShowSolution: false,
  exCompleted: {},
  // Guided mode
  exGuided: false,
  exGuidedStep: 0,
  exGuidedHints: {},  // {stepIdx: true} — hints revealed per step
  // Gamification
  xp: 0,
  level: 0,
  badges: [],
  streak: 0,
  lastActiveDate: null,
  xpHistory: [],
  // Interview tab
  interviewFilter: 'all',
  interviewReviewed: {},
  // Pomodoro
  pomodoro: {
    active: false,
    mode: 'work',
    timeLeft: 25 * 60,
    cycle: 0,
    interval: null,
    paused: false,
    dropdownOpen: false
  },
};

// ─── Sync config ───
const SYNC_API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3001/api'
  : '/api';
let _syncCode = localStorage.getItem('pbi-sync-code') || null;
let _syncUpdatedAt = parseInt(localStorage.getItem('pbi-sync-updated') || '0');
let _syncPending = false;
let _syncDebounceTimer = null;

// ─── Persistence ───
function getSaveData() {
  return { missions: S.missions, checklist: S.checklist, known: S.known, quizStats: S.quizStats, examHistory: S.examHistory, exCompleted: S.exCompleted, xp: S.xp, level: S.level, badges: S.badges, streak: S.streak, lastActiveDate: S.lastActiveDate, xpHistory: S.xpHistory, interviewReviewed: S.interviewReviewed };
}

function save() {
  const data = getSaveData();
  try { localStorage.setItem('pbi-pl300', JSON.stringify(data)); } catch(e) {}
  // Debounced cloud sync (push every 3s max)
  if (_syncCode) {
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(() => syncPush(), 3000);
  }
}

function applyData(d) {
  if (!d) return;
  S.missions = d.missions || {};
  // Migration : déplacer les entrées cl-* de missions vers checklist
  Object.keys(S.missions).forEach(k => {
    if (k.startsWith('cl-')) {
      if (!d.checklist) d.checklist = {};
      d.checklist[k] = S.missions[k];
      delete S.missions[k];
    }
  });
  S.checklist = d.checklist || {};
  S.known = d.known || {};
  S.quizStats = d.quizStats || {};
  S.examHistory = d.examHistory || [];
  S.exCompleted = d.exCompleted || {};
  S.xp = d.xp || 0;
  S.level = d.level || 0;
  S.badges = d.badges || [];
  S.streak = d.streak || 0;
  S.lastActiveDate = d.lastActiveDate || null;
  S.xpHistory = d.xpHistory || [];
  S.interviewReviewed = d.interviewReviewed || {};
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('pbi-pl300'));
    if (d) applyData(d);
  } catch(e) {}
}

// ─── Cloud Sync ───
async function syncPush() {
  if (!_syncCode || _syncPending) return;
  _syncPending = true;
  try {
    const res = await fetch(SYNC_API + '/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: _syncCode, data: getSaveData(), updated_at: _syncUpdatedAt })
    });
    if (res.ok) {
      const json = await res.json();
      _syncUpdatedAt = json.updated_at;
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
      if (json.status === 'merged' && json.data) {
        applyData(json.data);
        try { localStorage.setItem('pbi-pl300', JSON.stringify(json.data)); } catch(e) {}
        render();
      }
    }
  } catch(e) { /* offline — will sync later */ }
  _syncPending = false;
}

async function syncPull() {
  if (!_syncCode) return;
  try {
    const res = await fetch(SYNC_API + '/sync/pull/' + _syncCode);
    if (res.ok) {
      const json = await res.json();
      _syncUpdatedAt = json.updated_at;
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
      applyData(json.data);
      try { localStorage.setItem('pbi-pl300', JSON.stringify(json.data)); } catch(e) {}
      render();
      showNotification('Progression synchronisée !', 'xp');
    }
  } catch(e) { /* offline */ }
}

async function syncGenerate() {
  try {
    const res = await fetch(SYNC_API + '/sync/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: getSaveData() })
    });
    if (res.ok) {
      const json = await res.json();
      _syncCode = json.code;
      localStorage.setItem('pbi-sync-code', _syncCode);
      _syncUpdatedAt = Date.now();
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
      render();
      showNotification('Code créé : ' + _syncCode, 'xp');
      return json.code;
    }
  } catch(e) {
    showNotification('Erreur réseau. Réessaie.', 'xp');
  }
  return null;
}

async function syncConnect(code) {
  code = code.toUpperCase().trim();
  try {
    const res = await fetch(SYNC_API + '/sync/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (res.ok) {
      const json = await res.json();
      _syncCode = json.code;
      localStorage.setItem('pbi-sync-code', _syncCode);
      _syncUpdatedAt = json.updated_at;
      localStorage.setItem('pbi-sync-updated', String(_syncUpdatedAt));
      applyData(json.data);
      try { localStorage.setItem('pbi-pl300', JSON.stringify(json.data)); } catch(e) {}
      render();
      showNotification('Connecté ! Progression récupérée.', 'xp');
      return true;
    } else {
      const err = await res.json();
      showNotification(err.error || 'Code introuvable.', 'xp');
      return false;
    }
  } catch(e) {
    showNotification('Erreur réseau. Réessaie.', 'xp');
    return false;
  }
}

function syncDisconnect() {
  _syncCode = null;
  _syncUpdatedAt = 0;
  localStorage.removeItem('pbi-sync-code');
  localStorage.removeItem('pbi-sync-updated');
  render();
  showNotification('Déconnecté de la synchro.', 'xp');
}

function showSyncModal() {
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
    card.appendChild(h('p', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '12px' } }, 'Ta progression est synchronisée sur tous tes appareils.'));
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
          navigator.clipboard.writeText(_syncCode).then(() => showNotification('Code copié !', 'xp'));
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
      }, 'Déconnecter')
    ));
  } else {
    // Not connected state
    card.appendChild(h('p', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '16px', textAlign: 'center' } },
      'Synchronise ta progression entre tous tes appareils (PC, téléphone, tablette).'
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
      }, 'Créer un code de synchro')
    ));

    // Option 2: Enter existing code
    card.appendChild(h('div', null,
      h('div', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--green)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' } }, 'Déjà un code ?'),
      h('input', {
        id: 'sync-code-input',
        type: 'text',
        placeholder: 'XXXX-XXXX',
        maxLength: 9,
        style: { width: '100%', padding: '12px', fontSize: '18px', fontFamily: 'var(--mono)', textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase', border: '1px solid var(--bd)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--tx)', outline: 'none', marginBottom: '8px' },
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

// ─── SM-2 Spaced Repetition ───
function sm2Default() {
  return { ef: 2.5, interval: 1, repetitions: 0, nextReview: 0 };
}
function sm2Get(idx) {
  const v = S.known[idx];
  if (!v || typeof v === 'number') {
    // Migrate from old box system
    const box = (typeof v === 'number') ? v : 0;
    const d = sm2Default();
    if (box >= 3) { d.ef = 2.5; d.interval = 7; d.repetitions = 3; d.nextReview = Date.now() + 7*86400000; }
    else if (box === 2) { d.ef = 2.3; d.interval = 3; d.repetitions = 2; d.nextReview = Date.now() + 3*86400000; }
    else if (box === 1) { d.ef = 2.1; d.interval = 1; d.repetitions = 1; d.nextReview = Date.now() + 86400000; }
    S.known[idx] = d;
    return d;
  }
  return v;
}
function sm2Update(idx, quality) {
  // quality: 1=à revoir, 3=difficile, 5=facile
  const d = sm2Get(idx);
  if (quality >= 3) {
    d.repetitions++;
    if (d.repetitions === 1) d.interval = 1;
    else if (d.repetitions === 2) d.interval = 6;
    else d.interval = Math.round(d.interval * d.ef);
    const q = quality;
    d.ef = Math.max(1.3, d.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  } else {
    d.repetitions = 0;
    d.interval = 1;
    // ef stays
  }
  d.nextReview = Date.now() + d.interval * 86400000;
  var wasMastered = S.known[idx] && typeof S.known[idx] === 'object' && S.known[idx].repetitions >= 3 && S.known[idx].interval >= 7;
  S.known[idx] = d;
  if (!wasMastered && d.repetitions >= 3 && d.interval >= 7 && typeof XP_REWARDS !== 'undefined') {
    addXP(XP_REWARDS.flashcard_mastered, 'Flashcard');
  }
  save();
}
function sm2DaysUntilReview(idx) {
  const d = sm2Get(idx);
  const diff = d.nextReview - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}
function sm2IsDue(idx) {
  const d = sm2Get(idx);
  return d.nextReview <= Date.now();
}
function sm2IsMastered(idx) {
  const d = sm2Get(idx);
  return d.repetitions >= 3 && d.interval >= 7;
}
function getDueCards() {
  return FLASHCARDS.map((_, i) => i).filter(i => sm2IsDue(i));
}

// ─── Helpers ───
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.flat(3).forEach(c => {
    if (c == null || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}
function shuf(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function qHash(q) { return q.q.slice(0, 40); }
function $(sel) { return document.querySelector(sel); }
function getTotalMissions() { return CHAPTERS.reduce(function(s, c) { return s + (c.missions[1] - c.missions[0] + 1); }, 0); }

// ─── Theme ───
function initTheme() {
  const saved = localStorage.getItem('pbi-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('pbi-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('pbi-theme', 'dark');
  }
  render();
}

// ─── Render ───
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderHeader());

  // Search overlay
  if (S.searchOpen) {
    const searchBox = h('div', { style: { marginBottom: '16px', padding: '16px', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bd)' } },
      h('input', {
        id: 'search-input',
        type: 'text',
        placeholder: 'Rechercher dans toute l\'app (DAX, RANKX, mesure...)...',
        value: S.searchQuery || '',
        style: { width: '100%', padding: '10px 14px', fontSize: '15px', border: '1px solid var(--bd)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: 'var(--font)', outline: 'none' },
        onInput: (e) => { S.searchQuery = e.target.value; render(); setTimeout(() => { const inp = document.getElementById('search-input'); if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = inp.value.length; } }, 10); },
        onKeydown: (e) => { if (e.key === 'Escape') { S.searchOpen = false; render(); } }
      }),
      h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginTop: '6px' } }, '\u00C9chap pour fermer \u00B7 Cherche dans sections, quiz, flashcards, mesures, glossaire, missions')
    );
    app.appendChild(searchBox);
    if (S.searchQuery && S.searchQuery.length >= 2) {
      app.appendChild(renderSearch(S.searchQuery));
    }
    return;
  }

  app.appendChild(renderTabs());

  // Add fade-in animation
  const content = h('div', { className: 'fade-in' });
  if (S.tab === 'formation') content.appendChild(renderFormation());
  else if (S.tab === 'quiz') content.appendChild(renderQuiz());
  else if (S.tab === 'flash') content.appendChild(renderFlashcards());
  else if (S.tab === 'interview') content.appendChild(renderInterview());
  else if (S.tab === 'ref') content.appendChild(renderReference());
  else if (S.tab === 'progress') content.appendChild(renderProgress());
  app.appendChild(content);
}

// ─── SVG Icon helpers ───
function iconSearch() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>';
  return svg;
}
function iconTimer() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
  return svg;
}
function iconSun() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  return svg;
}
function iconMoon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  return svg;
}

// ─── SVG Icons library ───
function icon(name, size) {
  size = size || 16;
  var svgNS = 'http://www.w3.org/2000/svg';
  var s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('width', String(size)); s.setAttribute('height', String(size));
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  var paths = {
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    flame: '<path d="M12 22c-4.97 0-7-3.58-7-7 0-4 3-7.5 4-9 .5 2 2 3 2 3 0-4 3-7 5-9 0 3 2 5 2 7s1 4-1 6c3-1 4-4 4-6 1 2 1 4 1 6 0 3.42-2.03 7-7 7z" fill="currentColor" stroke="none"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    xp: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    timer: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
    shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'
  };
  s.innerHTML = paths[name] || paths.xp;
  return s;
}

// ─── Gamification ───
function getLevel(xp) {
  var lvl = 0;
  for (var i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) lvl = i;
  }
  return lvl;
}

function addXP(amount, source) {
  if (!amount || amount <= 0) return;
  S.xp += amount;
  // XP history
  var today = new Date().toISOString().slice(0, 10);
  var last = S.xpHistory.length > 0 ? S.xpHistory[S.xpHistory.length - 1] : null;
  if (last && last.date === today) last.xp += amount;
  else S.xpHistory.push({ date: today, xp: amount });
  // Keep 30 days
  if (S.xpHistory.length > 30) S.xpHistory = S.xpHistory.slice(-30);
  // Streak
  updateStreak();
  // Level up?
  var newLvl = getLevel(S.xp);
  if (newLvl > S.level) {
    S.level = newLvl;
    showNotification('Niveau ' + LEVELS[newLvl].name + ' atteint !', 'level');
  }
  // Show XP notif
  showNotification('+' + amount + ' XP' + (source ? ' (' + source + ')' : ''), 'xp');
  // Check badges
  checkBadges();
  save();
}

function updateStreak() {
  var today = new Date().toISOString().slice(0, 10);
  if (S.lastActiveDate === today) return;
  if (S.lastActiveDate) {
    var last = new Date(S.lastActiveDate);
    var now = new Date(today);
    var diff = Math.round((now - last) / 86400000);
    if (diff === 1) S.streak++;
    else if (diff > 1) S.streak = 1;
  } else {
    S.streak = 1;
  }
  S.lastActiveDate = today;
}

function checkBadges() {
  if (typeof BADGES === 'undefined') return;
  BADGES.forEach(function(b) {
    if (S.badges.indexOf(b.id) !== -1) return; // already earned
    var earned = false;
    var cond = b.condition;
    if (cond === 'mission_1') earned = Object.keys(S.missions).filter(function(k) { return S.missions[k]; }).length >= 1;
    else if (cond.match(/^chapter_(\d+)_complete$/)) {
      var chId = parseInt(cond.match(/^chapter_(\d+)_complete$/)[1]);
      var ch = CHAPTERS.find(function(c) { return c.id === chId; });
      if (ch) {
        var allDone = true;
        for (var i = ch.missions[0]; i <= ch.missions[1]; i++) { if (!S.missions[i]) allDone = false; }
        earned = allDone;
      }
    }
    else if (cond === 'streak_7') earned = S.streak >= 7;
    else if (cond === 'streak_30') earned = S.streak >= 30;
    else if (cond === 'quiz_total_100') {
      var total = Object.values(S.quizStats).reduce(function(s, v) { return s + v.right + v.wrong; }, 0);
      earned = total >= 100;
    }
    else if (cond === 'flash_50') {
      var mastered = FLASHCARDS.filter(function(_, i) { return sm2IsMastered(i); }).length;
      earned = mastered >= 50;
    }
    else if (cond === 'exam_700') {
      earned = S.examHistory.some(function(e) { return e.score >= 700; });
    }
    else if (cond === 'quiz_calculate_10') {
      var calcQs = QUIZ.filter(function(q) { return q.q.toLowerCase().indexOf('calculate') !== -1; });
      var right = 0;
      calcQs.forEach(function(q) { var st = S.quizStats[qHash(q)]; if (st) right += st.right; });
      earned = right >= 10;
    }
    else if (cond === 'quiz_ti_10') {
      var tiQs = QUIZ.filter(function(q) { return q.ch === 6; });
      var right2 = 0;
      tiQs.forEach(function(q) { var st = S.quizStats[qHash(q)]; if (st) right2 += st.right; });
      earned = right2 >= 10;
    }
    else if (cond === 'exercises_all') {
      var exs = typeof EXERCISES !== 'undefined' ? EXERCISES : [];
      earned = exs.length > 0 && exs.every(function(e) { return S.exCompleted[e.id]; });
    }
    else if (cond === 'racing_complete') {
      earned = typeof RACING_MISSIONS !== 'undefined' && RACING_MISSIONS.length > 0 && RACING_MISSIONS.every(function(rm) { return S.missions['racing_' + rm.id]; });
    }
    if (earned) {
      S.badges.push(b.id);
      showNotification('Badge : ' + b.name + ' !', 'badge-notif');
    }
  });
}

var _notifTimeout = null;
function showNotification(text, type) {
  var existing = document.querySelector('.notification');
  if (existing) existing.remove();
  var notif = document.createElement('div');
  notif.className = 'notification ' + (type || 'xp');
  notif.textContent = text;
  document.body.appendChild(notif);
  clearTimeout(_notifTimeout);
  _notifTimeout = setTimeout(function() {
    if (notif.parentNode) {
      notif.style.animation = 'notifOut .3s ease forwards';
      setTimeout(function() { if (notif.parentNode) notif.remove(); }, 300);
    }
  }, 2500);
}

// ─── Onboarding ───
function showOnboarding() {
  if (localStorage.getItem('pbi-onboarded')) return;
  var overlay = h('div', { className: 'onboarding-overlay', id: 'onboarding' });
  var card = h('div', { className: 'onboarding-card' },
    h('div', { style: { marginBottom: '16px' } }, icon('award', 32)),
    h('h2', null, 'Bienvenue dans ton parcours PL-300'),
    h('p', null, 'Cette application te guide de z\u00e9ro \u00e0 la certification Power\u00a0BI PL-300.'),
    h('div', { style: { textAlign: 'left', margin: '20px 0' } },
      h('div', { className: 'onboarding-step' }, icon('book', 16), ' Formation\u00a0: 7 chapitres avec missions pratiques'),
      h('div', { className: 'onboarding-step' }, icon('target', 16), ' Quiz PL-300\u00a0: entra\u00eenement par domaine + examen blanc'),
      h('div', { className: 'onboarding-step' }, icon('zap', 16), ' Flashcards\u00a0: r\u00e9p\u00e9tition espac\u00e9e (SM-2)'),
      h('div', { className: 'onboarding-step' }, icon('flag', 16), ' Projet Racing Games\u00a0: application sur un projet r\u00e9el'),
      h('div', { className: 'onboarding-step' }, icon('trophy', 16), ' Objectif\u00a0: \u00ab\u00a0PL-300 Ready\u00a0\u00bb (3\u202f000 XP)')
    ),
    h('p', { style: { fontSize: '13px', color: 'var(--tx3)' } }, 'Tu gagnes des XP \u00e0 chaque action\u00a0: missions, quiz, exercices, flashcards.'),
    h('button', {
      onClick: function() {
        localStorage.setItem('pbi-onboarded', '1');
        var el = document.getElementById('onboarding');
        if (el) el.remove();
      },
      style: { padding: '12px 32px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', marginTop: '12px' }
    }, 'Commencer')
  );
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function renderHeader() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var headerRight = h('div', { className: 'header-right' });

  // Search button
  headerRight.appendChild(h('button', {
    onClick: () => { S.searchOpen = !S.searchOpen; S.searchQuery = ''; render(); if (S.searchOpen) setTimeout(() => { const inp = document.getElementById('search-input'); if (inp) inp.focus(); }, 50); },
    style: { fontSize: '13px', padding: '4px 12px' }
  }, iconSearch(), isMobile() ? '' : ' Ctrl+K'));

  // Sync button
  var syncBtn = h('button', {
    onClick: () => { showSyncModal(); },
    style: { fontSize: '13px', padding: '4px 12px', color: _syncCode ? 'var(--green)' : 'var(--tx3)' }
  }, icon('cloud', 16), _syncCode ? '' : '');
  headerRight.appendChild(syncBtn);

  // Focus timer
  var pomWrap = h('div', { style: { position: 'relative' } });
  if (!S.pomodoro.active) {
    pomWrap.appendChild(h('button', {
      className: 'pomodoro-btn',
      onClick: function() { startPomodoro(); }
    }, iconTimer(), ' Focus'));
  } else {
    var pomM = Math.floor(S.pomodoro.timeLeft / 60);
    var pomS = S.pomodoro.timeLeft % 60;
    var modeLabels = { work: 'Focus', break: 'Pause', longBreak: 'Pause longue' };
    var pomClass = 'pomodoro-btn ' + (S.pomodoro.mode === 'work' ? 'pomodoro-active' : 'pomodoro-break');
    pomWrap.appendChild(h('button', {
      className: pomClass,
      onClick: function() { S.pomodoro.dropdownOpen = !S.pomodoro.dropdownOpen; render(); }
    },
      iconTimer(), ' ',
      h('span', { id: 'pomodoro-time' }, pomM + ':' + String(pomS).padStart(2, '0')),
      ' ',
      h('span', { id: 'pomodoro-mode-label' }, modeLabels[S.pomodoro.mode])
    ));

    if (S.pomodoro.dropdownOpen) {
      var dropdown = h('div', { className: 'pomodoro-dropdown' });
      var bigTime = h('div', { style: { fontSize: '28px', fontWeight: '600', fontFamily: 'var(--mono)', textAlign: 'center', marginBottom: '8px' } },
        pomM + ':' + String(pomS).padStart(2, '0')
      );
      dropdown.appendChild(bigTime);
      dropdown.appendChild(h('div', { style: { textAlign: 'center', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: S.pomodoro.mode === 'work' ? 'var(--red)' : 'var(--green)' } },
        modeLabels[S.pomodoro.mode]
      ));
      dropdown.appendChild(h('div', { style: { textAlign: 'center', fontSize: '12px', color: 'var(--tx3)', marginBottom: '14px' } },
        'Cycle ' + (S.pomodoro.cycle + 1) + '/4'
      ));
      var pomBtns = h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center' } });
      pomBtns.appendChild(h('button', {
        onClick: function() { pausePomodoro(); },
        style: { fontSize: '12px', padding: '4px 12px' }
      }, S.pomodoro.paused ? '\u25BA Reprendre' : '\u2016 Pause'));
      pomBtns.appendChild(h('button', {
        onClick: function() { resetPomodoro(); },
        style: { fontSize: '12px', padding: '4px 12px' }
      }, 'Reset'));
      pomBtns.appendChild(h('button', {
        onClick: function() { stopPomodoro(); },
        style: { fontSize: '12px', padding: '4px 12px', color: 'var(--red)', borderColor: 'var(--red)' }
      }, 'Stop'));
      dropdown.appendChild(pomBtns);
      pomWrap.appendChild(dropdown);
    }
  }
  headerRight.appendChild(pomWrap);

  // Music button
  var musicBtn = h('button', { className: 'theme-btn', title: 'Ambiance studieuse', onClick: function() { window.location.href = 'music://music.apple.com/fr/station/ambiance-studieuse/ra.q-MMLEBw'; } });
  musicBtn.appendChild(icon('music', 16));
  headerRight.appendChild(musicBtn);

  // Theme button
  var themeBtn = h('button', { className: 'theme-btn', onClick: toggleTheme });
  themeBtn.appendChild(isDark ? icon('sun', 16) : icon('moon', 16));
  headerRight.appendChild(themeBtn);

  // XP bar section
  var lvl = getLevel(S.xp);
  var lvlData = LEVELS[lvl];
  var nextLvl = lvl < LEVELS.length - 1 ? LEVELS[lvl + 1] : null;
  var xpInLevel = S.xp - lvlData.xp;
  var xpForNext = nextLvl ? (nextLvl.xp - lvlData.xp) : 1;
  var xpPct = nextLvl ? Math.min(100, Math.round(xpInLevel / xpForNext * 100)) : 100;
  var xpSection = h('div', { className: 'header-xp' },
    h('span', { className: 'level-badge' }, lvlData.name),
    h('div', { className: 'xp-bar' },
      h('div', { className: 'xp-fill', style: { width: xpPct + '%' } })
    ),
    h('span', { style: { fontSize: '10px', color: 'var(--tx3)' } }, S.xp + ' XP')
  );
  if (S.streak > 0) {
    xpSection.appendChild(h('span', { className: 'streak-badge' }, icon('flame', 14), String(S.streak)));
  }

  return h('div', { className: 'header' },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
      h('h1', { style: { whiteSpace: 'nowrap', cursor: 'pointer' }, onClick: function() { S.chapterIdx = null; S.tab = 'formation'; render(); } }, 'Formation Power BI'),
      h('span', { style: { fontSize: '9px', color: 'var(--tx3)', alignSelf: 'flex-end', marginBottom: '2px' } }, 'v' + APP_VERSION),
      xpSection
    ),
    headerRight
  );
}

function isMobile() { return window.innerWidth <= 600; }

function renderTabs() {
  const tabs = [
    ['formation', 'Formation', 'Cours', 'book'],
    ['quiz', 'Quiz PL-300', 'Quiz', 'target'],
    ['flash', 'Flashcards', 'Flash', 'zap'],
    ['interview', 'Entretien', 'Entret.', 'briefcase'],
    ['ref', 'Référence', 'Réf.', 'search'],
    ['progress', 'Progression', 'Progrès', 'award']
  ];
  return h('div', { className: 'tabs' },
    ...tabs.map(([id, label, shortLabel, iconName]) =>
      h('button', {
        className: 'tab' + (S.tab === id ? ' active' : ''),
        onClick: () => { S.tab = id; render(); }
      }, isMobile()
        ? h('span', { className: 'tab-inner' }, icon(iconName, 20), h('span', { className: 'tab-label' }, shortLabel))
        : label)
    )
  );
}

// ═══════════════════════════════════════════════════════════
// SVG DIAGRAMS
// ═══════════════════════════════════════════════════════════
function renderDiagram(type) {
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...children) {
    const el = document.createElementNS(svgNS, tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    children.flat(3).forEach(c => { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  if (type === 'star-schema') {
    const s = svg('svg', { viewBox: '0 0 600 400', style: 'width:100%;height:auto;max-width:600px;display:block;margin:12px auto;' });
    // Fact table (center)
    s.appendChild(svg('rect', { x: '210', y: '140', width: '180', height: '120', rx: '8', fill: 'var(--accent)', opacity: '0.15', stroke: 'var(--accent)', 'stroke-width': '2' }));
    s.appendChild(svg('text', { x: '300', y: '170', 'text-anchor': 'middle', fill: 'var(--accent)', 'font-weight': '700', 'font-size': '14', 'font-family': 'var(--font)' }, 'FactSales'));
    s.appendChild(svg('text', { x: '300', y: '192', 'text-anchor': 'middle', fill: 'var(--tx2)', 'font-size': '11', 'font-family': 'var(--mono)' }, 'ProductKey (FK)'));
    s.appendChild(svg('text', { x: '300', y: '208', 'text-anchor': 'middle', fill: 'var(--tx2)', 'font-size': '11', 'font-family': 'var(--mono)' }, 'CustomerKey (FK)'));
    s.appendChild(svg('text', { x: '300', y: '224', 'text-anchor': 'middle', fill: 'var(--tx2)', 'font-size': '11', 'font-family': 'var(--mono)' }, 'SalesAmount'));
    s.appendChild(svg('text', { x: '300', y: '240', 'text-anchor': 'middle', fill: 'var(--tx2)', 'font-size': '11', 'font-family': 'var(--mono)' }, 'OrderDate (FK)'));
    // Dim tables
    const dims = [
      { name: 'DimProduct', x: 30, y: 20, lx1: 120, ly1: 60, lx2: 210, ly2: 170 },
      { name: 'DimCustomer', x: 430, y: 20, lx1: 480, ly1: 60, lx2: 390, ly2: 170 },
      { name: 'DimTerritory', x: 30, y: 300, lx1: 120, ly1: 320, lx2: 210, ly2: 240 },
      { name: 'DimDate', x: 430, y: 300, lx1: 480, ly1: 320, lx2: 390, ly2: 240 }
    ];
    dims.forEach(d => {
      s.appendChild(svg('rect', { x: d.x, y: d.y, width: '140', height: '50', rx: '8', fill: 'var(--bg2)', stroke: 'var(--bd2)', 'stroke-width': '1.5' }));
      s.appendChild(svg('text', { x: d.x + 70, y: d.y + 30, 'text-anchor': 'middle', fill: 'var(--tx)', 'font-weight': '600', 'font-size': '13', 'font-family': 'var(--font)' }, d.name));
      s.appendChild(svg('line', { x1: d.lx1, y1: d.ly1, x2: d.lx2, y2: d.ly2, stroke: 'var(--bd2)', 'stroke-width': '1.5', 'stroke-dasharray': '4' }));
      // 1 and * labels
      s.appendChild(svg('text', { x: d.lx1 + (d.lx1 < 300 ? -10 : 10), y: d.ly1 + (d.ly1 < 200 ? 4 : -4), 'text-anchor': 'middle', fill: 'var(--green)', 'font-weight': '700', 'font-size': '14', 'font-family': 'var(--font)' }, '1'));
      s.appendChild(svg('text', { x: d.lx2 + (d.lx2 < 300 ? 10 : -10), y: d.ly2 + (d.ly2 < 200 ? 4 : -4), 'text-anchor': 'middle', fill: 'var(--red)', 'font-weight': '700', 'font-size': '14', 'font-family': 'var(--font)' }, '*'));
    });
    // Legend
    s.appendChild(svg('text', { x: '300', y: '390', 'text-anchor': 'middle', fill: 'var(--tx3)', 'font-size': '12', 'font-family': 'var(--font)' }, '1:N = une dimension filtre plusieurs faits'));
    const wrap = h('div', { className: 'box', style: { borderColor: 'var(--accent)', borderLeftWidth: '3px', padding: '14px' } },
      h('span', { className: 'box-label' }, 'Schema en etoile (Star Schema)')
    );
    wrap.appendChild(s);
    return wrap;
  }

  if (type === 'calculate-flow') {
    const s = svg('svg', { viewBox: '0 0 650 160', style: 'width:100%;height:auto;max-width:650px;display:block;margin:12px auto;' });
    const boxes = [
      { label: 'Contexte initial', sub: 'slicers, axes', x: 10, color: 'var(--accent)' },
      { label: 'CALCULATE modifie', sub: 'filtres +/-', x: 170, color: 'var(--purple)' },
      { label: 'Nouveau contexte', sub: 'filtre final', x: 330, color: 'var(--green)' },
      { label: 'Expression évaluée', sub: 'résultat', x: 490, color: 'var(--accent)' }
    ];
    boxes.forEach((b, i) => {
      s.appendChild(svg('rect', { x: b.x, y: '30', width: '140', height: '60', rx: '8', fill: b.color + '18', stroke: b.color, 'stroke-width': '1.5' }));
      s.appendChild(svg('text', { x: b.x + 70, y: '56', 'text-anchor': 'middle', fill: b.color, 'font-weight': '600', 'font-size': '12', 'font-family': 'var(--font)' }, b.label));
      s.appendChild(svg('text', { x: b.x + 70, y: '74', 'text-anchor': 'middle', fill: 'var(--tx3)', 'font-size': '10', 'font-family': 'var(--font)' }, b.sub));
      if (i < 3) {
        s.appendChild(svg('line', { x1: b.x + 140, y1: '60', x2: b.x + 170, y2: '60', stroke: 'var(--tx3)', 'stroke-width': '1.5', 'marker-end': 'url(#arrowCalc)' }));
      }
    });
    // Arrow marker
    const defs = svg('defs', {});
    const marker = svg('marker', { id: 'arrowCalc', viewBox: '0 0 10 10', refX: '10', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto' });
    marker.appendChild(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--tx3)' }));
    defs.appendChild(marker);
    s.appendChild(defs);
    // Annotation
    s.appendChild(svg('text', { x: '325', y: '130', 'text-anchor': 'middle', fill: 'var(--tx2)', 'font-size': '11', 'font-family': 'var(--font)', 'font-style': 'italic' }, 'Meme colonne = REMPLACE / Autre colonne = AJOUTE'));
    const wrap = h('div', { className: 'box', style: { borderColor: 'var(--purple)', borderLeftWidth: '3px', padding: '14px' } },
      h('span', { className: 'box-label' }, 'Flux CALCULATE')
    );
    wrap.appendChild(s);
    return wrap;
  }

  if (type === 'pq-pipeline') {
    const s = svg('svg', { viewBox: '0 0 700 100', style: 'width:100%;height:auto;max-width:700px;display:block;margin:12px auto;' });
    const steps = [
      { label: 'Source', abbr: 'SRC', x: 10 },
      { label: 'Types', abbr: 'TYP', x: 125 },
      { label: 'Nettoyage', abbr: 'CLN', x: 240 },
      { label: 'Transform.', abbr: 'TRN', x: 355 },
      { label: 'Merge', abbr: 'MRG', x: 470 },
      { label: 'Chargement', abbr: 'LDR', x: 585 }
    ];
    const defs = svg('defs', {});
    const marker = svg('marker', { id: 'arrowPQ', viewBox: '0 0 10 10', refX: '10', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto' });
    marker.appendChild(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--tx3)' }));
    defs.appendChild(marker);
    s.appendChild(defs);
    steps.forEach((st, i) => {
      s.appendChild(svg('rect', { x: st.x, y: '15', width: '100', height: '55', rx: '8', fill: 'var(--accent)' + (i === 0 || i === 5 ? '25' : '12'), stroke: 'var(--accent)', 'stroke-width': '1' }));
      s.appendChild(svg('text', { x: st.x + 50, y: '38', 'text-anchor': 'middle', fill: 'var(--accent)', 'font-size': '12', 'font-weight': '700', 'font-family': 'var(--mono)' }, st.abbr));
      s.appendChild(svg('text', { x: st.x + 50, y: '56', 'text-anchor': 'middle', fill: 'var(--tx)', 'font-size': '11', 'font-weight': '500', 'font-family': 'var(--font)' }, st.label));
      if (i < 5) {
        s.appendChild(svg('line', { x1: st.x + 100, y1: '42', x2: st.x + 125, y2: '42', stroke: 'var(--tx3)', 'stroke-width': '1.5', 'marker-end': 'url(#arrowPQ)' }));
      }
    });
    const wrap = h('div', { className: 'box', style: { borderColor: 'var(--accent)', borderLeftWidth: '3px', padding: '14px' } },
      h('span', { className: 'box-label' }, 'Pipeline Power Query')
    );
    wrap.appendChild(s);
    return wrap;
  }

  return h('div');
}

// ═══════════════════════════════════════════════════════════
// FORMATION TAB
// ═══════════════════════════════════════════════════════════
// ─── Progress / Roadmap ───
function getProgress() {
  var chProgress = CHAPTERS.map(function(ch) {
    var total = ch.missions[1] - ch.missions[0] + 1;
    var done = 0;
    for (var i = ch.missions[0]; i <= ch.missions[1]; i++) {
      if (S.missions[i]) done++;
    }
    return { ch: ch.id, done: done, total: total, pct: Math.round(done / total * 100) };
  });
  var totalMissions = chProgress.reduce(function(a, c) { return a + c.done; }, 0);
  var totalMissionsMax = CHAPTERS.reduce(function(s, c) { return s + (c.missions[1] - c.missions[0] + 1); }, 0);
  var fcMastered = FLASHCARDS.filter(function(_, i) {
    var d = sm2Get(i);
    return d.interval >= 7;
  }).length;
  var quizPct = 0;
  var quizTotal = 0;
  Object.keys(DOMAINS).forEach(function(d) {
    var qs = QUIZ.filter(function(q) { return q.d === d; });
    var right = 0, total = 0;
    qs.forEach(function(q) {
      var st = S.quizStats[qHash(q)];
      if (st) { right += st.right; total += st.right + st.wrong; }
    });
    if (total > 0) { quizPct += right / total; quizTotal++; }
  });
  var avgQuizPct = quizTotal > 0 ? Math.round(quizPct / quizTotal * 100) : 0;
  var bestExam = S.examHistory.length > 0 ? Math.max.apply(null, S.examHistory.map(function(e) { return e.score || 0; })) : 0;
  var phase = 1;
  var nextStep = '';
  var nextAction = null;
  if (totalMissions < totalMissionsMax * 0.8) {
    phase = 1;
    var incompleteCh = chProgress.find(function(c) { return c.pct < 70; });
    if (incompleteCh) {
      var chData = CHAPTERS[incompleteCh.ch - 1];
      nextStep = 'Continue le Ch.' + incompleteCh.ch + ' \u2014 ' + chData.title + ' (' + incompleteCh.done + '/' + incompleteCh.total + ' missions)';
      nextAction = function() { S.chapterIdx = incompleteCh.ch - 1; render(); };
    } else {
      nextStep = 'Tous les chapitres avanc\u00e9s ! Termine les missions restantes.';
    }
  } else if (fcMastered < FLASHCARDS.length * 0.5) {
    phase = 2;
    nextStep = 'R\u00e9vise les flashcards (' + fcMastered + '/' + FLASHCARDS.length + ' ma\u00eetris\u00e9es)';
    nextAction = function() { S.tab = 'flash'; render(); };
  } else if (bestExam < 700) {
    phase = 3;
    nextStep = avgQuizPct < 80
      ? 'Entra\u00eene-toi aux quiz par domaine (moyenne : ' + avgQuizPct + '%, objectif : 80%)'
      : 'Lance un examen blanc (meilleur score : ' + bestExam + '/1000, objectif : 700)';
    nextAction = function() { S.tab = 'quiz'; render(); };
  } else {
    phase = 4;
    nextStep = 'Tu es pr\u00eat ! Inscris-toi \u00e0 l\'examen PL-300.';
  }
  return { chProgress: chProgress, totalMissions: totalMissions, totalMissionsMax: totalMissionsMax, fcMastered: fcMastered, avgQuizPct: avgQuizPct, bestExam: bestExam, phase: phase, nextStep: nextStep, nextAction: nextAction };
}

function renderRoadmap() {
  var prog = getProgress();
  var phases = [
    { num: 1, label: 'Apprendre', sub: 'Ch.1-7' },
    { num: 2, label: 'Ancrer', sub: 'Flashcards' },
    { num: 3, label: 'Tester', sub: 'Quiz PL-300' },
    { num: 4, label: 'Certifier', sub: 'Examen' }
  ];
  var phasesRow = h('div', { className: 'roadmap-phases' });
  phases.forEach(function(p) {
    var dotClass = 'phase-dot';
    if (p.num < prog.phase) dotClass += ' done';
    else if (p.num === prog.phase) dotClass += ' active';
    else dotClass += ' pending';
    phasesRow.appendChild(h('div', { className: 'roadmap-phase' },
      h('div', { className: dotClass }, String(p.num)),
      h('div', { className: 'phase-label' }, p.label),
      h('div', { className: 'phase-sublabel' }, p.sub)
    ));
  });
  var nextBox = h('div', { className: 'roadmap-next' });
  var nextLabel = h('div', { className: 'roadmap-next-text' }, 'Prochaine \u00e9tape : ' + prog.nextStep);
  nextBox.appendChild(nextLabel);
  if (prog.nextAction) {
    var goBtn = h('button', {
      onClick: prog.nextAction,
      style: { marginTop: '8px', fontSize: '12px', padding: '4px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)' }
    }, 'Continuer');
    nextBox.appendChild(goBtn);
  }
  var progressPct = Math.round(prog.totalMissions / prog.totalMissionsMax * 100);
  var progressInfo = h('div', { style: { marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--tx3)' } },
    h('span', null, prog.totalMissions + '/' + prog.totalMissionsMax + ' missions (' + progressPct + '%)'),
    h('span', null, prog.fcMastered + '/' + FLASHCARDS.length + ' flashcards')
  );
  var progressBar = h('div', { className: 'progress-bar', style: { marginTop: '6px' } },
    h('div', { className: 'progress-fill', style: { width: progressPct + '%' } })
  );
  var wrap = h('div', { className: 'roadmap' },
    h('div', { style: { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx3)', marginBottom: '14px' } }, 'Parcours d\'apprentissage'),
    phasesRow,
    nextBox,
    progressInfo,
    progressBar
  );
  return wrap;
}

function renderFormation() {
  if (S.chapterIdx === null) return renderChapterList();
  return renderChapterDetail(CHAPTERS[S.chapterIdx]);
}

function renderChapterList() {
  const wrap = h('div', null);
  // Roadmap
  wrap.appendChild(renderRoadmap());
  // Stats
  const done = Object.values(S.missions).filter(Boolean).length;
  const totalMissionsMax = CHAPTERS.reduce(function(s, c) { return s + (c.missions[1] - c.missions[0] + 1); }, 0);
  wrap.appendChild(h('div', { className: 'stats-grid' },
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Missions'),
      h('div', { className: 'stat-value' }, `${done}`, h('span', { className: 'stat-sub' }, '/' + totalMissionsMax))
    ),
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Progression'),
      h('div', { className: 'stat-value' }, `${Math.round(done / totalMissionsMax * 100)}`, h('span', { className: 'stat-sub' }, '%'))
    )
  ));

  const nav = h('div', { className: 'ch-nav' });
  CHAPTERS.forEach((ch, idx) => {
    const [from, to] = ch.missions;
    const total = to - from + 1;
    const completed = Array.from({ length: total }, (_, i) => S.missions[from + i]).filter(Boolean).length;
    const pct = Math.round(completed / total * 100);

    nav.appendChild(h('div', {
      className: 'ch-item' + (completed === total ? ' completed' : ''),
      onClick: () => { S.chapterIdx = idx; render(); }
    },
      h('div', { className: 'ch-num' }, `${ch.id}`),
      h('span', { className: 'ch-domain', style: { color: DOMAINS[ch.domain] ? DOMAINS[ch.domain].color : 'var(--tx3)', background: DOMAINS[ch.domain] ? DOMAINS[ch.domain].color + '18' : 'var(--bg3)' } }, ch.domain || 'Intro'),
      h('div', { style: { flex: '1' } },
        h('div', { className: 'ch-title' }, ch.title),
        h('div', { style: { marginTop: '6px' } },
          h('div', { className: 'progress-bar' },
            h('div', { className: 'progress-fill' + (pct === 100 ? ' green' : ''), style: { width: pct + '%' } })
          )
        )
      ),
      h('div', { className: 'ch-progress' }, `${completed}/${total}`)
    ));
  });
  wrap.appendChild(nav);
  return wrap;
}

function renderChapterDetail(ch) {
  const wrap = h('div', null);

  // Back button
  wrap.appendChild(h('button', {
    onClick: () => { S.chapterIdx = null; render(); },
    style: { marginBottom: '16px', fontSize: '13px' }
  }, '← Chapitres'));

  // Chapter header
  wrap.appendChild(h('div', { style: { marginBottom: '20px' } },
    h('div', { style: { fontSize: '12px', color: 'var(--tx3)', marginBottom: '4px' } }, `Chapitre ${ch.id} — ${ch.domainPL}`),
    h('h2', { style: { fontSize: '22px', fontWeight: '600', marginBottom: '8px' } }, ch.title),
    h('div', { style: { fontSize: '13px', color: 'var(--tx2)' } }, `Missions ${ch.missions[0]}-${ch.missions[1]} sur ${getTotalMissions()}`)
  ));

  // Objectives as plain text
  wrap.appendChild(h('p', { style: { fontSize: '14px', lineHeight: '1.75', color: 'var(--tx2)', marginBottom: '16px' } },
    ch.objectives
  ));

  // Recap as subtle text
  if (ch.recap) {
    wrap.appendChild(h('p', { style: { fontSize: '13px', lineHeight: '1.6', color: 'var(--tx3)', fontStyle: 'italic', marginBottom: '16px' } },
      'Prérequis : ', ch.recap
    ));
  }

  // Interview as inline Q&A
  if (ch.interview) {
    wrap.appendChild(h('div', { style: { fontSize: '13px', lineHeight: '1.6', marginBottom: '20px', padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--bg2)' } },
      h('span', { style: { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx3)', display: 'block', marginBottom: '4px' } }, 'Question d\'entretien'),
      h('strong', null, ch.interview.q), ' — ',
      ch.interview.a
    ));
  }

  // Sections
  ch.sections.forEach(sec => {
    wrap.appendChild(h('div', { className: 'section-title' },
      h('span', { className: 'section-id' }, sec.id),
      sec.title
    ));

    // Theory as plain text paragraph
    if (sec.theory) {
      wrap.appendChild(h('p', { style: { fontSize: '14px', lineHeight: '1.75', marginBottom: '14px', color: 'var(--tx)' } }, sec.theory));
    }

    // Business context merged as a second paragraph (no colored box)
    if (sec.business) {
      wrap.appendChild(h('p', { style: { fontSize: '14px', lineHeight: '1.75', marginBottom: '14px', color: 'var(--tx2)' } }, sec.business));
    }

    if (sec.code) {
      const codeBlock = h('div', { className: 'code-block' });
      codeBlock.innerHTML = highlightCode(sec.code);
      const copyBtn = h('button', { className: 'copy-btn', onClick: () => {
        navigator.clipboard.writeText(sec.code).then(() => { copyBtn.textContent = 'Copié !'; setTimeout(() => copyBtn.textContent = 'Copier', 1500); });
      }}, 'Copier');
      codeBlock.appendChild(copyBtn);
      wrap.appendChild(codeBlock);
    }

    if (sec.result) {
      const table = h('table', { className: 'mini-table' },
        h('thead', null, h('tr', null, ...sec.result.headers.map(hd => h('th', null, hd)))),
        h('tbody', null, ...sec.result.rows.map(row =>
          h('tr', null, ...row.map(cell => h('td', null, cell)))
        ))
      );
      wrap.appendChild(table);
    }

    // Tip as subtle italic line (no box)
    if (sec.tip) {
      wrap.appendChild(h('p', { style: { fontSize: '13px', lineHeight: '1.6', color: 'var(--tx3)', fontStyle: 'italic', marginBottom: '14px' } },
        '\u25B8 ', sec.tip
      ));
    }

    // SVG diagrams for specific sections
    if (sec.id === '3.1') wrap.appendChild(renderDiagram('star-schema'));
    if (sec.id === '4.2') wrap.appendChild(renderDiagram('calculate-flow'));
    if (sec.id === '2.1') wrap.appendChild(renderDiagram('pq-pipeline'));

    if (sec.deep) {
      const deepContent = h('div', { style: { display: 'none', fontSize: '14px', lineHeight: '1.75', color: 'var(--tx2)', marginBottom: '14px', whiteSpace: 'pre-line' } }, sec.deep);
      const deepToggle = h('button', {
        style: { fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', marginBottom: '14px' },
        onClick: () => {
          const visible = deepContent.style.display !== 'none';
          deepContent.style.display = visible ? 'none' : 'block';
          deepToggle.textContent = visible ? '\u25B8 En savoir plus' : 'Masquer';
        }
      }, '\u25B8 En savoir plus');
      wrap.appendChild(deepToggle);
      wrap.appendChild(deepContent);
    }
  });

  // Errors
  if (ch.errors && ch.errors.length) {
    wrap.appendChild(h('div', { className: 'section-title' }, 'Erreurs courantes'));
    wrap.appendChild(h('div', { className: 'box box-error' },
      h('span', { className: 'box-label' }, 'Ce qu\'il ne faut PAS faire'),
      ...ch.errors.map(e => h('div', { style: { marginBottom: '4px', fontSize: '14px' } },
        h('span', { style: { color: 'var(--red)' } }, e.bad),
        ' → ',
        h('span', { style: { color: 'var(--green)' } }, e.good)
      ))
    ));
  }

  // PL-300 traps
  if (ch.pl300 && ch.pl300.length) {
    wrap.appendChild(h('div', { className: 'box box-pl300' },
      h('span', { className: 'box-label' }, 'Pièges PL-300'),
      ...ch.pl300.map(p => h('div', { style: { fontSize: '14px', marginBottom: '4px' } }, p))
    ));
  }

  // Checklist (séparé des missions — ne compte PAS dans la progression)
  if (ch.checklist && ch.checklist.length) {
    const clKey = 'cl-' + ch.id;
    wrap.appendChild(h('div', { className: 'box', style: { background: 'var(--bg2)', borderColor: 'var(--bd)' } },
      h('span', { className: 'box-label' }, 'Checklist fin de chapitre'),
      ...ch.checklist.map((item, i) => {
        const chkId = `${clKey}-${i}`;
        const checked = S.checklist[chkId];
        return h('div', { style: { marginBottom: '4px' } },
          h('label', { style: { fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' } },
            h('input', { type: 'checkbox', ...(checked ? { checked: 'checked' } : {}), onChange: () => {
              S.checklist[chkId] = !S.checklist[chkId];
              save(); render();
            }}),
            item
          )
        );
      })
    ));
  }

  // Bridge as plain transition text
  if (ch.bridge) {
    wrap.appendChild(h('p', { style: { fontSize: '13px', lineHeight: '1.6', color: 'var(--tx3)', fontStyle: 'italic', marginTop: '20px', marginBottom: '20px' } },
      '\u2192 ', ch.bridge
    ));
  }

  // Missions
  wrap.appendChild(h('div', { className: 'section-title' }, `Missions ${ch.missions[0]} à ${ch.missions[1]}`));
  const chMissions = MISSIONS.filter(m => m.ch === ch.id);
  chMissions.forEach(m => wrap.appendChild(renderMission(m)));

  // Racing Games section
  if (typeof RACING_MISSIONS !== 'undefined') {
    var racingMs = RACING_MISSIONS.filter(function(rm) { return rm.ch === ch.id; });
    if (racingMs.length > 0) {
      var racingSection = h('div', { className: 'racing-section' });
      racingSection.appendChild(h('div', { className: 'racing-section-title' },
        icon('flag', 18),
        'Applique sur ton projet — Racing Games'
      ));
      racingSection.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '14px' } },
        racingMs.length + ' missions pour appliquer ce chapitre sur le projet Racing Games (base racing_prices).'
      ));
      racingMs.forEach(function(rm) { racingSection.appendChild(renderMission(rm)); });
      wrap.appendChild(racingSection);
    }
  }

  // Quiz de validation du chapitre
  const chQuizQs = QUIZ.filter(q => q.ch === ch.id);
  if (chQuizQs.length > 0) {
    wrap.appendChild(h('div', { className: 'section-title' }, `Quiz de validation — Chapitre ${ch.id}`));
    wrap.appendChild(h('div', { style: { marginBottom: '12px', fontSize: '13px', color: 'var(--tx2)' } },
      `${chQuizQs.length} questions ciblées sur ce chapitre. Teste tes connaissances avant de passer au suivant.`
    ));
    wrap.appendChild(h('button', {
      onClick: () => { S.tab = 'quiz'; startQuiz('ch' + ch.id, 'training'); },
      style: { padding: '10px 24px', fontSize: '14px', fontWeight: '500', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
    }, `Lancer le quiz Ch.${ch.id} (${chQuizQs.length} questions)`));
  }

  // Navigation chapitres
  wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--bd)' } },
    ch.id > 1 ? h('button', { onClick: () => { S.chapterIdx = ch.id - 2; window.scrollTo(0, 0); render(); } }, `← Ch.${ch.id - 1}`) : h('div'),
    ch.id < 7 ? h('button', { onClick: () => { S.chapterIdx = ch.id; window.scrollTo(0, 0); render(); }, style: { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' } }, `Ch.${ch.id + 1} →`) : h('div')
  ));

  return wrap;
}

function renderMission(m) {
  var mKey = m.id;
  // Support racing missions keyed differently
  if (typeof m.id === 'string' && m.id.startsWith('r')) mKey = 'racing_' + m.id;
  const done = S.missions[mKey];
  const typeLabels = { standard: null, debug: 'DEBUG', brief: 'BRIEF', pl300: 'PL-300', dax: 'DAX', action: 'ACTION' };
  const typeClasses = { standard: '', debug: 'debug', brief: 'brief', pl300: 'pl300', dax: 'pl300', action: 'brief' };
  const spoilerId = 'spoiler-' + m.id;
  var missionType = m.type || 'standard';
  var isDax = missionType === 'dax';
  var inputStateKey = '_mission_input_' + m.id;
  var checkedStateKey = '_mission_checked_' + m.id;
  var correctStateKey = '_mission_correct_' + m.id;
  var hintStateKey = '_mission_hint_' + m.id;

  const mission = h('div', { className: 'mission' + (done ? ' mission-done' : '') });
  // Header
  mission.appendChild(h('div', { className: 'mission-header' },
    h('span', { className: 'mission-num' }, '#' + m.id),
    missionType !== 'standard' && typeLabels[missionType] ? h('span', { className: 'mission-type ' + (typeClasses[missionType] || '') }, typeLabels[missionType]) : null,
    m.title ? h('span', { style: { fontSize: '13px', fontWeight: '500', marginLeft: '4px' } }, m.title) : null,
    h('div', { style: { flex: '1' } }),
    h('button', {
      className: 'done-btn' + (done ? ' checked' : ''),
      onClick: function(e) {
        e.stopPropagation();
        var wasDone = S.missions[mKey];
        S.missions[mKey] = !S.missions[mKey];
        if (!wasDone && S.missions[mKey] && typeof XP_REWARDS !== 'undefined') {
          addXP(m.xp || XP_REWARDS.mission, 'Mission');
          // Check chapter complete
          var ch = CHAPTERS.find(function(c) { return c.id === m.ch; });
          if (ch) {
            var allDone = true;
            for (var i = ch.missions[0]; i <= ch.missions[1]; i++) { if (!S.missions[i]) { allDone = false; break; } }
            if (allDone && typeof XP_REWARDS !== 'undefined') addXP(XP_REWARDS.chapter_complete, 'Chapitre ' + ch.id);
          }
        }
        save(); render();
      }
    }, done ? h('span', null, icon('check', 12), ' Fait') : 'Marquer fait')
  ));
  // Brief text
  mission.appendChild(h('div', { className: 'mission-text' }, m.text));

  // DAX editor for DAX missions
  if (isDax && !done) {
    var editorDiv = h('div', { className: 'mission-editor' });
    var taClass = 'dax-editor';
    if (S[checkedStateKey] && S[correctStateKey]) taClass += ' dax-correct';
    else if (S[checkedStateKey] && !S[correctStateKey]) taClass += ' dax-wrong';
    var ta = h('textarea', {
      className: taClass,
      placeholder: 'Ecris ta mesure DAX ici...',
      onInput: function(e) { S[inputStateKey] = e.target.value; }
    });
    ta.value = S[inputStateKey] || '';
    if (S[checkedStateKey]) ta.setAttribute('readonly', 'true');
    editorDiv.appendChild(ta);

    if (!S[checkedStateKey]) {
      var btnRow = h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } });
      btnRow.appendChild(h('button', {
        onClick: function() {
          var input = (S[inputStateKey] || '').trim();
          if (!input) return;
          S[checkedStateKey] = true;
          var correct = false;
          if (m.expectedPattern && m.expectedPattern.test(input)) correct = true;
          if (!correct && m.altPatterns) {
            for (var i = 0; i < m.altPatterns.length; i++) { if (m.altPatterns[i].test(input)) { correct = true; break; } }
          }
          S[correctStateKey] = correct;
          if (correct) {
            S.missions[mKey] = true;
            if (typeof XP_REWARDS !== 'undefined') addXP(m.xp || XP_REWARDS.exercise, 'DAX Mission');
          }
          save(); render();
        },
        style: { padding: '8px 20px', fontWeight: '500', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
      }, 'V\u00e9rifier'));
      // Hint buttons
      if (m.hints && m.hints.length > 0) {
        var hintLvl = S[hintStateKey] || 0;
        if (hintLvl < m.hints.length) {
          btnRow.appendChild(h('button', {
            onClick: function() { S[hintStateKey] = (S[hintStateKey] || 0) + 1; render(); },
            style: { background: 'var(--yellow-bg)', color: '#9A6700', borderColor: '#F0AD4E' }
          }, 'Indice ' + (hintLvl + 1)));
        }
      }
      editorDiv.appendChild(btnRow);
      // Show hints
      var hLvl = S[hintStateKey] || 0;
      if (hLvl > 0 && m.hints) {
        for (var hi = 0; hi < Math.min(hLvl, m.hints.length); hi++) {
          editorDiv.appendChild(h('div', { className: 'box box-tip', style: { marginTop: '8px' } },
            h('span', { className: 'box-label' }, 'Indice ' + (hi + 1)), m.hints[hi]
          ));
        }
      }
    }
    // Feedback
    if (S[checkedStateKey]) {
      if (S[correctStateKey]) {
        editorDiv.appendChild(h('div', { className: 'mission-feedback correct' }, icon('check', 14), ' Correct !'));
      } else {
        editorDiv.appendChild(h('div', { className: 'mission-feedback wrong' }, 'Pas tout a fait...'));
        editorDiv.appendChild(h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          h('button', { onClick: function() { S[checkedStateKey] = false; S[correctStateKey] = false; render(); } }, 'Reessayer'),
          h('button', { onClick: function() { S[checkedStateKey] = true; S[correctStateKey] = false; render(); var el = document.getElementById(spoilerId); if (el) el.classList.add('open'); }, style: { color: 'var(--tx3)' } }, 'Voir la solution')
        ));
      }
    }
    mission.appendChild(editorDiv);
  }

  // Spoiler (corrigé)
  mission.appendChild(h('div', { className: 'spoiler' },
    h('button', { className: 'spoiler-btn', onClick: function() {
      var el = document.getElementById(spoilerId);
      if (el) el.classList.toggle('open');
    }}, 'Voir le corrigé'),
    h('div', { className: 'spoiler-content', id: spoilerId },
      m.hint ? h('div', { style: { marginBottom: '6px', color: 'var(--tx3)', fontSize: '12px' } }, m.hint) : null,
      m.hints && m.hints.length ? h('div', { style: { marginBottom: '6px', color: 'var(--tx3)', fontSize: '12px' } }, m.hints.join(' | ')) : null,
      h('div', null, h('strong', null, 'Solution : '), m.solution),
      m.why ? h('div', { className: 'why', style: { fontStyle: 'italic', color: 'var(--tx2)', marginTop: '6px' } }, m.why) : null
    )
  ));
  return mission;
}

// ═══════════════════════════════════════════════════════════
// QUIZ TAB
// ═══════════════════════════════════════════════════════════
function startQuiz(filter, mode) {
  S.quizMode = mode || 'training';
  S.quizFilter = filter;
  let qs;
  if (filter === 'all') qs = [...QUIZ];
  else if (filter.startsWith('ch')) qs = QUIZ.filter(q => q.ch === parseInt(filter.slice(2)));
  else qs = QUIZ.filter(q => q.d === filter);

  if (mode === 'exam') {
    qs = shuf(qs).slice(0, Math.min(50, qs.length));
    S.examActive = true;
    S.examTimeLeft = 100 * 60; // 100 min
    S.examAnswers = new Array(qs.length).fill(null);
    S.examUserAnswers = new Array(qs.length).fill(null);
    clearInterval(S.examTimer);
    S.examTimer = setInterval(() => {
      S.examTimeLeft--;
      if (S.examTimeLeft <= 0) { clearInterval(S.examTimer); finishExam(); }
      const timerEl = document.getElementById('exam-timer');
      if (timerEl) {
        const m = Math.floor(S.examTimeLeft / 60);
        const s = S.examTimeLeft % 60;
        timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
        if (S.examTimeLeft < 300) timerEl.classList.add('warning');
      }
    }, 1000);
  } else {
    qs = shuf(qs);
    S.examActive = false;
  }

  S.quizQuestions = qs;
  S.qi = 0; S.sel = null; S.shown = false; S.score = 0; S.total = 0;
  S.quizHistory = []; S.multiSel = []; S.orderSel = [];
  render();
}

function finishExam() {
  clearInterval(S.examTimer);
  S.examActive = false;

  // Calculate score by domain + build review data
  const byDomain = {};
  let right = 0, total = S.quizQuestions.length;
  S.examReviewData = [];
  S.quizQuestions.forEach((q, i) => {
    const ans = S.examAnswers[i];
    const qt = q.type || 'single';
    let correct;
    if (qt === 'multi') correct = Array.isArray(ans) && Array.isArray(q.a) && q.a.length === ans.length && q.a.every(a => ans.includes(a));
    else if (qt === 'order') correct = Array.isArray(ans) && Array.isArray(q.a) && q.a.every((a, idx) => ans[idx] === a);
    else correct = ans === q.a;
    if (correct) right++;
    else S.examReviewData.push({ question: q, userAnswer: ans });
    if (!byDomain[q.d]) byDomain[q.d] = { right: 0, total: 0 };
    byDomain[q.d].total++;
    if (correct) byDomain[q.d].right++;
  });

  const pct = right / total;
  const score = Math.round(pct * 1000);
  S.examHistory.push({
    date: new Date().toISOString().slice(0, 10),
    score, total, pct: Math.round(pct * 100),
    right, byDomain
  });
  if (typeof XP_REWARDS !== 'undefined') addXP(XP_REWARDS.exam_complete, 'Examen blanc');
  save();
  S.qi = -1; // signal to show results
  render();
}

function renderCaseStudy() {
  const wrap = h('div', null);
  const hasCases = typeof CASES !== 'undefined' && Array.isArray(CASES) && CASES.length > 0;

  if (!hasCases) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--tx3)' } },
      'Les \u00e9tudes de cas seront bient\u00f4t disponibles.'
    ));
    wrap.appendChild(h('button', { onClick: () => { S.caseMode = false; render(); }, style: { marginTop: '12px' } }, '← Retour'));
    return wrap;
  }

  // Case list
  if (S.caseIdx === null) {
    wrap.appendChild(h('button', { onClick: () => { S.caseMode = false; render(); }, style: { marginBottom: '16px', fontSize: '13px' } }, '← Retour au quiz'));
    wrap.appendChild(h('h3', { style: { fontSize: '16px', marginBottom: '16px' } }, 'Études de cas'));
    CASES.forEach((c, i) => {
      wrap.appendChild(h('div', {
        className: 'card', style: { cursor: 'pointer', padding: '16px' },
        onClick: () => { S.caseIdx = i; S.caseQi = 0; S.caseSel = null; S.caseShown = false; S.caseScore = 0; S.caseTotal = 0; render(); }
      },
        h('div', { style: { fontWeight: '600', fontSize: '15px', marginBottom: '4px' } }, c.title || `Cas ${i + 1}`),
        h('div', { style: { fontSize: '13px', color: 'var(--tx2)' } }, `${(c.questions || []).length} questions`),
        c.domain ? h('span', { className: 'badge', style: { marginTop: '6px', background: 'var(--accent-bg)', color: 'var(--accent)' } }, c.domain) : null
      ));
    });
    return wrap;
  }

  // Active case
  const cs = CASES[S.caseIdx];
  const qs = cs.questions || [];

  // Scenario (fixed at top)
  wrap.appendChild(h('div', { className: 'box box-deep', style: { marginBottom: '16px', position: 'sticky', top: '0', zIndex: '10', maxHeight: '200px', overflowY: 'auto' } },
    h('span', { className: 'box-label' }, cs.title || `Cas ${S.caseIdx + 1}`),
    h('div', { style: { fontSize: '14px', lineHeight: '1.65', whiteSpace: 'pre-wrap' } }, cs.scenario || '')
  ));

  // Finished
  if (S.caseQi >= qs.length) {
    const pct = S.caseTotal > 0 ? S.caseScore / S.caseTotal : 0;
    wrap.appendChild(h('div', { className: 'quiz-result', style: { background: pct >= .7 ? 'var(--green-bg)' : 'var(--red-bg)' } },
      h('div', { className: 'score', style: { color: pct >= .7 ? 'var(--green)' : 'var(--red)' } }, `${S.caseScore}/${S.caseTotal}`),
      h('div', { style: { fontSize: '14px', marginBottom: '14px' } }, pct >= .7 ? 'Bien jou\u00e9 !' : 'Continue de t\'entra\u00eener.'),
      h('button', { onClick: () => { S.caseIdx = null; render(); } }, 'Retour aux cas'),
      h('button', { onClick: () => { S.caseMode = false; S.caseIdx = null; render(); }, style: { marginLeft: '8px' } }, 'Retour au quiz')
    ));
    return wrap;
  }

  // Current question
  const cq = qs[S.caseQi];
  wrap.appendChild(h('div', { className: 'quiz-meta' },
    h('span', { style: { fontSize: '13px', color: 'var(--tx3)' } }, `Question ${S.caseQi + 1}/${qs.length}`)
  ));
  wrap.appendChild(h('p', { className: 'quiz-q' }, cq.q));

  const opts = h('div', { className: 'quiz-options' });
  cq.o.forEach((o, i) => {
    let cls = 'quiz-opt';
    if (S.caseShown && i === cq.a) cls += ' correct';
    else if (S.caseShown && i === S.caseSel && i !== cq.a) cls += ' wrong';
    opts.appendChild(h('button', {
      className: cls,
      onClick: () => {
        if (S.caseShown) return;
        S.caseSel = i; S.caseShown = true; S.caseTotal++;
        if (i === cq.a) S.caseScore++;
        const hash = qHash(cq);
        if (!S.quizStats[hash]) S.quizStats[hash] = { right: 0, wrong: 0 };
        S.quizStats[hash][i === cq.a ? 'right' : 'wrong']++;
        save(); render();
      }
    },
      h('span', { className: 'letter' }, String.fromCharCode(65 + i)),
      o
    ));
  });
  wrap.appendChild(opts);

  if (S.caseShown && cq.w) {
    wrap.appendChild(h('div', { className: 'quiz-explain' }, cq.w));
  }
  if (S.caseShown) {
    const isLast = S.caseQi >= qs.length - 1;
    wrap.appendChild(h('button', {
      className: 'quiz-next',
      onClick: () => { S.caseQi++; S.caseSel = null; S.caseShown = false; render(); }
    }, isLast ? 'Voir le résultat' : 'Suivante →'));
  }

  // Quit
  wrap.appendChild(h('button', {
    onClick: () => { S.caseIdx = null; render(); },
    style: { marginTop: '12px', fontSize: '12px', color: 'var(--tx3)', background: 'none', border: 'none' }
  }, 'Quitter le cas'));

  return wrap;
}

function renderQuiz() {
  const wrap = h('div', null);

  // Exercise mode
  if (S.exMode) return renderExercises();
  // Case study mode
  if (S.caseMode) return renderCaseStudy();

  // If no quiz started, show menu
  if (S.quizQuestions.length === 0) {
    // Exam strategy
    wrap.appendChild(renderExamStrategy());
    var totalAnswered = Object.values(S.quizStats).reduce(function(sum, s) { return sum + s.right + s.wrong; }, 0);
    if (totalAnswered === 0) {
      wrap.appendChild(h('div', { className: 'box box-tip', style: { marginBottom: '16px' } },
        h('span', { className: 'box-label' }, 'Bienvenue'),
        'Sélectionne un domaine et lance-toi. Chaque bonne réponse rapporte 5 XP.'
      ));
    }
    wrap.appendChild(h('h3', { style: { fontSize: '16px', marginBottom: '16px' } }, 'Mode entraînement'));
    wrap.appendChild(h('div', { className: 'pills' },
      ...['all', 'PQ', 'MO', 'VA', 'DE'].map(k =>
        h('button', { className: 'pill', onClick: () => startQuiz(k, 'training'),
          style: k !== 'all' ? { borderColor: DOMAINS[k].color, color: DOMAINS[k].color } : {}
        }, ...(k === 'all' ? ['Toutes les questions'] : [icon(DOMAINS[k].icon, 14), ' ' + DOMAINS[k].name]))
      ),
      h('button', { className: 'pill', onClick: () => { S.caseMode = true; S.caseIdx = null; render(); },
        style: { borderColor: 'var(--purple)', color: 'var(--purple)' }
      }, 'Études de cas'),
      h('button', { className: 'pill', onClick: () => { S.exMode = true; S.exIdx = 0; S.exInput = ''; S.exChecked = false; S.exCorrect = false; S.exHintLevel = 0; S.exShowSolution = false; render(); },
        style: { borderColor: 'var(--green)', color: 'var(--green)' }
      }, 'Exercices DAX')
    ));
    wrap.appendChild(h('div', { className: 'pills', style: { marginBottom: '24px' } },
      ...CHAPTERS.map(ch =>
        h('button', { className: 'pill', onClick: () => startQuiz('ch' + ch.id, 'training') }, `Ch.${ch.id}`)
      )
    ));

    // Review wrong answers
    const wrongQs = QUIZ.filter(q => {
      const st = S.quizStats[qHash(q)];
      return st && st.wrong > st.right;
    });
    if (wrongQs.length > 0) {
      wrap.appendChild(h('button', {
        onClick: () => { S.quizQuestions = shuf(wrongQs); S.qi = 0; S.sel = null; S.shown = false; S.score = 0; S.total = 0; S.quizMode = 'training'; render(); },
        style: { marginBottom: '24px', background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red)' }
      }, `Réviser les erreurs (${wrongQs.length} questions)`));
    }

    // Exam mode
    wrap.appendChild(h('h3', { style: { fontSize: '16px', marginBottom: '12px', marginTop: '8px' } }, 'Mode Examen PL-300'));
    wrap.appendChild(h('div', { className: 'box box-pl300', style: { marginBottom: '16px' } },
      h('span', { className: 'box-label' }, 'Simulation'),
      '50 questions • 100 minutes • Score /1000 • Seuil : 700'
    ));
    wrap.appendChild(h('button', {
      onClick: () => startQuiz('all', 'exam'),
      style: { padding: '12px 32px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
    }, 'Lancer l\'examen'));

    // Exam history
    if (S.examHistory.length) {
      wrap.appendChild(h('h3', { style: { fontSize: '14px', marginTop: '24px', marginBottom: '12px' } }, 'Historique des examens'));
    } else {
      wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '20px', color: 'var(--tx3)', fontSize: '13px', marginTop: '20px' } },
        'Aucun examen pass\u00e9 pour le moment. Entra\u00eene-toi avec les quiz avant de te lancer !'
      ));
    }
    if (S.examHistory.length) {
      S.examHistory.slice().reverse().forEach(ex => {
        const passed = ex.score >= 700;
        wrap.appendChild(h('div', { className: 'card', style: { padding: '12px 16px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('span', { style: { fontSize: '13px', color: 'var(--tx3)' } }, ex.date),
            h('span', { style: { fontSize: '18px', fontWeight: '600', color: passed ? 'var(--green)' : 'var(--red)' } }, `${ex.score}/1000`),
            h('span', { className: 'badge', style: { background: passed ? 'var(--green-bg)' : 'var(--red-bg)', color: passed ? 'var(--green)' : 'var(--red)' } }, passed ? 'RÉUSSI' : 'ÉCHOUÉ')
          )
        ));
      });
    }

    return wrap;
  }

  // Exam results
  if (S.qi === -1 && S.examHistory.length) {
    const ex = S.examHistory[S.examHistory.length - 1];
    const passed = ex.score >= 700;
    wrap.appendChild(h('div', { className: 'quiz-result', style: { background: passed ? 'var(--green-bg)' : 'var(--red-bg)' } },
      h('div', { className: 'score', style: { color: passed ? 'var(--green)' : 'var(--red)' } }, `${ex.score}/1000`),
      h('div', { style: { fontSize: '16px', color: passed ? 'var(--green)' : 'var(--red)', marginBottom: '16px' } },
        passed ? 'Félicitations — tu as le niveau PL-300 !' : `Score insuffisant (seuil : 700). Continue de t'entraîner.`
      ),
      h('div', { style: { fontSize: '14px', marginBottom: '16px', color: 'var(--tx2)' } }, `${ex.right}/${ex.total} bonnes réponses`)
    ));

    // By domain
    wrap.appendChild(h('h3', { style: { fontSize: '14px', marginTop: '20px', marginBottom: '12px' } }, 'Score par domaine'));
    Object.entries(ex.byDomain).forEach(([d, stats]) => {
      const pct = Math.round(stats.right / stats.total * 100);
      const dom = DOMAINS[d];
      if (!dom) return;
      wrap.appendChild(h('div', { style: { marginBottom: '12px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' } },
          h('span', null, icon(dom.icon, 14), ' ' + dom.name),
          h('span', { style: { color: pct >= 70 ? 'var(--green)' : 'var(--red)' } }, `${pct}%`)
        ),
        h('div', { className: 'progress-bar' },
          h('div', { className: 'progress-fill', style: { width: pct + '%', background: pct >= 70 ? 'var(--green)' : 'var(--red)' } })
        )
      ));
    });

    // Review + Back buttons
    var reviewBtns = h('div', { style: { display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' } });
    if (S.examReviewData && S.examReviewData.length > 0) {
      reviewBtns.appendChild(h('button', {
        onClick: () => { S.examReview = true; S.examFullReview = false; render(); },
        style: { background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red)' }
      }, 'Revoir mes erreurs (' + S.examReviewData.length + ')'));
    }
    reviewBtns.appendChild(h('button', {
      onClick: () => { S.examFullReview = true; S.examReview = false; render(); },
      style: { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
    }, 'Revue complete'));
    reviewBtns.appendChild(h('button', {
      onClick: () => { S.quizQuestions = []; S.qi = 0; S.examReview = false; S.examFullReview = false; render(); }
    }, 'Retour au menu'));
    wrap.appendChild(reviewBtns);

    // Exam review panel
    if (S.examReview && S.examReviewData && S.examReviewData.length > 0) {
      wrap.appendChild(h('h3', { style: { fontSize: '16px', marginTop: '24px', marginBottom: '16px' } }, 'Revue des erreurs'));
      S.examReviewData.forEach((item, idx) => {
        var q = item.question;
        var userAns = item.userAnswer;
        var qt = q.type || 'single';
        var reviewCard = h('div', { className: 'card', style: { padding: '16px', marginBottom: '12px', borderLeft: '3px solid var(--red)' } });
        reviewCard.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx3)', marginBottom: '6px' } }, 'Question ' + (idx + 1)));
        reviewCard.appendChild(h('p', { style: { fontSize: '15px', fontWeight: '500', marginBottom: '12px', lineHeight: '1.5' } }, q.q));
        if (q.o) {
          q.o.forEach((opt, oi) => {
            var isCorrect = qt === 'multi' ? (Array.isArray(q.a) && q.a.includes(oi)) : (oi === q.a);
            var isUserPick = qt === 'multi' ? (Array.isArray(userAns) && userAns.includes(oi)) : (userAns === oi);
            var optStyle = { padding: '8px 14px', borderRadius: 'var(--radius)', marginBottom: '4px', fontSize: '14px', lineHeight: '1.5', border: '1px solid var(--bd)' };
            if (isCorrect) { optStyle.background = 'var(--green-bg)'; optStyle.borderColor = 'var(--green)'; optStyle.color = 'var(--green)'; }
            else if (isUserPick) { optStyle.background = 'var(--red-bg)'; optStyle.borderColor = 'var(--red)'; optStyle.color = 'var(--red)'; }
            var prefix = isCorrect ? '✓ ' : (isUserPick ? '✗ ' : '');
            reviewCard.appendChild(h('div', { style: optStyle }, prefix + String.fromCharCode(65 + oi) + '. ' + opt));
          });
        }
        if (q.w) {
          reviewCard.appendChild(h('div', { className: 'quiz-explain', style: { marginTop: '10px' } }, q.w));
        }
        if (q.ch && CHAPTERS[q.ch - 1]) {
          reviewCard.appendChild(h('button', {
            onClick: function() { S.tab = 'formation'; S.chapterIdx = q.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
            style: { marginTop: '8px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', cursor: 'pointer', textDecoration: 'underline' }
          }, 'Revoir Ch.' + q.ch + ' \u2014 ' + CHAPTERS[q.ch - 1].title));
        }
        wrap.appendChild(reviewCard);
      });
      wrap.appendChild(h('button', {
        onClick: () => { S.examReview = false; render(); },
        style: { marginTop: '12px' }
      }, 'Fermer la revue'));
    }

    // Full exam review (all questions, color-coded)
    if (S.examFullReview && S.quizQuestions.length > 0) {
      wrap.appendChild(h('h3', { style: { fontSize: '16px', marginTop: '24px', marginBottom: '12px' } }, 'Revue complete de l\'examen'));
      // Domain summary with pass/fail indicators
      var summaryGrid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' } });
      Object.entries(ex.byDomain).forEach(function(entry) {
        var d = entry[0], stats = entry[1];
        var dPct = Math.round(stats.right / stats.total * 100);
        var dom = DOMAINS[d];
        if (!dom) return;
        var dPassed = dPct >= 70;
        summaryGrid.appendChild(h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: 'var(--radius)', background: dPassed ? 'var(--green-bg)' : 'var(--red-bg)', border: '1px solid ' + (dPassed ? 'var(--green)' : 'var(--red)') }
        },
          icon(dom.icon, 14),
          h('span', { style: { fontSize: '13px', fontWeight: '500' } }, dom.name),
          h('span', { style: { marginLeft: 'auto', fontSize: '13px', fontWeight: '600', color: dPassed ? 'var(--green)' : 'var(--red)' } }, dPct + '%'),
          h('span', { style: { fontSize: '11px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: dPassed ? 'var(--green)' : 'var(--red)', color: 'white' } }, dPassed ? 'OK' : 'KO')
        ));
      });
      wrap.appendChild(summaryGrid);

      // All questions with green/red border
      S.quizQuestions.forEach(function(q, qi) {
        var userAns = S.examAnswers[qi];
        var qt = q.type || 'single';
        var qCorrect;
        if (qt === 'multi') qCorrect = Array.isArray(userAns) && Array.isArray(q.a) && q.a.length === userAns.length && q.a.every(function(a) { return userAns.includes(a); });
        else if (qt === 'order') qCorrect = Array.isArray(userAns) && Array.isArray(q.a) && q.a.every(function(a, idx) { return userAns[idx] === a; });
        else qCorrect = userAns === q.a;

        var borderClr = qCorrect ? 'var(--green)' : 'var(--red)';
        var frc = h('div', { className: 'card', style: { padding: '16px', marginBottom: '12px', borderLeft: '3px solid ' + borderClr } });
        var domLabel = DOMAINS[q.d] ? h('span', { className: 'badge', style: { background: DOMAINS[q.d].color + '15', color: DOMAINS[q.d].color, marginLeft: '8px', fontSize: '11px' } }, DOMAINS[q.d].name) : null;
        frc.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--tx3)', marginBottom: '6px' } },
          h('span', null, 'Q' + (qi + 1)),
          domLabel,
          h('span', { style: { marginLeft: 'auto', fontWeight: '600', color: borderClr } }, qCorrect ? 'Correct' : 'Incorrect')
        ));
        frc.appendChild(h('p', { style: { fontSize: '15px', fontWeight: '500', marginBottom: '12px', lineHeight: '1.5' } }, q.q));
        if (q.o) {
          q.o.forEach(function(opt, oi) {
            var optCorrect = qt === 'multi' ? (Array.isArray(q.a) && q.a.includes(oi)) : (oi === q.a);
            var optPicked = qt === 'multi' ? (Array.isArray(userAns) && userAns.includes(oi)) : (userAns === oi);
            var optStyle = { padding: '8px 14px', borderRadius: 'var(--radius)', marginBottom: '4px', fontSize: '14px', lineHeight: '1.5', border: '1px solid var(--bd)' };
            if (optCorrect) { optStyle.background = 'var(--green-bg)'; optStyle.borderColor = 'var(--green)'; optStyle.color = 'var(--green)'; }
            else if (optPicked) { optStyle.background = 'var(--red-bg)'; optStyle.borderColor = 'var(--red)'; optStyle.color = 'var(--red)'; }
            var prefix = optCorrect ? '✓ ' : (optPicked ? '✗ ' : '');
            frc.appendChild(h('div', { style: optStyle }, prefix + String.fromCharCode(65 + oi) + '. ' + opt));
          });
        }
        if (!qCorrect && q.w) {
          frc.appendChild(h('div', { className: 'quiz-explain', style: { marginTop: '10px' } }, q.w));
        }
        if (!qCorrect && q.ch && CHAPTERS[q.ch - 1]) {
          frc.appendChild(h('button', {
            onClick: function() { S.tab = 'formation'; S.chapterIdx = q.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
            style: { marginTop: '8px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', cursor: 'pointer', textDecoration: 'underline' }
          }, 'Revoir Ch.' + q.ch + ' \u2014 ' + CHAPTERS[q.ch - 1].title));
        }
        wrap.appendChild(frc);
      });
      wrap.appendChild(h('button', {
        onClick: function() { S.examFullReview = false; render(); },
        style: { marginTop: '12px' }
      }, 'Fermer la revue'));
    }

    return wrap;
  }

  const cq = S.quizQuestions[S.qi];
  if (!cq) {
    // Quiz finished (training mode)
    const pct = S.total > 0 ? S.score / S.total : 0;
    var pctInt = Math.round(pct * 100);

    // Domain-specific feedback
    var domFeedback = null;
    if (S.quizFilter && S.quizFilter !== 'all' && !S.quizFilter.startsWith('ch') && DOMAINS[S.quizFilter]) {
      var domName = DOMAINS[S.quizFilter].name;
      var domTips = {
        PQ: 'Révise les types de données et les transformations Power Query.',
        MO: 'Révise les relations, les hiérarchies et les schémas en étoile.',
        VA: 'Révise les visuels, les filtres et la mise en forme conditionnelle.',
        DE: 'Révise les espaces de travail, la sécurité RLS et le partage.'
      };
      domFeedback = h('div', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '14px', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius)' } },
        h('strong', null, domName + ' : ' + pctInt + '%'),
        ' — ',
        pctInt >= 85 ? 'Excellent ! Ce domaine est bien ma\u00eetris\u00e9.' : pctInt >= 70 ? 'Bien ! ' + (domTips[S.quizFilter] || '') : (domTips[S.quizFilter] || 'Continue de t\'entra\u00eener sur ce domaine.')
      );
    }

    wrap.appendChild(h('div', { className: 'quiz-result', style: { background: pct >= .7 ? 'var(--green-bg)' : 'var(--red-bg)' } },
      h('div', { className: 'score', style: { color: pct >= .7 ? 'var(--green)' : 'var(--red)' } }, `${S.score}/${S.total}`),
      h('div', { style: { fontSize: '14px', color: pct >= .7 ? 'var(--green)' : 'var(--red)', marginBottom: '14px' } },
        pct >= .85 ? 'Excellent !' : pct >= .7 ? 'Bien. Révise les erreurs.' : 'Continue de t\'entraîner.'
      ),
      domFeedback,
      h('button', { onClick: () => { S.quizQuestions = []; render(); } }, 'Retour'),
      S.quizHistory.length > 0 ? h('button', {
        onClick: () => { S.quizQuestions = shuf(S.quizHistory); S.qi = 0; S.sel = null; S.shown = false; S.score = 0; S.total = 0; S.quizHistory = []; render(); },
        style: { marginLeft: '8px', background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red)' }
      }, `Revoir les erreurs`) : null
    ));

    // "Retourner au chapitre" button if score < 70%
    if (pct < .7 && S.quizHistory.length > 0) {
      // Find weakest domain from wrong answers
      var _domStats = {};
      S.quizHistory.forEach(function(wq) {
        if (!wq.d) return;
        if (!_domStats[wq.d]) _domStats[wq.d] = 0;
        _domStats[wq.d]++;
      });
      var _weakestDom = null, _weakestCount = 0;
      Object.entries(_domStats).forEach(function(entry) {
        if (entry[1] > _weakestCount) { _weakestDom = entry[0]; _weakestCount = entry[1]; }
      });
      var _targetCh = null;
      if (_weakestDom) {
        var _domInfo = PL300_INFO.domains.find(function(x) { return x.id === _weakestDom; });
        if (_domInfo && _domInfo.chapters.length > 0) _targetCh = _domInfo.chapters[0];
      }
      if (_targetCh && CHAPTERS[_targetCh - 1]) {
        wrap.appendChild(h('button', {
          onClick: function() { S.tab = 'formation'; S.chapterIdx = _targetCh - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
          style: { marginTop: '16px', width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }
        }, 'Retourner au chapitre : Ch.' + _targetCh + ' \u2014 ' + CHAPTERS[_targetCh - 1].title));
      }
    }

    return wrap;
  }

  // Exam header
  if (S.examActive) {
    const m = Math.floor(S.examTimeLeft / 60);
    const s = S.examTimeLeft % 60;
    wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
      h('span', { style: { fontSize: '13px', color: 'var(--tx3)' } }, `Question ${S.qi + 1}/${S.quizQuestions.length}`),
      h('span', { className: 'exam-timer' + (S.examTimeLeft < 300 ? ' warning' : ''), id: 'exam-timer' }, `${m}:${String(s).padStart(2, '0')}`)
    ));
    wrap.appendChild(h('div', { className: 'exam-bar' },
      h('div', { className: 'exam-bar-fill', style: { width: ((S.qi + 1) / S.quizQuestions.length * 100) + '%' } })
    ));
  }

  // Question meta
  const dom = DOMAINS[cq.d];
  wrap.appendChild(h('div', { className: 'quiz-meta' },
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      dom ? h('span', { className: 'badge', style: { background: dom.color + '15', color: dom.color } }, dom.name) : null,
      h('span', { style: { fontSize: '11px', color: 'var(--tx3)' } }, `Ch.${cq.ch}`)
    ),
    !S.examActive ? h('span', { style: { fontSize: '13px', color: 'var(--tx2)' } }, `${S.qi + 1}/${S.quizQuestions.length} · ${S.score}/${S.total}`) : null
  ));

  // Question
  const qType = cq.type || 'single';
  wrap.appendChild(h('p', { className: 'quiz-q' }, cq.q));

  if (qType === 'multi' && !S.shown) {
    wrap.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--accent)', marginBottom: '10px', fontWeight: '500' } },
      `Sélectionnez ${cq.a.length} réponses`
    ));
  } else if (qType === 'order' && !S.shown) {
    wrap.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--accent)', marginBottom: '10px', fontWeight: '500' } },
      'Cliquez les options dans le bon ordre'
    ));
  } else if (!S.shown) {
    wrap.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginBottom: '10px' } },
      h('span', { className: 'kbd' }, 'A'), h('span', { className: 'kbd' }, 'B'), h('span', { className: 'kbd' }, 'C'), h('span', { className: 'kbd' }, 'D'),
      ' pour repondre'
    ));
  }

  // Options
  const opts = h('div', { className: 'quiz-options' });

  if (qType === 'multi') {
    // Multi-select with checkboxes
    cq.o.forEach((o, i) => {
      const selected = S.multiSel.includes(i);
      let cls = 'quiz-opt';
      if (S.shown && cq.a.includes(i)) cls += ' correct';
      else if (S.shown && selected && !cq.a.includes(i)) cls += ' wrong';

      opts.appendChild(h('button', {
        className: cls,
        style: selected && !S.shown ? { borderColor: 'var(--accent)', background: 'var(--accent-bg)' } : {},
        onClick: () => {
          if (S.shown) return;
          if (selected) S.multiSel = S.multiSel.filter(x => x !== i);
          else S.multiSel = [...S.multiSel, i];
          render();
        }
      },
        h('span', { style: { marginRight: '10px', fontSize: '14px' } }, selected ? '☑' : '☐'),
        h('span', { className: 'letter' }, String.fromCharCode(65 + i)),
        o
      ));
    });

    // Validate button for multi
    if (!S.shown && S.multiSel.length === cq.a.length) {
      wrap.appendChild(opts);
      wrap.appendChild(h('button', {
        className: 'quiz-next',
        style: { marginTop: '14px', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' },
        onClick: () => {
          S.shown = true; S.total++;
          const correct = cq.a.length === S.multiSel.length && cq.a.every(a => S.multiSel.includes(a));
          if (correct) S.score++;
          else S.quizHistory.push(cq);
          const hash = qHash(cq);
          if (!S.quizStats[hash]) S.quizStats[hash] = { right: 0, wrong: 0 };
          S.quizStats[hash][correct ? 'right' : 'wrong']++;
          if (typeof XP_REWARDS !== 'undefined') {
            addXP(correct ? XP_REWARDS.quiz_correct : XP_REWARDS.quiz_wrong, 'Quiz');
          }
          if (S.examActive) S.examAnswers[S.qi] = S.multiSel.slice();
          save(); render();
        }
      }, 'Valider'));
    } else {
      wrap.appendChild(opts);
    }

  } else if (qType === 'order') {
    // Order: click options in sequence
    cq.o.forEach((o, i) => {
      const pos = S.orderSel.indexOf(i);
      const assigned = pos !== -1;
      let cls = 'quiz-opt';
      if (S.shown) {
        const correctOrder = cq.a;
        const userPos = S.orderSel.indexOf(i);
        const correctPos = correctOrder.indexOf(i);
        if (userPos === correctPos) cls += ' correct';
        else cls += ' wrong';
      }

      opts.appendChild(h('button', {
        className: cls,
        style: assigned && !S.shown ? { borderColor: 'var(--accent)', background: 'var(--accent-bg)' } : {},
        onClick: () => {
          if (S.shown) return;
          if (assigned) {
            // Remove this and all after it
            S.orderSel = S.orderSel.slice(0, pos);
          } else {
            S.orderSel = [...S.orderSel, i];
          }
          render();
        }
      },
        h('span', { style: { marginRight: '10px', fontWeight: '600', color: assigned ? 'var(--accent)' : 'var(--tx3)', minWidth: '20px', display: 'inline-block' } }, assigned ? `${pos + 1}` : '·'),
        h('span', { className: 'letter' }, String.fromCharCode(65 + i)),
        o
      ));
    });

    // Validate button for order
    if (!S.shown && S.orderSel.length === cq.o.length) {
      wrap.appendChild(opts);
      wrap.appendChild(h('button', {
        className: 'quiz-next',
        style: { marginTop: '14px', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' },
        onClick: () => {
          S.shown = true; S.total++;
          const correct = cq.a.every((a, idx) => S.orderSel[idx] === a);
          if (correct) S.score++;
          else S.quizHistory.push(cq);
          const hash = qHash(cq);
          if (!S.quizStats[hash]) S.quizStats[hash] = { right: 0, wrong: 0 };
          S.quizStats[hash][correct ? 'right' : 'wrong']++;
          if (typeof XP_REWARDS !== 'undefined') {
            addXP(correct ? XP_REWARDS.quiz_correct : XP_REWARDS.quiz_wrong, 'Quiz');
          }
          if (S.examActive) S.examAnswers[S.qi] = S.orderSel.slice();
          save(); render();
        }
      }, 'Valider'));
    } else {
      wrap.appendChild(opts);
    }

  } else {
    // Standard single-answer QCM
    cq.o.forEach((o, i) => {
      let cls = 'quiz-opt';
      if (S.shown && i === cq.a) cls += ' correct';
      else if (S.shown && i === S.sel && i !== cq.a) cls += ' wrong';

      opts.appendChild(h('button', {
        className: cls,
        onClick: () => {
          if (S.shown) return;
          S.sel = i; S.shown = true; S.total++;
          const correct = i === cq.a;
          if (correct) S.score++;
          else S.quizHistory.push(cq);

          // Update stats
          const hash = qHash(cq);
          if (!S.quizStats[hash]) S.quizStats[hash] = { right: 0, wrong: 0 };
          S.quizStats[hash][correct ? 'right' : 'wrong']++;

          // XP
          if (typeof XP_REWARDS !== 'undefined') {
            addXP(correct ? XP_REWARDS.quiz_correct : XP_REWARDS.quiz_wrong, 'Quiz');
          }

          if (S.examActive) {
            S.examAnswers[S.qi] = i;
          }
          save();
          render();
        }
      },
        h('span', { className: 'letter' }, String.fromCharCode(65 + i)),
        o
      ));
    });
    wrap.appendChild(opts);
  }

  // Explanation
  if (S.shown && !S.examActive) {
    wrap.appendChild(h('div', { className: 'quiz-explain' }, cq.w));
    // "Revoir cette notion" link on wrong answer
    var _qt = cq.type || 'single';
    var _isWrong = _qt === 'multi'
      ? !(Array.isArray(S.multiSel) && Array.isArray(cq.a) && cq.a.length === S.multiSel.length && cq.a.every(function(a) { return S.multiSel.includes(a); }))
      : _qt === 'order'
        ? !(Array.isArray(S.orderSel) && Array.isArray(cq.a) && cq.a.every(function(a, idx) { return S.orderSel[idx] === a; }))
        : S.sel !== cq.a;
    if (_isWrong && cq.ch && CHAPTERS[cq.ch - 1]) {
      wrap.appendChild(h('button', {
        onClick: function() { S.tab = 'formation'; S.chapterIdx = cq.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
        style: { marginTop: '8px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', cursor: 'pointer', textDecoration: 'underline' }
      }, 'Revoir Ch.' + cq.ch + ' \u2014 ' + CHAPTERS[cq.ch - 1].title));
    }
  }

  // Next
  if (S.shown) {
    const isLast = S.qi >= S.quizQuestions.length - 1;
    wrap.appendChild(h('button', {
      className: 'quiz-next',
      onClick: () => {
        if (isLast) {
          if (S.examActive) { finishExam(); return; }
          S.qi++;
        } else {
          S.qi++; S.sel = null; S.shown = false; S.multiSel = []; S.orderSel = [];
        }
        render();
      }
    }, isLast ? (S.examActive ? 'Terminer l\'examen' : 'Voir le résultat') : 'Suivante →'));
  }

  // Quit button
  wrap.appendChild(h('button', {
    onClick: () => {
      if (S.examActive) { clearInterval(S.examTimer); S.examActive = false; }
      S.quizQuestions = []; render();
    },
    style: { marginTop: '12px', fontSize: '12px', color: 'var(--tx3)', background: 'none', border: 'none' }
  }, 'Quitter'));

  return wrap;
}

// ═══════════════════════════════════════════════════════════
// POMODORO
// ═══════════════════════════════════════════════════════════
function startPomodoro() {
  S.pomodoro.active = true;
  S.pomodoro.mode = 'work';
  S.pomodoro.timeLeft = 25 * 60;
  S.pomodoro.cycle = 0;
  S.pomodoro.paused = false;
  S.pomodoro.dropdownOpen = false;
  S.pomodoro.interval = setInterval(function() {
    S.pomodoro.timeLeft--;
    if (S.pomodoro.timeLeft <= 0) {
      pomodoroNext();
    }
    updatePomodoroDisplay();
  }, 1000);
  render();
}

function pomodoroNext() {
  if (S.pomodoro.mode === 'work') {
    S.pomodoro.cycle++;
    if (S.pomodoro.cycle >= 4) {
      S.pomodoro.mode = 'longBreak';
      S.pomodoro.timeLeft = 15 * 60;
      S.pomodoro.cycle = 0;
    } else {
      S.pomodoro.mode = 'break';
      S.pomodoro.timeLeft = 5 * 60;
    }
  } else {
    S.pomodoro.mode = 'work';
    S.pomodoro.timeLeft = 25 * 60;
  }
  try {
    var ctx = new AudioContext();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = S.pomodoro.mode === 'work' ? 523 : 659;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
  render();
}

function updatePomodoroDisplay() {
  var el = document.getElementById('pomodoro-time');
  if (el) {
    var m = Math.floor(S.pomodoro.timeLeft / 60);
    var s = S.pomodoro.timeLeft % 60;
    el.textContent = m + ':' + String(s).padStart(2, '0');
  }
  var modeEl = document.getElementById('pomodoro-mode-label');
  if (modeEl) {
    var labels = { work: 'Focus', break: 'Pause', longBreak: 'Pause longue' };
    modeEl.textContent = labels[S.pomodoro.mode] || '';
  }
}

function stopPomodoro() {
  clearInterval(S.pomodoro.interval);
  S.pomodoro.active = false;
  S.pomodoro.interval = null;
  S.pomodoro.dropdownOpen = false;
  render();
}

function pausePomodoro() {
  if (S.pomodoro.interval) {
    clearInterval(S.pomodoro.interval);
    S.pomodoro.interval = null;
    S.pomodoro.paused = true;
  } else {
    S.pomodoro.paused = false;
    S.pomodoro.interval = setInterval(function() {
      S.pomodoro.timeLeft--;
      if (S.pomodoro.timeLeft <= 0) pomodoroNext();
      updatePomodoroDisplay();
    }, 1000);
  }
  render();
}

function resetPomodoro() {
  clearInterval(S.pomodoro.interval);
  S.pomodoro.mode = 'work';
  S.pomodoro.timeLeft = 25 * 60;
  S.pomodoro.cycle = 0;
  S.pomodoro.paused = false;
  S.pomodoro.interval = setInterval(function() {
    S.pomodoro.timeLeft--;
    if (S.pomodoro.timeLeft <= 0) pomodoroNext();
    updatePomodoroDisplay();
  }, 1000);
  render();
}

// ═══════════════════════════════════════════════════════════
// GUIDED MODE — DAX EXERCISES
// ═══════════════════════════════════════════════════════════
function getGuidedSteps(ex) {
  var steps = [];
  var sol = ex.solution;

  if (sol.includes('CALCULATE')) {
    steps.push({ text: "Commence par CALCULATE( ... )", hint: "CALCULATE modifie le contexte de filtre" });
    steps.push({ text: "Quel est le 1er argument ? (la mesure a evaluer)", hint: "C'est souvent [CA] ou une mesure existante" });
    steps.push({ text: "Quel(s) filtre(s) ajouter ?", hint: "Les filtres viennent apres la virgule" });
  } else if (sol.includes('DIVIDE')) {
    steps.push({ text: "Utilise DIVIDE pour une division securisee", hint: "DIVIDE(numerateur, denominateur, alternative)" });
    steps.push({ text: "Quel est le numerateur ?", hint: "Ce que tu veux diviser" });
    steps.push({ text: "Quel est le denominateur ?", hint: "Par quoi tu divises" });
    steps.push({ text: "Quelle valeur alternative si division par 0 ?", hint: "Generalement 0 ou BLANK()" });
  } else if (sol.includes('TOTALYTD') || sol.includes('TOTALQTD') || sol.includes('TOTALMTD')) {
    steps.push({ text: "Quelle fonction de cumul utiliser ?", hint: "TOTALYTD pour Year-To-Date, TOTALQTD pour Quarter, TOTALMTD pour Month" });
    steps.push({ text: "Quel est le 1er argument ? (la mesure)", hint: "Ex: [CA Total]" });
    steps.push({ text: "Quel est le 2eme argument ? (la colonne date)", hint: "Utilise la table de dates marquee, PAS Sales[OrderDate]" });
  } else if (sol.includes('RANKX')) {
    steps.push({ text: "Utilise RANKX pour classer", hint: "RANKX(table, expression)" });
    steps.push({ text: "1er argument : quelle table ? (avec ALL !)", hint: "ALL(...) est obligatoire sinon rang toujours = 1" });
    steps.push({ text: "2eme argument : quelle mesure pour classer ?", hint: "Ex: [CA Total]" });
    steps.push({ text: "Ordre : ASC ou DESC ?", hint: "DESC = le plus grand en 1er" });
  } else if (sol.includes('SUMX') || sol.includes('AVERAGEX')) {
    var fn = sol.includes('SUMX') ? 'SUMX' : 'AVERAGEX';
    steps.push({ text: 'Utilise ' + fn + ' pour iterer ligne par ligne', hint: fn + '(table, expression par ligne)' });
    steps.push({ text: "1er argument : quelle table parcourir ?", hint: "Ex: Sales, DimProduct..." });
    steps.push({ text: "2eme argument : quelle expression calculer par ligne ?", hint: "Ex: Sales[Qty] * Sales[Price]" });
  } else if (sol.includes('SWITCH')) {
    steps.push({ text: "Utilise SWITCH(TRUE(), ...) pour des conditions multiples", hint: "Alternative propre aux IF imbriques" });
    steps.push({ text: "Ecris les conditions du PLUS restrictif au MOINS restrictif", hint: "Ex: > 10000 AVANT > 1000" });
    steps.push({ text: "N'oublie pas la valeur par defaut en dernier", hint: "La derniere valeur sans condition = else" });
  } else if (sol.includes('VAR')) {
    steps.push({ text: "Commence par déclarer tes VARiables", hint: "VAR NomVariable = expression" });
    steps.push({ text: "Utilise RETURN pour le résultat final", hint: "RETURN utilise les VARiables déclarées au-dessus" });
  } else {
    steps.push({ text: "Identifie la fonction DAX principale \u00e0 utiliser", hint: (ex.hints && ex.hints[0]) || "" });
    steps.push({ text: "Quel(s) argument(s) fournir ?", hint: (ex.hints && ex.hints[1]) || "" });
    steps.push({ text: "\u00c9cris la mesure compl\u00e8te", hint: "V\u00e9rifie les parenth\u00e8ses et les crochets" });
  }

  return steps;
}

// ═══════════════════════════════════════════════════════════
// EXERCICES DAX
// ═══════════════════════════════════════════════════════════
function getFilteredExercises() {
  var exs = typeof EXERCISES !== 'undefined' ? EXERCISES : [];
  if (S.exFilter !== 'all') {
    var ch = parseInt(S.exFilter.replace('ch', ''));
    exs = exs.filter(function(e) { return e.ch === ch; });
  }
  if (S.exDiffFilter > 0) {
    exs = exs.filter(function(e) { return e.difficulty === S.exDiffFilter; });
  }
  return exs;
}

function checkExercise(input, exercise) {
  if (exercise.expectedPattern.test(input)) return true;
  if (exercise.altPatterns) {
    for (var i = 0; i < exercise.altPatterns.length; i++) {
      if (exercise.altPatterns[i].test(input)) return true;
    }
  }
  return false;
}

function renderExercises() {
  var wrap = h('div', null);
  var exs = typeof EXERCISES !== 'undefined' ? EXERCISES : [];
  if (exs.length === 0) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--tx3)' } }, 'Exercices bient\u00f4t disponibles.'));
    wrap.appendChild(h('button', { onClick: function() { S.exMode = false; render(); } }, '← Retour'));
    return wrap;
  }

  wrap.appendChild(h('button', { onClick: function() { S.exMode = false; render(); }, style: { marginBottom: '16px', fontSize: '13px' } }, '← Retour au quiz'));

  var completedCount = Object.keys(S.exCompleted).length;
  wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
    h('h3', { style: { fontSize: '16px' } }, 'Exercices DAX'),
    h('span', { style: { fontSize: '14px', color: 'var(--green)', fontWeight: '600' } }, completedCount + '/' + exs.length + ' r\u00e9ussis')
  ));

  var chFilters = ['all'];
  var chSet = {};
  exs.forEach(function(e) { chSet[e.ch] = true; });
  Object.keys(chSet).sort(function(a,b) { return a-b; }).forEach(function(ch) { chFilters.push('ch' + ch); });
  wrap.appendChild(h('div', { className: 'pills' },
    chFilters.map(function(f) {
      return h('button', { className: 'pill' + (S.exFilter === f ? ' active' : ''), onClick: function() { S.exFilter = f; S.exIdx = 0; S.exInput = ''; S.exChecked = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); } }, f === 'all' ? 'Tous' : 'Ch.' + f.replace('ch', ''));
    })
  ));
  wrap.appendChild(h('div', { className: 'pills', style: { marginBottom: '16px' } },
    [0, 1, 2, 3].map(function(d) {
      return h('button', { className: 'pill' + (S.exDiffFilter === d ? ' active' : ''), onClick: function() { S.exDiffFilter = d; S.exIdx = 0; S.exInput = ''; S.exChecked = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); } }, d === 0 ? 'Toutes difficultes' : 'Niveau ' + d);
    })
  ));

  var filtered = getFilteredExercises();
  if (filtered.length === 0) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '20px', color: 'var(--tx3)' } }, 'Aucun exercice pour ce filtre.'));
    return wrap;
  }

  if (S.exIdx >= filtered.length) S.exIdx = filtered.length - 1;
  var ex = filtered[S.exIdx];

  var card = h('div', { className: 'card fade-in' });
  card.appendChild(h('div', { className: 'card-header' },
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      h('span', { className: 'badge', style: { background: 'var(--accent-bg)', color: 'var(--accent)' } }, 'Ch.' + ex.ch),
      h('span', { className: 'badge', style: { background: ex.difficulty === 1 ? 'var(--green-bg)' : ex.difficulty === 2 ? 'var(--yellow-bg)' : 'var(--red-bg)', color: ex.difficulty === 1 ? 'var(--green)' : ex.difficulty === 2 ? '#9A6700' : 'var(--red)' } }, 'Niveau ' + ex.difficulty),
      S.exCompleted[ex.id] ? h('span', { className: 'badge', style: { background: 'var(--green-bg)', color: 'var(--green)' } }, 'Reussi') : null
    ),
    h('span', { style: { fontSize: '13px', color: 'var(--tx3)' } }, (S.exIdx + 1) + '/' + filtered.length)
  ));

  card.appendChild(h('h3', { style: { fontSize: '16px', fontWeight: '600', marginBottom: '12px' } }, ex.title));
  card.appendChild(h('div', { className: 'box box-theory', style: { marginBottom: '16px' } },
    h('span', { className: 'box-label' }, 'Consigne'),
    h('div', { style: { fontSize: '14px', lineHeight: '1.65', whiteSpace: 'pre-wrap' } }, ex.prompt)
  ));

  var taClass = 'dax-editor';
  if (S.exChecked && S.exCorrect) taClass += ' dax-correct';
  if (S.exChecked && !S.exCorrect && !S.exShowSolution) taClass += ' dax-wrong';

  var ta = h('textarea', {
    className: taClass,
    placeholder: 'Ecris ta mesure DAX ici...',
    id: 'dax-input',
    onInput: function(e) { S.exInput = e.target.value; },
    onKeydown: function(e) {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); verifyExercise(); }
      if (e.key === 'Tab' && !e.shiftKey && S.exChecked && !S.exCorrect) { e.preventDefault(); showExHint(); }
    }
  });
  ta.value = S.exInput;
  if (S.exChecked) ta.setAttribute('readonly', 'true');
  card.appendChild(ta);

  card.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginTop: '6px', marginBottom: '12px' } },
    h('span', { className: 'kbd' }, 'Ctrl+Enter'), ' Verifier  ',
    h('span', { className: 'kbd' }, 'Tab'), ' Indice suivant'
  ));

  if (!S.exChecked) {
    var btnRow = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });
    btnRow.appendChild(h('button', {
      onClick: verifyExercise,
      style: { padding: '10px 28px', fontWeight: '500', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
    }, 'V\u00e9rifier'));
    if (!S.exGuided) {
      btnRow.appendChild(h('button', {
        onClick: function() { S.exGuided = true; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
        style: { padding: '10px 20px', fontWeight: '500', background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green)' }
      }, 'Mode guide'));
    } else {
      btnRow.appendChild(h('button', {
        onClick: function() { S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
        style: { padding: '10px 20px', fontWeight: '500', color: 'var(--tx3)' }
      }, 'Quitter le mode guide'));
    }
    card.appendChild(btnRow);
  }

  // Guided mode panel
  if (S.exGuided && !S.exChecked) {
    var steps = getGuidedSteps(ex);
    var guidedDiv = h('div', { style: { marginTop: '16px', marginBottom: '12px' } });
    guidedDiv.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '10px', fontWeight: '500' } },
      'Étape ' + (S.exGuidedStep + 1) + ' sur ' + steps.length
    ));
    steps.forEach(function(step, i) {
      var isActive = i === S.exGuidedStep;
      var isDone = i < S.exGuidedStep;
      var isLocked = i > S.exGuidedStep;
      var stepClass = 'guided-step' + (isActive ? ' active' : '') + (isLocked ? ' locked' : '');
      var stepDiv = h('div', { className: stepClass });
      var numClass = 'step-number' + (isDone ? ' done' : '');
      stepDiv.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { className: numClass }, isDone ? '✓' : String(i + 1)),
        h('span', { style: { fontWeight: '600', fontSize: '14px' } }, step.text)
      ));
      if (isActive && S.exGuidedHints[i]) {
        stepDiv.appendChild(h('div', { style: { marginTop: '8px', marginLeft: '34px', fontStyle: 'italic', color: 'var(--tx3)', fontSize: '13px' } }, step.hint));
      }
      if (isActive) {
        var stepBtns = h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', marginLeft: '34px' } });
        if (!S.exGuidedHints[i]) {
          stepBtns.appendChild(h('button', {
            onClick: function() { S.exGuidedHints[i] = true; render(); },
            style: { fontSize: '12px', padding: '4px 12px', background: 'var(--yellow-bg)', color: '#9A6700', borderColor: '#F0AD4E' }
          }, 'Voir l\'indice'));
        }
        if (i < steps.length - 1) {
          stepBtns.appendChild(h('button', {
            onClick: function() { S.exGuidedStep = i + 1; render(); },
            style: { fontSize: '12px', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
          }, 'Étape suivante →'));
        }
        stepDiv.appendChild(stepBtns);
      }
      guidedDiv.appendChild(stepDiv);
    });
    card.appendChild(guidedDiv);
  }

  if (S.exChecked && S.exCorrect) {
    card.appendChild(h('div', { className: 'quiz-explain', style: { borderLeftColor: 'var(--green)' } },
      h('div', { style: { fontWeight: '600', color: 'var(--green)', marginBottom: '6px' } }, 'Correct !'),
      ex.explanation
    ));
  }

  if (S.exChecked && !S.exCorrect && !S.exShowSolution) {
    card.appendChild(h('div', { style: { color: 'var(--red)', fontSize: '14px', fontWeight: '500', marginTop: '10px', marginBottom: '10px' } }, 'Pas tout a fait... Essaie les indices ou regarde la solution.'));

    var hintsDiv = h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } });
    ex.hints.forEach(function(hint, i) {
      if (i < S.exHintLevel) {
        hintsDiv.appendChild(h('div', { className: 'box box-tip', style: { flex: '1 1 100%' } },
          h('span', { className: 'box-label' }, 'Indice ' + (i + 1)), hint
        ));
      } else if (i === S.exHintLevel) {
        hintsDiv.appendChild(h('button', { onClick: showExHint, style: { background: 'var(--yellow-bg)', color: '#9A6700', borderColor: '#F0AD4E' } }, 'Indice ' + (i + 1)));
      }
    });
    card.appendChild(hintsDiv);

    card.appendChild(h('div', { style: { display: 'flex', gap: '8px' } },
      h('button', { onClick: function() { S.exChecked = false; S.exCorrect = false; render(); setTimeout(function() { var inp = document.getElementById('dax-input'); if (inp) inp.focus(); }, 50); } }, 'Reessayer'),
      h('button', { onClick: function() { S.exShowSolution = true; render(); }, style: { color: 'var(--tx3)' } }, 'Voir la solution')
    ));
  }

  if (S.exShowSolution) {
    card.appendChild(h('div', { className: 'quiz-explain' },
      h('div', { style: { fontWeight: '600', marginBottom: '8px' } }, 'Solution :'),
      Object.assign(h('div', { className: 'code-block' }), { innerHTML: highlightCode(ex.solution) }),
      h('div', { style: { marginTop: '10px' } }, ex.explanation)
    ));
  }

  card.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '16px' } },
    h('button', {
      onClick: function() { S.exIdx = Math.max(0, S.exIdx - 1); S.exInput = ''; S.exChecked = false; S.exCorrect = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
      style: { visibility: S.exIdx > 0 ? 'visible' : 'hidden' }
    }, '← Precedent'),
    h('button', {
      onClick: function() { S.exIdx = Math.min(filtered.length - 1, S.exIdx + 1); S.exInput = ''; S.exChecked = false; S.exCorrect = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
      style: { visibility: S.exIdx < filtered.length - 1 ? 'visible' : 'hidden' }
    }, 'Suivant →')
  ));

  wrap.appendChild(card);
  return wrap;
}

function verifyExercise() {
  var filtered = getFilteredExercises();
  var ex = filtered[S.exIdx];
  if (!ex) return;
  var input = S.exInput.trim();
  if (!input) return;
  S.exChecked = true;
  S.exCorrect = checkExercise(input, ex);
  if (S.exCorrect && !S.exShowSolution) {
    if (!S.exCompleted[ex.id] && typeof XP_REWARDS !== 'undefined') {
      addXP(XP_REWARDS.exercise, 'Exercice DAX');
    }
    S.exCompleted[ex.id] = true;
    save();
  }
  render();
}

function showExHint() {
  var filtered = getFilteredExercises();
  var ex = filtered[S.exIdx];
  if (ex && S.exHintLevel < ex.hints.length) {
    S.exHintLevel++;
    render();
  }
}

// ═══════════════════════════════════════════════════════════
// FLASHCARDS TAB
// ═══════════════════════════════════════════════════════════
function renderFlashcards() {
  const wrap = h('div', null);
  const cats = [...new Set(FLASHCARDS.map(f => f.c))];
  const knownCount = FLASHCARDS.filter((_, i) => sm2IsMastered(i)).length;
  const dueCount = getDueCards().length;

  // Filters
  wrap.appendChild(h('div', { className: 'pills' },
    h('button', { className: 'pill' + (S.fcFilter === 'all' ? ' active' : ''), onClick: () => { S.fcFilter = 'all'; S.fcIdx = 0; S.fcFlipped = false; render(); } }, 'Toutes'),
    h('button', { className: 'pill' + (S.fcFilter === 'due' ? ' active' : ''), onClick: () => { S.fcFilter = 'due'; S.fcIdx = 0; S.fcFlipped = false; render(); },
      style: { borderColor: 'var(--accent)', color: 'var(--accent)' }
    }, `Revision du jour (${dueCount})`),
    h('button', { className: 'pill' + (S.fcFilter === 'review' ? ' active' : ''), onClick: () => { S.fcFilter = 'review'; S.fcIdx = 0; S.fcFlipped = false; render(); },
      style: { borderColor: 'var(--red)', color: 'var(--red)' }
    }, 'Non maitrisees'),
    ...cats.map(c =>
      h('button', { className: 'pill' + (S.fcFilter === c ? ' active' : ''), onClick: () => { S.fcFilter = c; S.fcIdx = 0; S.fcFlipped = false; render(); } }, c)
    )
  ));

  // Stats
  wrap.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--tx3)', marginBottom: '16px' } },
    `${knownCount}/${FLASHCARDS.length} maitrisees · ${dueCount} a reviser aujourd'hui`
  ));

  // Filter cards (use shuffled order if available)
  let fc;
  const base = S.fcShuffled || FLASHCARDS;
  if (S.fcFilter === 'all') fc = base;
  else if (S.fcFilter === 'due') fc = base.filter((c) => { const gi = FLASHCARDS.indexOf(c); return sm2IsDue(gi); });
  else if (S.fcFilter === 'review') fc = base.filter((c) => { const gi = FLASHCARDS.indexOf(c); return !sm2IsMastered(gi); });
  else fc = base.filter(f => f.c === S.fcFilter);

  if (fc.length === 0) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--tx3)' } },
      S.fcFilter === 'due' ? 'Aucune carte a reviser aujourd\'hui !' : S.fcFilter === 'review' ? 'Toutes les cartes sont maitrisees !' : 'Aucune carte dans cette categorie.'
    ));
    return wrap;
  }

  if (S.fcIdx >= fc.length) S.fcIdx = 0;
  const card = fc[S.fcIdx];
  const globalIdx = FLASHCARDS.indexOf(card);
  const sm2Data = sm2Get(globalIdx);
  const daysUntil = sm2DaysUntilReview(globalIdx);

  // Progress
  const sm2Label = sm2IsMastered(globalIdx) ? 'Maitrisee' : sm2Data.repetitions === 0 ? 'Nouvelle' : `Rep. ${sm2Data.repetitions}`;
  const reviewLabel = daysUntil === 0 ? 'A reviser' : `Revision dans ${daysUntil}j`;
  wrap.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--tx3)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' } },
    h('span', null, `${S.fcIdx + 1}/${fc.length}`),
    h('span', null, `Ch.${card.ch} · ${sm2Label} · ${reviewLabel}`)
  ));

  // Card
  const cardEl = h('div', {
    className: 'flashcard' + (S.fcFlipped ? ' flashcard-back' : ''),
    style: { background: S.fcFlipped ? 'var(--bg2)' : 'var(--bg)' },
    onClick: () => { S.fcFlipped = !S.fcFlipped; render(); }
  },
    h('div', { style: { textAlign: 'center', maxWidth: '500px' } },
      h('div', { className: 'flashcard-label' }, S.fcFlipped ? 'Réponse' : 'Question'),
      h('div', { className: 'flashcard-text' }, S.fcFlipped ? card.b : card.f)
    )
  );
  wrap.appendChild(cardEl);

  // Actions (SM-2 quality buttons)
  if (S.fcFlipped) {
    wrap.appendChild(h('div', { className: 'flash-actions' },
      h('button', { className: 'review', onClick: () => {
        sm2Update(globalIdx, 1);
        S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render();
      }}, 'A revoir'),
      h('button', { onClick: () => {
        sm2Update(globalIdx, 3);
        S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render();
      }, style: { borderColor: '#F0AD4E', color: '#F0AD4E' } }, 'Difficile'),
      h('button', { className: 'know', onClick: () => {
        sm2Update(globalIdx, 5);
        S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render();
      }}, 'Facile')
    ));
  }

  // Keyboard hints (desktop) + swipe hint (mobile)
  wrap.appendChild(h('div', { style: { textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--tx3)' } },
    h('span', { className: 'kbd' }, 'Espace'), ' retourner  ',
    h('span', { className: 'kbd' }, '←'), h('span', { className: 'kbd' }, '→'), ' naviguer  ',
    h('span', { className: 'kbd' }, '1'), ' à revoir  ',
    h('span', { className: 'kbd' }, '2'), ' difficile  ',
    h('span', { className: 'kbd' }, '3'), ' facile'
  ));
  wrap.appendChild(h('div', { className: 'swipe-hint' }, 'Tap pour retourner · Swipe ← → pour naviguer'));

  // Restart + Shuffle
  wrap.appendChild(h('div', { style: { textAlign: 'center', marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center' } },
    h('button', { onClick: () => { S.fcIdx = 0; S.fcFlipped = false; render(); }, style: { fontSize: '12px' } }, 'Recommencer'),
    h('button', { onClick: () => { S.fcShuffled = shuf(FLASHCARDS); S.fcIdx = 0; S.fcFlipped = false; render(); }, style: { fontSize: '12px' } }, 'Melanger')
  ));

  return wrap;
}

// ═══════════════════════════════════════════════════════════
// REFERENCE TAB
// ═══════════════════════════════════════════════════════════
function renderReference() {
  const wrap = h('div', null);

  // Sub-tabs
  const refTabs = [
    ['measures', 'Mesures DAX'],
    ['patterns', 'Patterns'],
    ['ti', 'Time Intelligence'],
    ['glossary', 'Glossaire']
  ];
  if (!S.refTab) S.refTab = 'measures';

  wrap.appendChild(h('div', { className: 'pills', style: { marginBottom: '20px' } },
    ...refTabs.map(([id, label]) =>
      h('button', { className: 'pill' + (S.refTab === id ? ' active' : ''), onClick: () => { S.refTab = id; render(); } }, label)
    )
  ));

  if (S.refTab === 'measures') {
    const cats = [...new Set(MEASURES.map(m => m.c))];
    cats.forEach(c => {
      wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx2)', margin: '20px 0 8px' } }, c));
      MEASURES.filter(m => m.c === c).forEach((m, i) => {
        wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 12px', borderRadius: '8px', background: i % 2 ? 'var(--bg2)' : 'transparent' } },
          h('div', null,
            h('span', { style: { fontWeight: '500', fontSize: '14px' } }, m.n),
            h('span', { style: { fontSize: '11px', color: 'var(--tx3)', marginLeft: '8px' } }, `Ch.${m.ch}`)
          ),
          h('code', { style: { fontSize: '11px', color: 'var(--tx2)' } }, m.f)
        ));
      });
    });
  }

  if (S.refTab === 'patterns') {
    PATTERNS.forEach(p => {
      wrap.appendChild(h('div', { className: 'card', style: { padding: '14px 18px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } },
          h('span', { style: { fontWeight: '600', fontSize: '14px' } }, `${p.id}. ${p.name}`),
          h('span', { style: { fontSize: '12px', color: 'var(--tx3)' } }, p.desc)
        ),
        h('code', { style: { fontSize: '13px', color: 'var(--accent)' } }, p.formula)
      ));
    });
  }

  if (S.refTab === 'ti') {
    wrap.appendChild(h('div', { className: 'box box-theory', style: { marginBottom: '16px' } },
      h('span', { className: 'box-label' }, 'Prérequis'),
      'Table de dates continue + marquée + relation active. Si contexte = Mars 2022 :'
    ));
    const table = h('table', { className: 'mini-table' },
      h('thead', null, h('tr', null, h('th', null, 'Fonction'), h('th', null, 'Action'), h('th', null, 'Résultat'))),
      h('tbody', null, ...TI_CHEATSHEET.map(row =>
        h('tr', null, h('td', null, h('code', null, row.fn)), h('td', null, row.action), h('td', null, row.example))
      ))
    );
    wrap.appendChild(table);
  }

  if (S.refTab === 'glossary') {
    const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
    sorted.forEach((g, i) => {
      wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 12px', borderRadius: '8px', background: i % 2 ? 'var(--bg2)' : 'transparent' } },
        h('div', null,
          h('code', { style: { fontWeight: '600', fontSize: '13px', color: 'var(--accent)' } }, g.term),
          h('span', { style: { fontSize: '11px', color: 'var(--tx3)', marginLeft: '8px' } }, `Ch.${g.ch}`)
        ),
        h('span', { style: { fontSize: '13px', color: 'var(--tx2)', textAlign: 'right' } }, g.def)
      ));
    });
  }

  return wrap;
}

// ═══════════════════════════════════════════════════════════
// RECOMMENDATIONS + PREDICTIVE
// ═══════════════════════════════════════════════════════════
function getDomainStats() {
  const stats = {};
  Object.entries(DOMAINS).forEach(([d]) => {
    const domainQs = QUIZ.filter(q => q.d === d);
    let right = 0, total = 0;
    domainQs.forEach(q => {
      const st = S.quizStats[qHash(q)];
      if (st) { right += st.right; total += st.right + st.wrong; }
    });
    stats[d] = { right, total, pct: total > 0 ? Math.round(right / total * 100) : 0 };
  });
  return stats;
}

function getRecommendations() {
  const recs = [];
  const ds = getDomainStats();

  // 1. Weakest domain
  let weakest = null, weakPct = 101;
  Object.entries(ds).forEach(([d, s]) => {
    if (s.total > 3 && s.pct < weakPct) { weakest = d; weakPct = s.pct; }
  });
  if (weakest && weakPct < 70) {
    const dom = DOMAINS[weakest];
    const chapters = PL300_INFO.domains.find(x => x.id === weakest)?.chapters || [];
    recs.push({
      text: `Point faible : ${dom.name} (${weakPct}%). Revise les chapitres ${chapters.join(', ')}.`,
      iconName: dom.icon,
      action: chapters.length > 0 ? () => { S.tab = 'formation'; S.chapterIdx = chapters[0] - 1; render(); } : null,
      label: chapters.length > 0 ? `Réviser Ch.${chapters[0]}` : null
    });
  }

  // 2. Unstarted chapters
  const unstarted = CHAPTERS.filter(ch => {
    const [from, to] = ch.missions;
    const done = Array.from({ length: to - from + 1 }, (_, i) => S.missions[from + i]).filter(Boolean).length;
    return done === 0;
  });
  if (unstarted.length > 0 && unstarted.length < CHAPTERS.length) {
    const ch = unstarted[0];
    recs.push({
      text: `${unstarted.length} chapitre${unstarted.length > 1 ? 's' : ''} non commencé${unstarted.length > 1 ? 's' : ''}. Commence par Ch.${ch.id} — ${ch.title}.`,
      action: () => { S.tab = 'formation'; S.chapterIdx = ch.id - 1; render(); },
      label: `Ch.${ch.id}`
    });
  }

  // 3. SM-2 due cards
  const dueCount = getDueCards().length;
  if (dueCount > 0) {
    recs.push({
      text: `${dueCount} flashcard${dueCount > 1 ? 's' : ''} a reviser aujourd'hui (repetition espacee).`,
      action: () => { S.tab = 'flash'; S.fcFilter = 'due'; S.fcIdx = 0; S.fcFlipped = false; render(); },
      label: 'Réviser'
    });
  }

  // 4. Suggest exam if progression > 70%
  const missionsDone = Object.entries(S.missions).filter(([k, v]) => v && !isNaN(k) && k > 0 && k <= getTotalMissions()).length;
  if (missionsDone / getTotalMissions() > 0.7 && (S.examHistory.length === 0 || S.examHistory[S.examHistory.length - 1].score < 700)) {
    recs.push({
      text: 'Progression > 70%. Tente un examen blanc pour evaluer ton niveau.',
      action: () => { S.tab = 'quiz'; render(); },
      label: 'Examen blanc'
    });
  }

  return recs.slice(0, 3);
}

function getPredictiveStats() {
  const ds = getDomainStats();
  const weights = { PQ: 0.275, MO: 0.275, VA: 0.275, DE: 0.175 };

  // Global success rate
  const totalR = Object.values(S.quizStats).reduce((s, v) => s + v.right, 0);
  const totalA = Object.values(S.quizStats).reduce((s, v) => s + v.right + v.wrong, 0);
  const globalPct = totalA > 0 ? Math.round(totalR / totalA * 100) : 0;

  // Strongest and weakest
  let strongest = null, strongPct = -1, weakest = null, weakPct = 101;
  Object.entries(ds).forEach(([d, s]) => {
    if (s.total > 0 && s.pct > strongPct) { strongest = d; strongPct = s.pct; }
    if (s.total > 0 && s.pct < weakPct) { weakest = d; weakPct = s.pct; }
  });

  // Estimated PL-300 score
  let estimatedScore = 0;
  let hasData = false;
  Object.entries(weights).forEach(([d, w]) => {
    if (ds[d].total > 0) { estimatedScore += (ds[d].pct / 100) * w * 1000; hasData = true; }
  });
  estimatedScore = hasData ? Math.round(estimatedScore) : 0;
  const ready = estimatedScore >= 700;

  // Weeks estimate
  const missionsDone = Object.entries(S.missions).filter(([k, v]) => v && !isNaN(k) && k > 0 && k <= getTotalMissions()).length;
  const pctDone = missionsDone / getTotalMissions();
  let weeksEstimate = null;
  if (pctDone > 0.05 && pctDone < 1) {
    // Simple linear projection
    weeksEstimate = Math.ceil((1 - pctDone) / pctDone * 4); // assume current pace took ~4 weeks
    if (weeksEstimate > 52) weeksEstimate = null;
  }

  return { globalPct, strongest, strongPct, weakest, weakPct, estimatedScore, ready, weeksEstimate };
}

// ═══════════════════════════════════════════════════════════
// PROGRESSION TAB
// ═══════════════════════════════════════════════════════════
function renderProgress() {
  const wrap = h('div', null);
  const missionsDone = Object.entries(S.missions).filter(([k, v]) => v && !isNaN(k) && k > 0 && k <= getTotalMissions()).length;
  const knownCards = FLASHCARDS.filter((_, i) => sm2IsMastered(i)).length;
  const totalQuizAnswered = Object.values(S.quizStats).reduce((sum, s) => sum + s.right + s.wrong, 0);
  const totalQuizRight = Object.values(S.quizStats).reduce((sum, s) => sum + s.right, 0);
  const quizPct = totalQuizAnswered > 0 ? Math.round(totalQuizRight / totalQuizAnswered * 100) : 0;

  // Stats grid
  var lvlNow = getLevel(S.xp);
  wrap.appendChild(h('div', { className: 'stats-grid' },
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'XP Total'),
      h('div', { className: 'stat-value' }, String(S.xp), h('span', { className: 'stat-sub' }, ' XP'))
    ),
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Niveau'),
      h('div', { className: 'stat-value' }, LEVELS[lvlNow].name)
    ),
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Missions'),
      h('div', { className: 'stat-value' }, String(missionsDone), h('span', { className: 'stat-sub' }, '/' + getTotalMissions()))
    ),
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Flashcards'),
      h('div', { className: 'stat-value' }, String(knownCards), h('span', { className: 'stat-sub' }, '/' + FLASHCARDS.length))
    ),
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Quiz (taux)'),
      h('div', { className: 'stat-value' }, String(quizPct), h('span', { className: 'stat-sub' }, '%'))
    ),
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Streak'),
      h('div', { className: 'stat-value', style: { color: '#ffc233' } }, icon('flame', 20), ' ' + S.streak, h('span', { className: 'stat-sub' }, ' jours'))
    ),
    h('div', { className: 'stat-card' },
      h('div', { className: 'stat-label' }, 'Temps d\'\u00e9tude'),
      h('div', { className: 'stat-value' }, String(Math.round(S.xp / 120 * 10) / 10), h('span', { className: 'stat-sub' }, ' h'))
    )
  ));

  // Prochaine révision
  var dueCount = getDueCards().length;
  var revBox = h('div', { className: 'box ' + (dueCount > 0 ? 'box-tip' : 'box-business'), style: { marginBottom: '20px' } },
    h('span', { className: 'box-label' }, 'Prochaine r\u00e9vision'),
    dueCount > 0
      ? h('span', null, icon('shuffle', 14), ' ', String(dueCount), ' flashcard' + (dueCount > 1 ? 's' : '') + ' à revoir aujourd\'hui')
      : h('span', null, icon('check', 14), ' Aucune flashcard à revoir — bien joué !')
  );
  if (dueCount > 0) {
    revBox.appendChild(h('button', {
      onClick: function() { S.tab = 'flash'; S.fcFilter = 'due'; render(); },
      style: { marginTop: '8px', fontSize: '12px', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
    }, 'R\u00e9viser maintenant \u2192'));
  }
  wrap.appendChild(revBox);

  // XP Activity Chart (14 last days)
  if (S.xpHistory.length > 0) {
    var totalXp14 = S.xpHistory.reduce(function(sum, e) {
      var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
      return e.date >= cutoff.toISOString().slice(0, 10) ? sum + e.xp : sum;
    }, 0);
    wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '4px' } }, 'XP des 30 derniers jours'));
    wrap.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' } }, String(totalXp14) + ' XP gagn\u00e9s sur les 14 derniers jours'));
    var last14 = [];
    var today = new Date();
    for (var d = 13; d >= 0; d--) {
      var dt = new Date(today); dt.setDate(dt.getDate() - d);
      var dateStr = dt.toISOString().slice(0, 10);
      var entry = S.xpHistory.find(function(e) { return e.date === dateStr; });
      last14.push({ date: dateStr, xp: entry ? entry.xp : 0, day: dt.getDate() });
    }
    var maxXp = Math.max.apply(null, last14.map(function(e) { return e.xp; })) || 1;
    var chart = h('div', { className: 'xp-chart', style: { marginBottom: '4px' } });
    last14.forEach(function(e) {
      var pct = Math.round(e.xp / maxXp * 100);
      var col = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1' } });
      var bar = h('div', { className: 'xp-chart-bar', style: { height: Math.max(2, pct) + '%' }, title: e.date + ': ' + e.xp + ' XP' });
      if (e.xp === 0) bar.style.background = 'var(--bg3)';
      col.appendChild(bar);
      chart.appendChild(col);
    });
    wrap.appendChild(chart);
    var labels = h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '0 2px' } });
    last14.forEach(function(e) {
      labels.appendChild(h('span', { style: { fontSize: '9px', color: 'var(--tx3)', flex: '1', textAlign: 'center' } }, String(e.day)));
    });
    wrap.appendChild(labels);
  } else {
    wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '10px' } }, 'XP des 30 derniers jours'));
    wrap.appendChild(h('div', { className: 'box box-business', style: { marginBottom: '20px', textAlign: 'center', padding: '24px 16px' } },
      h('div', { style: { fontSize: '13px', color: 'var(--tx3)' } }, 'Commence à apprendre pour voir ta progression ici.')
    ));
  }

  // Heatmap (28 days)
  wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '10px' } }, 'Heatmap d\'activite (28 jours)'));
  var heatmapGrid = h('div', { className: 'heatmap', style: { marginBottom: '20px', maxWidth: '250px' } });
  var todayHeat = new Date();
  for (var hd = 27; hd >= 0; hd--) {
    var hdt = new Date(todayHeat); hdt.setDate(hdt.getDate() - hd);
    var hdStr = hdt.toISOString().slice(0, 10);
    var hEntry = S.xpHistory.find(function(e) { return e.date === hdStr; });
    var hxp = hEntry ? hEntry.xp : 0;
    var hClass = 'heatmap-cell';
    if (hxp > 0 && hxp < 30) hClass += ' l1';
    else if (hxp >= 30 && hxp < 80) hClass += ' l2';
    else if (hxp >= 80 && hxp < 150) hClass += ' l3';
    else if (hxp >= 150) hClass += ' l4';
    heatmapGrid.appendChild(h('div', { className: hClass, title: hdStr + ': ' + hxp + ' XP' }));
  }
  wrap.appendChild(heatmapGrid);

  // Badges
  if (typeof BADGES !== 'undefined') {
    wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '10px' } }, 'Badges (' + S.badges.length + '/' + BADGES.length + ')'));
    var badgeGrid = h('div', { className: 'badge-grid', style: { marginBottom: '20px' } });
    BADGES.forEach(function(b) {
      var earned = S.badges.indexOf(b.id) !== -1;
      badgeGrid.appendChild(h('div', { className: 'badge-item' + (earned ? '' : ' locked') },
        h('div', { className: 'badge-icon' }, earned ? icon('award', 24) : icon('lock', 24)),
        h('div', { className: 'badge-name' }, b.name),
        h('div', { className: 'badge-desc' }, b.desc)
      ));
    });
    wrap.appendChild(badgeGrid);
  }

  // Recommendations
  const recs = getRecommendations();
  if (recs.length > 0) {
    const recBox = h('div', { className: 'box box-tip', style: { marginBottom: '20px' } },
      h('span', { className: 'box-label' }, 'Recommandations')
    );
    recs.forEach(r => {
      const row = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' } },
        h('span', null, ...(r.iconName ? [icon(r.iconName, 14), ' '] : []), r.text)
      );
      if (r.action && r.label) {
        row.appendChild(h('button', {
          onClick: r.action,
          style: { marginLeft: '12px', fontSize: '12px', whiteSpace: 'nowrap', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
        }, r.label + ' →'));
      }
      recBox.appendChild(row);
    });
    wrap.appendChild(recBox);
  }

  // Predictive progression
  const pred = getPredictiveStats();
  if (pred.globalPct > 0) {
    const predBox = h('div', { className: 'box box-theory', style: { marginBottom: '20px' } },
      h('span', { className: 'box-label' }, 'Estimation PL-300')
    );
    predBox.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' } },
      h('div', null, 'Taux de reussite global : ', h('strong', null, `${pred.globalPct}%`)),
      h('div', null, 'Score estime : ', h('strong', { style: { color: pred.ready ? 'var(--green)' : 'var(--red)' } }, `${pred.estimatedScore}/1000`)),
      pred.strongest ? h('div', null, 'Domaine le plus fort : ', h('strong', { style: { color: 'var(--green)' } }, `${DOMAINS[pred.strongest]?.name} (${pred.strongPct}%)`)) : h('div'),
      pred.weakest ? h('div', null, 'Domaine le plus faible : ', h('strong', { style: { color: 'var(--red)' } }, `${DOMAINS[pred.weakest]?.name} (${pred.weakPct}%)`)) : h('div')
    ));
    predBox.appendChild(h('div', { style: { marginTop: '10px', fontSize: '14px', fontWeight: '600', color: pred.ready ? 'var(--green)' : 'var(--red)' } },
      pred.ready ? 'Pr\u00eat pour la PL-300 !' : 'Pas encore pr\u00eat pour la PL-300'
    ));
    if (pred.weeksEstimate) {
      predBox.appendChild(h('div', { style: { marginTop: '4px', fontSize: '13px', color: 'var(--tx2)' } },
        `A ton rythme actuel, tu seras pr\u00eat dans environ ${pred.weeksEstimate} semaine${pred.weeksEstimate > 1 ? 's' : ''}`
      ));
    }
    wrap.appendChild(predBox);
  }

  // Progress by chapter
  wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '14px' } }, 'Progression par chapitre'));
  CHAPTERS.forEach(ch => {
    const [from, to] = ch.missions;
    const total = to - from + 1;
    const done = Array.from({ length: total }, (_, i) => S.missions[from + i]).filter(Boolean).length;
    const pct = Math.round(done / total * 100);

    wrap.appendChild(h('div', { style: { marginBottom: '14px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' } },
        h('span', { style: { fontWeight: '500' } }, `Ch.${ch.id} — ${ch.title}`),
        h('span', { style: { color: 'var(--tx3)' } }, `${done}/${total}`)
      ),
      h('div', { className: 'progress-bar' },
        h('div', { className: 'progress-fill' + (pct === 100 ? ' green' : ''), style: { width: pct + '%' } })
      )
    ));
  });

  // Quiz by domain
  wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', margin: '24px 0 14px' } }, 'Quiz par domaine PL-300'));
  Object.entries(DOMAINS).forEach(([d, dom]) => {
    const domainQs = QUIZ.filter(q => q.d === d);
    let right = 0, total = 0;
    domainQs.forEach(q => {
      const st = S.quizStats[qHash(q)];
      if (st) { right += st.right; total += st.right + st.wrong; }
    });
    const pct = total > 0 ? Math.round(right / total * 100) : 0;
    const weak = total > 5 && pct < 60;

    var domColor = pct >= 80 ? 'var(--green)' : pct >= 60 ? '#e8a030' : 'var(--red)';
    var domIndicator = total > 0 ? h('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: domColor, marginRight: '6px' } }) : null;
    wrap.appendChild(h('div', { style: { marginBottom: '14px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' } },
        h('span', null, icon(dom.icon, 14), ' ' + dom.name + ' (' + dom.weight + ')'),
        h('span', { style: { color: total > 0 ? domColor : 'var(--tx3)', fontWeight: total > 0 ? '600' : '400' } },
          domIndicator,
          total > 0 ? `${pct}% (${right}/${total})` : 'Pas encore teste'
        )
      ),
      h('div', { className: 'progress-bar' },
        h('div', { className: 'progress-fill', style: { width: pct + '%', background: total > 0 ? domColor : 'var(--bd)' } })
      ),
      weak ? h('div', { style: { fontSize: '12px', color: 'var(--red)', marginTop: '4px' } }, `Point faible — révise les chapitres ${PL300_INFO.domains.find(x => x.id === d)?.chapters.join(', ')}`) : null
    ));
  });

  // Weak domain recommendations
  var _weakDoms = [];
  Object.entries(DOMAINS).forEach(function(entry) {
    var dId = entry[0];
    var domainQs = QUIZ.filter(function(q) { return q.d === dId; });
    var dRight = 0, dTotal = 0;
    domainQs.forEach(function(q) {
      var st = S.quizStats[qHash(q)];
      if (st) { dRight += st.right; dTotal += st.right + st.wrong; }
    });
    if (dTotal >= 5) {
      var dPct = Math.round(dRight / dTotal * 100);
      if (dPct < 70) {
        var domInfo = PL300_INFO.domains.find(function(x) { return x.id === dId; });
        var firstCh = domInfo && domInfo.chapters.length > 0 ? domInfo.chapters[0] : null;
        _weakDoms.push({ id: dId, name: entry[1].name, pct: dPct, ch: firstCh });
      }
    }
  });
  if (_weakDoms.length > 0) {
    var weakBox = h('div', { className: 'box box-error', style: { marginTop: '16px', marginBottom: '20px' } },
      h('span', { className: 'box-label' }, 'Recommandations')
    );
    _weakDoms.forEach(function(wd) {
      var wdRow = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' } },
        h('span', null, 'Domaine faible détecté : ', h('strong', null, wd.name), ' (' + wd.pct + '%)')
      );
      if (wd.ch && CHAPTERS[wd.ch - 1]) {
        wdRow.appendChild(h('button', {
          onClick: function() { S.tab = 'formation'; S.chapterIdx = wd.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
          style: { marginLeft: '12px', fontSize: '12px', whiteSpace: 'nowrap', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
        }, 'R\u00e9viser Ch.' + wd.ch + ' \u2192'));
      }
      weakBox.appendChild(wdRow);
    });
    wrap.appendChild(weakBox);
  }

  // Best exam
  if (S.examHistory.length > 0) {
    const best = S.examHistory.reduce((a, b) => a.score > b.score ? a : b);
    wrap.appendChild(h('div', { className: 'box ' + (best.score >= 700 ? 'box-business' : 'box-error'), style: { marginTop: '20px' } },
      h('span', { className: 'box-label' }, 'Meilleur examen'),
      `${best.score}/1000 — ${best.date} — ${best.score >= 700 ? 'RÉUSSI' : 'Pas encore le niveau'}`
    ));
  } else {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '16px', color: 'var(--tx3)', fontSize: '13px', marginTop: '20px' } },
      'Pas encore d\'examen blanc. Lance-toi quand tu te sens pr\u00eat !'
    ));
  }

  // Reset
  wrap.appendChild(h('button', {
    onClick: () => {
      if (confirm('Réinitialiser toute la progression ?')) {
        S.missions = {}; S.checklist = {}; S.known = {}; S.quizStats = {}; S.examHistory = []; S.exCompleted = {}; S.xp = 0; S.level = 0; S.badges = []; S.streak = 0; S.lastActiveDate = null; S.xpHistory = []; S.interviewReviewed = {};
        save(); render();
      }
    },
    style: { marginTop: '24px', fontSize: '12px', color: 'var(--red)', background: 'none', border: 'none' }
  }, 'Réinitialiser toute la progression'));

  return wrap;
}

// ═══════════════════════════════════════════════════════════
// INTERVIEW TAB
// ═══════════════════════════════════════════════════════════
function renderInterview() {
  var wrap = h('div', null);
  if (typeof INTERVIEW === 'undefined' || !Array.isArray(INTERVIEW)) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--tx3)' } }, 'Questions d\'entretien bient\u00f4t disponibles.'));
    return wrap;
  }
  var categories = [];
  INTERVIEW.forEach(function(q) { if (categories.indexOf(q.category) === -1) categories.push(q.category); });
  // Filter pills
  wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
    h('h3', { style: { fontSize: '16px', fontWeight: '600' } }, 'Questions d\'entretien Data Analyst / Power BI'),
    h('span', { style: { fontSize: '13px', color: 'var(--tx3)' } },
      Object.keys(S.interviewReviewed).length + '/' + INTERVIEW.length + ' revisees')
  ));
  wrap.appendChild(h('div', { className: 'pills', style: { marginBottom: '16px' } },
    h('button', { className: 'pill' + (S.interviewFilter === 'all' ? ' active' : ''), onClick: function() { S.interviewFilter = 'all'; render(); } }, 'Toutes'),
    categories.map(function(c) {
      return h('button', { className: 'pill' + (S.interviewFilter === c ? ' active' : ''), onClick: function() { S.interviewFilter = c; render(); } }, c);
    })
  ));
  var filtered = S.interviewFilter === 'all' ? INTERVIEW : INTERVIEW.filter(function(q) { return q.category === S.interviewFilter; });
  filtered.forEach(function(q) {
    var isOpen = S['iw_open_' + q.id];
    var reviewed = S.interviewReviewed[q.id];
    var card = h('div', { className: 'interview-card' });
    var header = h('div', { className: 'interview-card-header', onClick: function() {
      S['iw_open_' + q.id] = !S['iw_open_' + q.id];
      if (!S.interviewReviewed[q.id]) {
        S.interviewReviewed[q.id] = true;
        addXP(5, 'Entretien');
      }
      render();
    } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        reviewed ? icon('check', 14) : h('span', { style: { width: '14px', display: 'inline-block' } }),
        h('span', { className: 'badge', style: { background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: '10px' } }, q.category),
        h('span', null, q.q)
      ),
      icon(isOpen ? 'chevronDown' : 'chevronRight', 14)
    );
    card.appendChild(header);
    if (isOpen) {
      var body = h('div', { className: 'interview-card-body open' },
        h('div', { className: 'interview-label' }, 'Réponse idéale'),
        h('div', { style: { whiteSpace: 'pre-wrap', marginBottom: '12px' } }, q.ideal),
        q.traps && q.traps.length > 0 ? h('div', null,
          h('div', { className: 'interview-label', style: { color: 'var(--red)' } }, 'Pieges a eviter'),
          q.traps.map(function(t) { return h('div', { style: { fontSize: '13px', color: 'var(--red)', marginBottom: '4px' } }, '- ' + t); })
        ) : null,
        h('div', { className: 'interview-label', style: { color: 'var(--purple)' } }, 'Ce que le recruteur cherche'),
        h('div', { style: { fontSize: '13px', color: 'var(--purple)' } }, q.whatTheyWant)
      );
      card.appendChild(body);
    }
    wrap.appendChild(card);
  });
  return wrap;
}

// ═══════════════════════════════════════════════════════════
// EXAM STRATEGY
// ═══════════════════════════════════════════════════════════
function renderExamStrategy() {
  if (typeof EXAM_STRATEGY === 'undefined') return h('div');
  var es = EXAM_STRATEGY;
  var box = h('div', { className: 'exam-strategy-box' });
  var isOpen = S._examStrategyOpen;
  var header = h('div', { className: 'exam-strategy-header', onClick: function() {
    S._examStrategyOpen = !S._examStrategyOpen; render();
  } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      icon('shield', 16),
      h('span', null, 'Strategie d\'examen PL-300')
    ),
    icon(isOpen ? 'chevronDown' : 'chevronRight', 14)
  );
  box.appendChild(header);
  if (isOpen) {
    var body = h('div', { className: 'exam-strategy-body open' });
    // Format
    body.appendChild(h('div', { style: { marginBottom: '16px' } },
      h('div', { style: { fontWeight: '600', marginBottom: '8px', fontSize: '14px' } }, 'Format de l\'examen'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' } },
        h('span', null, 'Duree : ' + es.format.duration + ' minutes'),
        h('span', null, 'Questions : ' + es.format.questions),
        h('span', null, 'Seuil : ' + es.format.passing + '/' + es.format.maxScore),
        h('span', null, 'Score max : ' + es.format.maxScore)
      )
    ));
    // Time management
    body.appendChild(h('div', { style: { marginBottom: '16px' } },
      h('div', { style: { fontWeight: '600', marginBottom: '8px', fontSize: '14px' } }, 'Gestion du temps'),
      es.timeManagement.map(function(t) {
        return h('div', { style: { fontSize: '13px', marginBottom: '4px', paddingLeft: '12px', borderLeft: '2px solid var(--accent)' } }, t);
      })
    ));
    // Traps
    body.appendChild(h('div', { style: { marginBottom: '16px' } },
      h('div', { style: { fontWeight: '600', marginBottom: '8px', fontSize: '14px', color: 'var(--red)' } }, 'Les 10 pieges'),
      es.traps.map(function(t) {
        return h('div', { style: { marginBottom: '8px', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: '13px' } },
          h('div', { style: { fontWeight: '600', color: 'var(--red)', marginBottom: '4px' } }, t.trap),
          h('div', { style: { color: 'var(--tx2)' } }, t.advice)
        );
      })
    ));
    // Last week
    body.appendChild(h('div', { style: { marginBottom: '16px' } },
      h('div', { style: { fontWeight: '600', marginBottom: '8px', fontSize: '14px' } }, 'Checklist derniere semaine'),
      es.lastWeek.map(function(d) {
        return h('div', { style: { fontSize: '13px', marginBottom: '4px', paddingLeft: '12px', borderLeft: '2px solid var(--green)' } }, d);
      })
    ));
    box.appendChild(body);
  }
  return box;
}

// ═══════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════
function renderSearch(query) {
  const wrap = h('div', null);
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) {
    wrap.appendChild(h('div', { style: { color: 'var(--tx3)', textAlign: 'center', padding: '40px' } }, 'Tape au moins 2 caractères pour chercher.'));
    return wrap;
  }

  const results = [];

  // Search in sections
  CHAPTERS.forEach(ch => {
    ch.sections.forEach(sec => {
      const fields = [sec.theory, sec.code, sec.business, sec.tip, sec.deep].filter(Boolean).join(' ');
      if (fields.toLowerCase().includes(q)) {
        results.push({ type: 'section', label: `${sec.id} ${sec.title}`, detail: sec.theory, ch: ch.id, action: () => { S.chapterIdx = ch.id - 1; S.tab = 'formation'; S.searchOpen = false; render(); } });
      }
    });
  });

  // Search in quiz
  QUIZ.forEach((quiz, i) => {
    if (quiz.q.toLowerCase().includes(q) || quiz.w.toLowerCase().includes(q)) {
      results.push({ type: 'quiz', label: quiz.q.slice(0, 80), detail: `Ch.${quiz.ch} — ${DOMAINS[quiz.d]?.name || ''}`, ch: quiz.ch, action: null });
    }
  });

  // Search in flashcards
  FLASHCARDS.forEach((fc, i) => {
    if (fc.f.toLowerCase().includes(q) || fc.b.toLowerCase().includes(q)) {
      results.push({ type: 'flash', label: fc.f, detail: fc.b, ch: fc.ch, action: () => { S.tab = 'flash'; S.fcFilter = 'all'; S.fcIdx = i; S.fcFlipped = false; S.searchOpen = false; render(); } });
    }
  });

  // Search in glossary
  GLOSSARY.forEach(g => {
    if (g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q)) {
      results.push({ type: 'glossaire', label: g.term, detail: g.def, ch: g.ch, action: () => { S.tab = 'ref'; S.refTab = 'glossary'; S.searchOpen = false; render(); } });
    }
  });

  // Search in measures
  MEASURES.forEach(m => {
    if (m.n.toLowerCase().includes(q) || m.f.toLowerCase().includes(q)) {
      results.push({ type: 'mesure', label: m.n, detail: m.f, ch: m.ch, action: () => { S.tab = 'ref'; S.refTab = 'measures'; S.searchOpen = false; render(); } });
    }
  });

  // Search in missions
  MISSIONS.forEach(m => {
    if (m.text.toLowerCase().includes(q) || (m.solution && m.solution.toLowerCase().includes(q))) {
      results.push({ type: 'mission', label: `#${m.id} — ${m.text.slice(0, 60)}`, detail: m.solution?.slice(0, 80), ch: m.ch, action: () => { S.tab = 'formation'; S.chapterIdx = m.ch - 1; S.searchOpen = false; render(); } });
    }
  });

  wrap.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx3)', marginBottom: '14px' } }, `${results.length} résultat${results.length > 1 ? 's' : ''} pour "${query}"`));

  const typeColors = { section: 'var(--accent)', quiz: 'var(--purple)', flash: '#F0AD4E', glossaire: 'var(--green)', mesure: 'var(--red)', mission: 'var(--tx2)' };

  results.slice(0, 30).forEach(r => {
    wrap.appendChild(h('div', {
      style: { padding: '10px 14px', borderBottom: '1px solid var(--bd)', cursor: r.action ? 'pointer' : 'default' },
      ...(r.action ? { onClick: r.action } : {})
    },
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' } },
        h('span', { className: 'badge', style: { background: typeColors[r.type] + '20', color: typeColors[r.type], fontSize: '10px' } }, r.type),
        h('span', { style: { fontSize: '13px', fontWeight: '500' } }, r.label)
      ),
      r.detail ? h('div', { style: { fontSize: '12px', color: 'var(--tx3)' } }, r.detail.slice(0, 100)) : null
    ));
  });

  if (results.length === 0) {
    wrap.appendChild(h('div', { style: { color: 'var(--tx3)', textAlign: 'center', padding: '40px' } }, 'Aucun résultat.'));
  }

  return wrap;
}

// ═══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  // Don't intercept if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Search toggle: Ctrl+K or /
  if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !S.searchOpen)) {
    e.preventDefault();
    S.searchOpen = !S.searchOpen;
    S.searchQuery = '';
    render();
    if (S.searchOpen) setTimeout(() => { const inp = document.getElementById('search-input'); if (inp) inp.focus(); }, 50);
    return;
  }

  // Escape closes search
  if (e.key === 'Escape' && S.searchOpen) {
    S.searchOpen = false; render(); return;
  }

  // Quiz shortcuts
  if (S.tab === 'quiz' && S.quizQuestions.length > 0 && S.qi >= 0 && S.qi < S.quizQuestions.length) {
    // A/B/C/D to answer
    if (!S.shown && 'abcd'.includes(e.key.toLowerCase())) {
      const idx = e.key.toLowerCase().charCodeAt(0) - 97;
      const cq = S.quizQuestions[S.qi];
      if (idx < cq.o.length) {
        document.querySelectorAll('.quiz-opt')[idx]?.click();
      }
      return;
    }
    // Space or Enter or ArrowRight for next
    if (S.shown && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight')) {
      e.preventDefault();
      document.querySelector('.quiz-next')?.click();
      return;
    }
  }

  // Flashcard shortcuts
  if (S.tab === 'flash') {
    // Space to flip
    if (e.key === ' ') {
      e.preventDefault();
      S.fcFlipped = !S.fcFlipped; render(); return;
    }
    // ArrowRight for next
    if (e.key === 'ArrowRight' && S.fcFlipped) {
      const fc = S.fcFilter === 'all' ? FLASHCARDS : S.fcFilter === 'review' ? FLASHCARDS.filter((_, i) => !sm2IsMastered(i)) : S.fcFilter === 'due' ? FLASHCARDS.filter((_, i) => sm2IsDue(i)) : FLASHCARDS.filter(f => f.c === S.fcFilter);
      S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render(); return;
    }
    // ArrowLeft for prev
    if (e.key === 'ArrowLeft') {
      S.fcFlipped = false; S.fcIdx = Math.max(0, S.fcIdx - 1); render(); return;
    }
    // 1 = à revoir (q=1), 2 = difficile (q=3), 3 = facile (q=5)
    if (S.fcFlipped && '123'.includes(e.key)) {
      const base2 = S.fcShuffled || FLASHCARDS;
      let fc2;
      if (S.fcFilter === 'all') fc2 = base2;
      else if (S.fcFilter === 'due') fc2 = base2.filter((c) => { const gi = FLASHCARDS.indexOf(c); return sm2IsDue(gi); });
      else if (S.fcFilter === 'review') fc2 = base2.filter((c) => { const gi = FLASHCARDS.indexOf(c); return !sm2IsMastered(gi); });
      else fc2 = base2.filter(f => f.c === S.fcFilter);
      const globalIdx = FLASHCARDS.indexOf(fc2[S.fcIdx]);
      if (e.key === '1') sm2Update(globalIdx, 1);
      else if (e.key === '2') sm2Update(globalIdx, 3);
      else if (e.key === '3') sm2Update(globalIdx, 5);
      S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc2.length - 1); render();
      return;
    }
  }
});

// ─── Init ───
S.searchOpen = false;
// ═══════════════════════════════════════════════════════════
// MOBILE SWIPE SUPPORT (flashcards)
// ═══════════════════════════════════════════════════════════
(function() {
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (S.tab !== 'flash') return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dt = Date.now() - touchStartTime;
    // Only count as swipe if horizontal > vertical and fast enough
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || dt > 400) return;
    const base = S.fcShuffled || FLASHCARDS;
    var fc;
    if (S.fcFilter === 'all') fc = base;
    else if (S.fcFilter === 'due') fc = base.filter(function(c) { return sm2IsDue(FLASHCARDS.indexOf(c)); });
    else if (S.fcFilter === 'review') fc = base.filter(function(c) { return !sm2IsMastered(FLASHCARDS.indexOf(c)); });
    else fc = base.filter(function(f) { return f.c === S.fcFilter; });
    if (dx > 0) {
      // Swipe right = previous
      S.fcFlipped = false; S.fcIdx = Math.max(0, S.fcIdx - 1); render();
    } else {
      // Swipe left = next
      S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render();
    }
  }, { passive: true });
})();

S.searchQuery = '';
load();
initTheme();
// Default dark mode if no preference saved
if (!localStorage.getItem('pbi-theme')) {
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('pbi-theme', 'dark');
}
render();
showOnboarding();
// Auto-sync on load if connected
if (_syncCode) { syncPull(); }
