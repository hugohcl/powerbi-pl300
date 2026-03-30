# Formation Power BI — Consignes Claude Code

## Règles obligatoires
- **Toujours bumper la version** (APP_VERSION dans app.js, sw.js, index.html) à chaque push. Même pour un hotfix.
- **Toujours communiquer le numéro de version** (ex: "v1.3.3 pushée") dans la réponse après chaque push.
- Nom de l'app : **DAX Academy**

## Stack technique
- Frontend : SPA vanilla JS (index.html, app.js, data.js)
- Backend : Express.js (server/server.js), port 3001
- Base : SQLite via better-sqlite3 (sync cross-device)
- Déploiement : Render (render.yaml), auto-deploy on commit
- PWA : service worker (sw.js) + manifest.json

## Structure
```
index.html          — Page unique (HTML + CSS inline)
app.js              — Logique applicative (~4900 lignes)
data.js             — Contenu formation (chapitres, quiz, exercices)
sw.js               — Service worker (cache offline)
manifest.json       — PWA manifest
icon.png            — Icône app 256x256 (modèle relationnel, fond violet)
server/server.js    — API sync Express
server/data/sync.db — SQLite (gitignored)
```

## Base AdventureWorks (PostgreSQL)
- Utilisée comme source de données pour les exercices Power BI
- Tables : sales.salesorderdetail (alias Sales), sales.salesorderheader (alias Orders), production.product (Product), sales.customer (Customer), sales.salesterritory (Territory), production.productcategory (ProductCategory), production.productsubcategory (ProductSubcategory)
- **Sales = 121 317 lignes** (vérifié par l'utilisateur dans Power BI)

## Architecture applicative

### 5 onglets
Formation | Quiz PL-300 | Flashcards | Référence | Progression

### Contenu (data.js)
- 7 chapitres, 34 sections avec theory/business/tip/deep (0 champs null)
- 108 missions avec corrigés détaillés
- 120+ questions quiz (cross-linking vers chapitres sur mauvaise réponse)
- 60+ flashcards (algorithme SM-2 spaced repetition)
- 24 mesures DAX de référence
- 12 patterns DAX
- 27 termes glossaire
- Mode examen PL-300 (40-60 questions, timer 100 min, score /1000, review par domaine)

### 4 domaines PL-300
| Domaine | Poids examen | Icône |
|---------|-------------|-------|
| Préparer les données | 25-30% | inbox |
| Modéliser les données | 25-30% | target |
| Visualiser et analyser | 25-30% | crosshair |
| Déployer et maintenir | 10-15% | zap |

### Gamification
- XP gagnés par action (quiz, missions, flashcards)
- Niveaux : Débutant → PL-300 Ready
- Badges débloqués par accomplissements
- Streaks (jours consécutifs)

## Design
- Sobre, professionnel (style Linear/Notion)
- Palette : bleu #2E75B6 accent principal
- Dark mode par défaut + Light mode + High-contrast
- **Pas d'emojis** dans l'UI — utiliser des icônes SVG via la fonction `icon()`
- Desktop + Mobile (sidebar desktop, bottom tab bar mobile avec 5 onglets)

### CSS — Convention box-*
Les `.box-*` utilisent un fond neutre `var(--bg2)` avec **seulement un border-left coloré de 2px** :
- `.box-theory` : `border-color: #2E75B6` (bleu)
- `.box-business` : `border-color: #1D9E75` (vert)
- `.box-tip` : `border-color: #F0AD4E` (orange)
- `.box-error` : `border-color: #D85A30` (rouge) — seul type avec fond coloré léger
- `.box-pl300` : `border-color: #7B1FA2` (violet) — seul type avec fond coloré léger

**Important** : dans `renderChapterDetail()`, theory/business/tip sont rendus en **texte brut** (`<p>`) sans box colorée. Seuls error et pl300 gardent des box. L'objectif est d'éviter l'effet "sapin de Noël" (blocs colorés empilés).

### Variables CSS
```
--bg, --bg2, --bg3    — fonds (dark: #141419, #1c1c24, #24242e)
--tx, --tx2, --tx3    — textes (primaire, secondaire, tertiaire)
--ac                  — accent (#2E75B6)
--bd                  — bordures
```
**Ne PAS créer de nouvelles variables** (--text, --border, etc.) — utiliser celles ci-dessus.

## Règles de développement

### Obligatoire
- **Ne JAMAIS réécrire un fichier from scratch** — patcher l'existant avec des remplacements ciblés
- **`node --check`** sur le JS avant chaque commit (ou `node tests/smoke.js` si disponible)
- **Vérifier que tous les `getElementById('x')` ont un `id="x"` dans le HTML**
- Taille du fichier cohérente avec la version précédente après édition

### Safari / iOS
- **JAMAIS d'`onclick` inline avec quotes imbriquées** dans du HTML généré par JS — crash Safari silencieusement. Toujours `createElement` + `addEventListener`
- **`playBeep()` doit être appelé AVANT tout overlay ou transition** — contrainte AudioContext iOS

### Versioning
- Semantic versioning : x.0.0 (majeur), 0.x.0 (moyen), 0.0.x (mineur/hotfix)
- Bumper dans les **3 fichiers** : `APP_VERSION` dans app.js, sw.js, index.html
- Un décalage dans sw.js cause du cache stale

## Déploiement
- **CLI locale** : push directement sur master
- **Claude Code web** : push sur branche `claude/xxx` → GitHub Actions crée la PR + merge auto (`.github/workflows/auto-merge-claude.yml`)
- Render auto-deploy on commit sur master
- Après chaque push, communiquer la version (ex: "v1.3.11 pushée")

### Prérequis GitHub Actions (auto-merge)
Le workflow auto-merge nécessite ces settings GitHub (déjà configurés) :
1. **Settings → Actions → General → Workflow permissions** : "Read and write permissions"
2. **Settings → Actions → General** : cocher "Allow GitHub Actions to create and approve pull requests"
3. **Pas de branch protection rule** sur master (sinon le `GITHUB_TOKEN` ne peut pas merger)
4. Le workflow utilise `actions/checkout@v4` + `gh pr create` + `gh pr merge --squash --delete-branch`

### Problème connu : branche divergente après squash-merge
Le `--squash --delete-branch` supprime la branche remote après le premier merge. Si on re-push sur la même branche, les anciens commits (pré-squash) sont toujours dans l'historique local → GitHub voit un conflit et refuse le merge ("merge commit cannot be cleanly created").
**Solution** : avant de re-push, rebaser proprement sur master :
```bash
git fetch origin master
git reset --soft origin/master
git commit -m "message"
git push --force-with-lease -u origin claude/xxx
```
Cela crée un seul commit propre basé sur master, sans historique divergent.

## Documentation
- **Avant toute modification structurelle**, consulte ARCHITECTURE.md et mets-le à jour après

## Auto-correction
Quand l'utilisateur me corrige, ce fichier est mis à jour pour ne plus refaire la même erreur.

### Leçons apprises
- Ne jamais oublier de bumper la version, même pour un fix mineur
- Toujours aligner les versions dans les 3 fichiers (app.js, sw.js, index.html)
- Vérifier les données factuelles dans data.js — ne pas assumer qu'elles sont correctes (ex: Sales = 121 317 lignes, pas 60K)
- Ne pas créer de missions qui répètent mot pour mot ce que la section theory/deep explique déjà — les missions doivent ajouter un défi pratique
- Les accents français sont obligatoires partout (corrigé, résultat, sélectionne, réponse, etc.)
- Réduire les blocs colorés : le contenu principal doit être en texte brut, pas dans des box
- **TOUJOURS rebaser sur master avant chaque push** — après un squash-merge, la branche locale diverge. Faire systématiquement `git fetch origin master && git reset --soft origin/master && git commit && git push --force-with-lease` pour garantir un commit propre basé sur le dernier master

## Version actuelle
v5.1.3
