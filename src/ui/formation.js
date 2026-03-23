import { S, save } from '../core/state.js';
import { h, render, getTotalMissions } from '../core/render.js';
import { icon } from '../core/icons.js';
import { isChapterUnlocked, getChapterPrereqs, getWeeklyChallenge, getWeeklyChallengeProgress, startDailyMix, addXP } from '../features/gamification.js';
import { renderChapterDetail } from '../features/missions.js';
import { renderRoadmap } from './home.js';
import { makeSidebarSvg } from './sidebar.js';

let _getDueCards = null;
export function setFormationDeps(deps) {
  if (deps.getDueCards) _getDueCards = deps.getDueCards;
}

const CHAPTERS = window.CHAPTERS;
const DOMAINS = window.DOMAINS;

export function renderDiagram(type) {
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
      { label: 'Expression \u00e9valu\u00e9e', sub: 'r\u00e9sultat', x: 490, color: 'var(--accent)' }
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

export function renderFormation() {
  if (S.chapterIdx === null) return renderChapterList();
  return renderChapterDetail(CHAPTERS[S.chapterIdx]);
}

export function renderChapterList() {
  var getDueCards = _getDueCards || function() { return []; };
  const wrap = h('div', null);

  // ── Daily Mix CTA (primary action) ──
  var todayXP = 0;
  var todayStr = new Date().toISOString().slice(0, 10);
  var todayEntry = S.xpHistory.find(function(e) { return e.date === todayStr; });
  if (todayEntry) todayXP = todayEntry.xp;
  var goalPct = Math.min(100, Math.round(todayXP / S.dailyGoal * 100));

  var dailyMixCard = h('div', { className: 'daily-mix-cta' },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      h('div', null,
        h('div', { style: { fontSize: '16px', fontWeight: '700', marginBottom: '4px' } }, 'Session du jour'),
        h('div', { style: { fontSize: '13px', color: 'var(--tx2)' } },
          getDueCards().length + ' flashcards + quiz cibles + mission \u2014 10 min')
      ),
      h('button', {
        onClick: startDailyMix,
        style: { padding: '12px 24px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', whiteSpace: 'nowrap' }
      }, 'Commencer')
    ),
    h('div', { style: { marginTop: '10px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--tx3)', marginBottom: '4px' } },
        h('span', null, 'Objectif du jour'),
        h('span', null, todayXP + '/' + S.dailyGoal + ' XP')
      ),
      h('div', { className: 'progress-bar' },
        h('div', { className: 'progress-fill' + (goalPct >= 100 ? ' green' : ''), style: { width: goalPct + '%' } })
      )
    )
  );
  wrap.appendChild(dailyMixCard);

  // ── Weekly Challenge ──
  var challenge = getWeeklyChallenge();
  if (challenge) {
    var cProgress = getWeeklyChallengeProgress(challenge);
    var cPct = Math.min(100, Math.round(cProgress / challenge.target * 100));
    var cDone = cPct >= 100;
    wrap.appendChild(h('div', { className: 'weekly-challenge-card' + (cDone ? ' completed' : '') },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' } },
        icon(challenge.icon, 18),
        h('div', null,
          h('div', { style: { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', color: cDone ? 'var(--green)' : 'var(--accent)' } }, 'Defi de la semaine'),
          h('div', { style: { fontSize: '14px', fontWeight: '500' } }, challenge.title)
        ),
        cDone ? h('span', { style: { marginLeft: 'auto', fontSize: '12px', fontWeight: '600', color: 'var(--green)' } }, 'Complete !') : null
      ),
      h('div', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '8px' } }, challenge.desc),
      h('div', { className: 'progress-bar' },
        h('div', { className: 'progress-fill' + (cDone ? ' green' : ''), style: { width: cPct + '%' } })
      ),
      h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginTop: '4px', textAlign: 'right' } },
        cProgress + '/' + challenge.target + (cDone ? ' \u2014 +' + challenge.xpBonus + ' XP bonus' : ''))
    ));
    // Auto-award weekly challenge XP
    if (cDone && !challenge.completed) {
      challenge.completed = true;
      S.weeklyChallenge = challenge;
      addXP(challenge.xpBonus, 'Defi semaine');
      save();
    }
  }

  // Roadmap
  wrap.appendChild(renderRoadmap());

  // ── Skill Tree (non-linear) ──
  var prereqs = getChapterPrereqs();
  var skillTreeWrap = h('div', { className: 'skill-tree' });
  skillTreeWrap.appendChild(h('div', { style: { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx3)', marginBottom: '12px' } }, 'Arbre de competences'));

  // Render chapters as a non-linear tree
  var rows = [
    [1],       // Row 1: Introduction
    [2, 3, 7], // Row 2: Power Query, Modelling, Service (parallel)
    [4],       // Row 3: DAX (needs 3)
    [5],       // Row 4: Time Intelligence (needs 4)
    [6]        // Row 5: Advanced (needs 4, 5)
  ];

  rows.forEach(function(rowChIds) {
    var row = h('div', { className: 'skill-tree-row' });
    rowChIds.forEach(function(chId) {
      var ch = CHAPTERS[chId - 1];
      var done = 0, total = ch.missions[1] - ch.missions[0] + 1;
      for (var i = ch.missions[0]; i <= ch.missions[1]; i++) { if (S.missions[i]) done++; }
      var pct = Math.round(done / total * 100);
      var unlocked = isChapterUnlocked(chId);
      var nodeClass = 'skill-node' + (pct === 100 ? ' done' : unlocked ? ' unlocked' : ' locked');

      var node = h('div', {
        className: nodeClass,
        onClick: function() { if (unlocked) { S.chapterIdx = chId - 1; render(); } }
      },
        h('div', { className: 'skill-node-num' }, String(chId)),
        h('div', { className: 'skill-node-title' }, ch.title),
        h('div', { className: 'skill-node-bar' },
          h('div', { className: 'skill-node-fill' + (pct === 100 ? ' green' : ''), style: { width: pct + '%' } })
        ),
        !unlocked ? h('div', { className: 'skill-node-lock' }, icon('lock', 12)) : null
      );
      row.appendChild(node);
    });
    skillTreeWrap.appendChild(row);
  });
  wrap.appendChild(skillTreeWrap);

  // ── Chapter list (classic) ──
  const done = Object.values(S.missions).filter(Boolean).length;
  const totalMissionsMax = CHAPTERS.reduce(function(s, c) { return s + (c.missions[1] - c.missions[0] + 1); }, 0);

  const nav = h('div', { className: 'ch-nav' });
  CHAPTERS.forEach((ch, idx) => {
    const [from, to] = ch.missions;
    const total = to - from + 1;
    const completed = Array.from({ length: total }, (_, i) => S.missions[from + i]).filter(Boolean).length;
    const pct = Math.round(completed / total * 100);
    var unlocked = isChapterUnlocked(ch.id);

    nav.appendChild(h('div', {
      className: 'ch-item' + (completed === total ? ' completed' : '') + (!unlocked ? ' ch-locked' : ''),
      onClick: function() { if (unlocked) { S.chapterIdx = idx; render(); } }
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
      !unlocked ? icon('lock', 14) : null,
      h('div', { className: 'ch-progress' }, `${completed}/${total}`)
    ));
  });
  wrap.appendChild(nav);
  return wrap;
}
