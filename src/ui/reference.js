import { S } from '../core/state.js';
import { h, render } from '../core/render.js';
import { highlightCode } from '../data/highlight.js';

const MEASURES = window.MEASURES;
const PATTERNS = window.PATTERNS;
const TI_CHEATSHEET = window.TI_CHEATSHEET;
const GLOSSARY = window.GLOSSARY;

export function renderReference() {
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
      h('span', { className: 'box-label' }, 'Pr\u00e9requis'),
      'Table de dates continue + marqu\u00e9e + relation active. Si contexte = Mars 2022 :'
    ));
    const table = h('table', { className: 'mini-table' },
      h('thead', null, h('tr', null, h('th', null, 'Fonction'), h('th', null, 'Action'), h('th', null, 'R\u00e9sultat'))),
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
