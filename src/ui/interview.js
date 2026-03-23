import { S, save } from '../core/state.js';
import { h, render } from '../core/render.js';
import { icon } from '../core/icons.js';
import { addXP } from '../features/gamification.js';

const INTERVIEW = window.INTERVIEW;
const EXAM_STRATEGY = window.EXAM_STRATEGY;

export function renderInterview() {
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
        h('div', { className: 'interview-label' }, 'R\u00e9ponse id\u00e9ale'),
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

export function renderExamStrategy() {
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
