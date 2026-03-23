import { S } from '../core/state.js';
import { h, render } from '../core/render.js';
import { icon } from '../core/icons.js';

export function renderSearch(query) {
  const wrap = h('div', null);
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) {
    wrap.appendChild(h('div', { style: { color: 'var(--tx3)', textAlign: 'center', padding: '40px' } }, 'Tape au moins 2 caract\u00e8res pour chercher.'));
    return wrap;
  }

  const results = [];

  window.CHAPTERS.forEach(ch => {
    ch.sections.forEach(sec => {
      const fields = [sec.theory, sec.code, sec.business, sec.tip, sec.deep].filter(Boolean).join(' ');
      if (fields.toLowerCase().includes(q)) {
        results.push({ type: 'section', label: `${sec.id} ${sec.title}`, detail: sec.theory, ch: ch.id, action: () => { S.chapterIdx = ch.id - 1; S.tab = 'formation'; S.searchOpen = false; render(); } });
      }
    });
  });

  window.QUIZ.forEach((quiz, i) => {
    if (quiz.q.toLowerCase().includes(q) || quiz.w.toLowerCase().includes(q)) {
      results.push({ type: 'quiz', label: quiz.q.slice(0, 80), detail: `Ch.${quiz.ch} \u2014 ${window.DOMAINS[quiz.d]?.name || ''}`, ch: quiz.ch, action: null });
    }
  });

  window.FLASHCARDS.forEach((fc, i) => {
    if (fc.f.toLowerCase().includes(q) || fc.b.toLowerCase().includes(q)) {
      results.push({ type: 'flash', label: fc.f, detail: fc.b, ch: fc.ch, action: () => { S.tab = 'flash'; S.fcFilter = 'all'; S.fcIdx = i; S.fcFlipped = false; S.searchOpen = false; render(); } });
    }
  });

  window.GLOSSARY.forEach(g => {
    if (g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q)) {
      results.push({ type: 'glossaire', label: g.term, detail: g.def, ch: g.ch, action: () => { S.tab = 'ref'; S.refTab = 'glossary'; S.searchOpen = false; render(); } });
    }
  });

  window.MEASURES.forEach(m => {
    if (m.n.toLowerCase().includes(q) || m.f.toLowerCase().includes(q)) {
      results.push({ type: 'mesure', label: m.n, detail: m.f, ch: m.ch, action: () => { S.tab = 'ref'; S.refTab = 'measures'; S.searchOpen = false; render(); } });
    }
  });

  window.MISSIONS.forEach(m => {
    if (m.text.toLowerCase().includes(q) || (m.solution && m.solution.toLowerCase().includes(q))) {
      results.push({ type: 'mission', label: `#${m.id} \u2014 ${m.text.slice(0, 60)}`, detail: m.solution?.slice(0, 80), ch: m.ch, action: () => { S.tab = 'formation'; S.chapterIdx = m.ch - 1; S.searchOpen = false; render(); } });
    }
  });

  wrap.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx3)', marginBottom: '14px' } }, `${results.length} r\u00e9sultat${results.length > 1 ? 's' : ''} pour "${query}"`));

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
    wrap.appendChild(h('div', { style: { color: 'var(--tx3)', textAlign: 'center', padding: '40px' } }, 'Aucun r\u00e9sultat.'));
  }

  return wrap;
}
