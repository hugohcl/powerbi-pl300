import { S } from '../core/state.js';
import { h, render } from '../core/render.js';
import { icon } from '../core/icons.js';
import { isChapterUnlocked } from '../features/gamification.js';
import { renderChapterDetail } from '../features/missions.js';
import { getProgress } from './home.js';

export function setFormationDeps(deps) {}

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
    s.appendChild(svg('text', { x: '325', y: '130', 'text-anchor': 'middle', fill: 'var(--tx2)', 'font-size': '11', 'font-family': 'var(--font)', 'font-style': 'italic' }, 'M\u00eame colonne = REMPLACE / Autre colonne = AJOUTE'));
    const wrap = h('div', { className: 'box', style: { borderColor: 'var(--purple)', borderLeftWidth: '3px', padding: '14px' } },
      h('span', { className: 'box-label' }, 'Flux CALCULATE')
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
  var wrap = h('div', null);

  // ── Next action bar (single CTA) ──
  var prog = getProgress();
  var totalPct = Math.round(prog.totalMissions / prog.totalMissionsMax * 100);
  var nextBar = h('div', { className: 'formation-next-bar' });
  var leftSide = h('div', { style: { flex: '1', minWidth: '0' } });
  leftSide.appendChild(h('div', { className: 'formation-next-step' }, prog.nextStep));
  leftSide.appendChild(h('div', { style: { marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' } },
    h('div', { className: 'progress-bar', style: { flex: '1' } },
      h('div', { className: 'progress-fill', style: { width: totalPct + '%' } })
    ),
    h('span', { style: { fontSize: '12px', color: 'var(--tx3)', whiteSpace: 'nowrap' } },
      prog.totalMissions + '/' + prog.totalMissionsMax + ' \u00B7 ' + totalPct + '%')
  ));
  nextBar.appendChild(leftSide);
  if (prog.nextAction) {
    var btn = h('button', { className: 'formation-cta-btn', onClick: prog.nextAction }, 'Continuer');
    nextBar.appendChild(btn);
  }
  wrap.appendChild(nextBar);

  // ── Chapter list ──
  var nav = h('div', { className: 'ch-nav' });
  CHAPTERS.forEach(function(ch, idx) {
    var from = ch.missions[0], to = ch.missions[1];
    var total = to - from + 1;
    var completed = 0;
    for (var i = from; i <= to; i++) { if (S.missions[i]) completed++; }
    var pct = Math.round(completed / total * 100);
    var unlocked = isChapterUnlocked(ch.id);
    nav.appendChild(h('div', {
      className: 'ch-item' + (completed === total ? ' completed' : '') + (!unlocked ? ' ch-locked' : ''),
      onClick: function() { if (unlocked) { S.chapterIdx = idx; render(); } }
    },
      h('div', { className: 'ch-num' }, String(ch.id)),
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
      h('div', { className: 'ch-progress' }, completed + '/' + total)
    ));
  });
  wrap.appendChild(nav);
  return wrap;
}
