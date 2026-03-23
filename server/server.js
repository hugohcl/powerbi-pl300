const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───
app.use(helmet({
  contentSecurityPolicy: false,  // Let the browser handle CSP (inline styles in index.html)
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Rate limiting: 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessaie dans quelques minutes.' }
});
app.use('/api/', limiter);

// ─── Database ───
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'sync.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    code TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )
`);

// ─── Helpers ───
function generateCode() {
  // Format: XXXX-XXXX (letters + digits, easy to type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 (ambiguous)
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

function validateCode(code) {
  return typeof code === 'string' && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code);
}

function validateData(data) {
  if (!data || typeof data !== 'object') return false;
  // Max ~1MB of JSON data
  const json = JSON.stringify(data);
  if (json.length > 1_000_000) return false;
  return true;
}

// Prepared statements for performance
const stmtGetUser = db.prepare('SELECT * FROM users WHERE code = ?');
const stmtInsertUser = db.prepare('INSERT INTO users (code, data, updated_at, created_at) VALUES (?, ?, ?, ?)');
const stmtUpdateData = db.prepare('UPDATE users SET data = ?, updated_at = ? WHERE code = ?');

// ─── Routes ───

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Generate a new sync code
app.post('/api/sync/generate', (req, res) => {
  const now = Date.now();
  let code;
  let attempts = 0;
  // Ensure unique code
  do {
    code = generateCode();
    attempts++;
    if (attempts > 10) {
      return res.status(500).json({ error: 'Impossible de générer un code unique.' });
    }
  } while (stmtGetUser.get(code));

  const initialData = req.body.data || {};
  if (!validateData(initialData)) {
    return res.status(400).json({ error: 'Données invalides.' });
  }

  stmtInsertUser.run(code, JSON.stringify(initialData), now, now);
  res.json({ code, message: 'Code créé avec succès.' });
});

// Connect to an existing code (check it exists)
app.post('/api/sync/connect', (req, res) => {
  const { code } = req.body;
  if (!validateCode(code)) {
    return res.status(400).json({ error: 'Format de code invalide. Attendu: XXXX-XXXX' });
  }

  const user = stmtGetUser.get(code);
  if (!user) {
    return res.status(404).json({ error: 'Code introuvable. Vérifie ton code.' });
  }

  res.json({
    code: user.code,
    data: JSON.parse(user.data),
    updated_at: user.updated_at
  });
});

// Push data to server
app.post('/api/sync/push', (req, res) => {
  const { code, data, updated_at } = req.body;
  if (!validateCode(code)) {
    return res.status(400).json({ error: 'Code invalide.' });
  }
  if (!validateData(data)) {
    return res.status(400).json({ error: 'Données invalides ou trop volumineuses.' });
  }

  const user = stmtGetUser.get(code);
  if (!user) {
    return res.status(404).json({ error: 'Code introuvable.' });
  }

  const now = Date.now();

  // Conflict resolution: smart merge
  // If the server has newer data, merge instead of overwriting
  if (user.updated_at > (updated_at || 0)) {
    const serverData = JSON.parse(user.data);
    const merged = mergeProgress(serverData, data);
    stmtUpdateData.run(JSON.stringify(merged), now, code);
    return res.json({ status: 'merged', data: merged, updated_at: now });
  }

  stmtUpdateData.run(JSON.stringify(data), now, code);
  res.json({ status: 'ok', updated_at: now });
});

// Pull data from server
app.get('/api/sync/pull/:code', (req, res) => {
  const { code } = req.params;
  if (!validateCode(code)) {
    return res.status(400).json({ error: 'Code invalide.' });
  }

  const user = stmtGetUser.get(code);
  if (!user) {
    return res.status(404).json({ error: 'Code introuvable.' });
  }

  res.json({
    data: JSON.parse(user.data),
    updated_at: user.updated_at
  });
});

// ─── Smart Merge ───
// Instead of last-write-wins, we merge progress intelligently:
// - For objects (missions, checklist, known, quizStats, exCompleted, interviewReviewed):
//   union of keys (if done on either device, it's done)
// - For arrays (examHistory, xpHistory, badges): union/dedupe
// - For numbers (xp, streak): take the max
function mergeProgress(server, client) {
  const merged = {};

  // Object merges (union — if true on either side, keep it)
  ['missions', 'checklist', 'exCompleted', 'interviewReviewed'].forEach(key => {
    merged[key] = { ...(server[key] || {}), ...(client[key] || {}) };
  });

  // quizStats: merge per-question, sum right/wrong
  merged.quizStats = { ...(server.quizStats || {}) };
  const clientStats = client.quizStats || {};
  Object.keys(clientStats).forEach(hash => {
    if (!merged.quizStats[hash]) {
      merged.quizStats[hash] = clientStats[hash];
    } else {
      merged.quizStats[hash] = {
        right: Math.max(merged.quizStats[hash].right || 0, clientStats[hash].right || 0),
        wrong: Math.max(merged.quizStats[hash].wrong || 0, clientStats[hash].wrong || 0)
      };
    }
  });

  // known (SM-2 flashcard data): keep the one with more repetitions
  merged.known = { ...(server.known || {}) };
  const clientKnown = client.known || {};
  Object.keys(clientKnown).forEach(idx => {
    const s = merged.known[idx];
    const c = clientKnown[idx];
    if (!s) {
      merged.known[idx] = c;
    } else if (typeof c === 'object' && typeof s === 'object') {
      // Keep whichever has more repetitions (more progress)
      merged.known[idx] = (c.repetitions || 0) >= (s.repetitions || 0) ? c : s;
    }
  });

  // examHistory: merge by date (dedupe)
  const serverExams = server.examHistory || [];
  const clientExams = client.examHistory || [];
  const examMap = new Map();
  [...serverExams, ...clientExams].forEach(e => {
    const key = e.date + '_' + e.score;
    if (!examMap.has(key)) examMap.set(key, e);
  });
  merged.examHistory = [...examMap.values()].sort((a, b) => new Date(a.date) - new Date(b.date));

  // xpHistory: merge by date (dedupe, take max xp per day)
  const xpMap = new Map();
  [...(server.xpHistory || []), ...(client.xpHistory || [])].forEach(entry => {
    const key = entry.date;
    if (!xpMap.has(key) || entry.xp > xpMap.get(key).xp) {
      xpMap.set(key, entry);
    }
  });
  merged.xpHistory = [...xpMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // badges: union
  merged.badges = [...new Set([...(server.badges || []), ...(client.badges || [])])];

  // Scalars: take max
  merged.xp = Math.max(server.xp || 0, client.xp || 0);
  merged.level = Math.max(server.level || 0, client.level || 0);
  merged.streak = Math.max(server.streak || 0, client.streak || 0);

  // lastActiveDate: take most recent
  merged.lastActiveDate = [server.lastActiveDate, client.lastActiveDate]
    .filter(Boolean)
    .sort()
    .pop() || null;

  return merged;
}

// ─── Serve static frontend (production) ───
app.use(express.static(path.join(__dirname, '..')));

// ─── Chat (Claude Haiku tutor) ───
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Trop de messages, attends une minute.' }
});

const CHAT_SYSTEM = `Tu es un tuteur Power BI et DAX. Tu aides un apprenant qui prépare la certification PL-300.
- Réponds en français, de manière concise (5 lignes max sauf si une formule DAX est nécessaire)
- Utilise des exemples concrets avec la base AdventureWorks PostgreSQL (tables : Sales=sales.salesorderdetail, Orders=sales.salesorderheader, Product=production.product, Customer=sales.customer, Territory=sales.salesterritory)
- Si la question concerne du DAX, donne la formule exacte avec explication courte
- Ne donne pas de réponses trop longues — va droit au but
- Si tu ne sais pas, dis-le honnêtement`;

app.post('/api/chat', chatLimiter, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Clé API Anthropic non configurée. Ajoute ANTHROPIC_API_KEY dans les variables d\'environnement Render.' });
  }

  const { message, context } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message vide.' });
  }

  const systemPrompt = CHAT_SYSTEM + (context ? `\n\nContexte actuel de l'apprenant : ${context}` : '');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: message.trim().slice(0, 2000) }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[chat] API error:', response.status, errBody);
      return res.status(502).json({ error: 'Erreur API Anthropic.' });
    }

    const data = await response.json();
    const reply = data.content && data.content[0] ? data.content[0].text : 'Pas de réponse.';
    res.json({ reply });
  } catch (err) {
    console.error('[chat] Error:', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── Cleanup old entries (> 90 days inactive) ───
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // daily
const MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days
function cleanup() {
  const cutoff = Date.now() - MAX_AGE;
  const result = db.prepare('DELETE FROM users WHERE updated_at < ?').run(cutoff);
  if (result.changes > 0) {
    console.log(`[cleanup] Removed ${result.changes} inactive entries.`);
  }
}
setInterval(cleanup, CLEANUP_INTERVAL);

// ─── Start ───
app.listen(PORT, () => {
  console.log(`PL-300 Sync Server running on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
