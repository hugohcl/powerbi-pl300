# DAX Academy — Architecture

## 1. Project Structure

```
PowerBI-PL300/
├── index.html              — Page unique (HTML + CSS inline, 724 lignes)
├── app.js                  — Logique applicative (~4926 lignes)
├── data.js                 — Contenu pédagogique (~1574 lignes)
├── sw.js                   — Service Worker PWA (47 lignes)
├── manifest.json           — PWA manifest
├── icon.png                — Icône 256x256 (modèle relationnel, fond violet)
├── icon.ico                — Favicon
├── render.yaml             — Config Render (déploiement)
├── CLAUDE.md               — Consignes Claude Code
├── ARCHITECTURE.md         — Ce fichier
├── server.js               — Serveur local dev (port 3456)
├── create-shortcut.ps1     — Script Windows raccourci
├── .claude/
│   └── launch.json         — Config preview Claude Code
├── .github/
│   └── workflows/
│       └── auto-merge-claude.yml  — Auto-merge branches claude/*
└── server/
    ├── server.js            — API Express.js (272 lignes)
    ├── package.json
    ├── package-lock.json
    └── data/
        └── sync.db          — SQLite (gitignored)
```

## 2. High-Level System Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Navigateur │────▶│  PWA vanilla JS  │────▶│  Express API │
│   (Mobile/   │◀────│  (index.html +   │◀────│  /api/sync/* │
│    Desktop)  │     │   app.js + data)  │     │   port 3001  │
└──────────────┘     └──────────────────┘     └──────┬───────┘
                              │                       │
                     ┌────────┴────────┐     ┌───────┴───────┐
                     │  localStorage   │     │    SQLite     │
                     │  (pbi-pl300)    │     │   sync.db     │
                     └─────────────────┘     └───────────────┘
```

**Flux de données :**
- L'app stocke tout dans `localStorage` (clé `pbi-pl300`)
- En arrière-plan, sync push/pull vers le backend Express
- Le backend stocke dans SQLite avec merge intelligent (3-way)
- Service Worker cache les assets pour usage offline

## 3. Core Components (app.js)

### Routing & Rendering (lignes 538-591, 947-1428)
- `h(tag, attrs, ...children)` — Hyperscript builder (createElement wrapper)
- `render()` — Dispatch principal : appelle le renderer de l'onglet actif
- `$(sel)` — querySelector shorthand
- Navigation par `S.tab` : home | formation | quiz | flash | progress | reference | interview | search | exercises

### State & Persistence (lignes 111-370)
- `S` — Objet état global (tab, missions, quiz, flashcards, XP, etc.)
- `save()` — Persiste S dans localStorage + déclenche sync cloud
- `load()` — Charge depuis localStorage au démarrage
- `getSaveData()` / `applyData(d)` — Sérialisation/désérialisation

### Cloud Sync (lignes 212-370)
- `syncPush()` — POST /api/sync/push (conflict resolution)
- `syncPull()` — GET /api/sync/pull/{code}
- `syncGenerate()` — Crée un nouveau code sync (XXXX-XXXX)
- `syncConnect(code)` — Connecte à un code existant
- Merge intelligent : union pour les objets, max pour les scalaires

### Quiz Engine (lignes 2596-3386)
- `startQuiz(filter, mode)` — Init quiz (training ou exam)
- `renderQuiz()` — UI quiz (question, options, feedback, résultats)
- `finishExam()` — Score /1000 par domaine PL-300
- Mode examen : 50 questions, timer 100 min

### Flashcards SM-2 (lignes 479-536, 3778+)
- `sm2Default()` / `sm2Get(idx)` / `sm2Update(idx, quality)` — Algorithme SM-2
- `sm2IsDue(idx)` / `sm2IsMastered(idx)` — Planification des révisions
- `getDueCards()` — Cartes à réviser aujourd'hui
- `renderFlashcards()` — UI avec flip front/back

### Gamification (lignes 627-1256)
- `addXP(amount, source)` — Attribution XP
- `getLevel(xp)` — Calcul niveau (Débutant → PL-300 Ready)
- `checkBadges()` — Débloquage badges
- `updateStreak()` — Streak jours consécutifs
- `composeDailyMix()` / `startDailyMix()` — Challenge quotidien
- `showCelebration()` / `showNotification()` — Toasts visuels

### Formation (lignes 1947-2596)
- `renderChapterList()` — Liste des 7 chapitres avec progression
- `renderChapterDetail(ch)` — Sections (theory/business/tip/deep) + missions
- `renderMission(m)` — Card mission avec corrigé spoiler
- `renderInteractiveMission(im)` — Mission guidée avec hints
- Skill tree non-linéaire avec prérequis

### Pomodoro (lignes 3386-3482)
- `startPomodoro()` — Timer 25min focus / 5min pause / 15min longue pause
- Cycle : 4 sessions → pause longue

### Search (lignes 4686-4763)
- `renderSearch(query)` — Recherche full-text dans sections, quiz, flashcards, glossaire, missions

### Exercices DAX (lignes 3487-3778)
- `renderExercises()` — Interface exercices libres
- `checkExercise(input, exercise)` — Validation formule DAX
- `getGuidedSteps(ex)` — Hints progressifs par pattern DAX

### Référence (lignes 3943-4627)
- 3 sous-onglets : Mesures DAX (24), Patterns (12), Glossaire (27 termes)
- Exercices DAX par difficulté
- Mode entretien (50+ questions)

### UI Components (lignes 1301-1600)
- `renderHeader()` — Barre supérieure (XP, thème, sync)
- `renderSidebar()` — Nav desktop (260px fixe, glassmorphism)
- `renderTabs()` — Tab bar mobile (5 onglets, bottom fixe)
- `icon(name, size)` — Icônes SVG (pas d'emojis)
- `highlightCode(code)` — Coloration syntaxique DAX/M/SQL

## 4. Data Stores

### localStorage
| Clé | Contenu | Usage |
|-----|---------|-------|
| `pbi-pl300` | JSON complet de S (missions, quiz, XP, flashcards...) | Sauvegarde principale |
| `pbi-sync-code` | Code sync XXXX-XXXX | Identifiant cloud |
| `pbi-sync-updated` | Timestamp dernière sync | Détection conflits |
| `pbi-theme` | dark \| light \| highcontrast | Thème UI |
| `pbi-onboarded` | true | Skip onboarding |

### SQLite (server/data/sync.db)
```sql
CREATE TABLE users (
  code TEXT PRIMARY KEY,           -- Format XXXX-XXXX
  data TEXT NOT NULL DEFAULT '{}', -- JSON blob (tout l'état)
  updated_at INTEGER,              -- Timestamp pour conflict resolution
  created_at INTEGER
)
```
- WAL mode activé
- Cleanup auto : suppression des entrées > 90 jours

### data.js (contenu statique)
- `CHAPTERS` — 7 chapitres avec sections (theory, business, tip, deep)
- `MISSIONS` — ~108 missions guidées avec corrigés
- `INTERACTIVE_MISSIONS` — Missions interactives
- `RACING_MISSIONS` — Missions racing
- `FLASHCARDS` — 81 flashcards (front/back, catégorie, chapitre)
- `DOMAINS` — 4 domaines PL-300 avec poids examen

## 5. Deployment & Infrastructure

### Render
- Config : `render.yaml`
- Auto-deploy on commit sur `master`
- Backend Express sur port 3001
- Static files servis par Express (parent directory)

### Service Worker (sw.js)
- **Cache version** : `pl300-v3.0.9` (attention : pas toujours à jour)
- **Assets cachés** : `./`, `./index.html`, `./app.js?v=X`, `./data.js?v=X`, `./icon.png`, `./manifest.json`
- **Stratégie** :
  - API (`/api/*`) : network first, fallback `{"error":"offline"}`
  - Static : cache first, network fallback
- Le query param `?v=X` force le cache bust

### GitHub Actions
- `.github/workflows/auto-merge-claude.yml`
- Trigger : push sur `claude/**`
- Action : crée une PR + squash-merge automatique
- Prérequis : permissions Read/Write + Allow create PRs (activé)

## 6. Development & Testing

### Setup local
```bash
# Frontend (serveur statique)
node server.js
# → http://localhost:3456

# Backend (API sync)
cd server && npm install && node server.js
# → http://localhost:3001
```

### Commandes utiles
```bash
# Vérification syntaxe
node --check app.js
node --check data.js
node --check server/server.js

# Smoke tests
node tests/smoke.js

# Comptage lignes
wc -l app.js data.js index.html sw.js
```

### Versioning
Bumper dans **3 fichiers** à chaque push :
1. `app.js` — `const APP_VERSION = 'x.y.z'`
2. `sw.js` — `const CACHE_NAME = 'pl300-vx.y.z'` + query params assets
3. `index.html` — `<meta name="version" content="x.y.z">` (si présent)

## 7. Future Considerations

### Dette technique
- **app.js (4926 lignes)** — À découper en modules ES (src/core, src/features, src/ui)
- **Styles inline dans app.js** — Beaucoup de `h()` avec des styles inline → migrer vers des classes CSS
- **sw.js désynchronisé** — Le cache version et les query params ne sont pas toujours alignés avec APP_VERSION
- **Pas de tests automatisés** — Smoke tests à créer (tests/smoke.js)

### Migrations planifiées
- Découpage app.js en ES modules (Phase 1.1 du brief)
- Page transitions CSS (Phase 2.1)
- Barre de progression globale header (Phase 2.2)
- Export/import JSON données utilisateur (Phase 3.1)
- Historique sessions (heatmap, charts SVG) (Phase 3.2)
- Accessibilité WCAG AA (Phase 3.3)

### 11 missions redondantes à réécrire
Missions #1, #2, #4, #5, #9, #14, #29, #30, #33, #43 — répètent le contenu des sections au lieu de proposer un défi pratique.
