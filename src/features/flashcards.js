import { S, save } from '../core/state.js';
import { h, render, shuf } from '../core/render.js';
import { addXP, generateFCQuizOptions } from './gamification.js';

export function sm2Default() {
  return { ef: 2.5, interval: 1, repetitions: 0, nextReview: 0 };
}

export function sm2Get(idx) {
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

export function sm2Update(idx, quality) {
  // quality: 1=a revoir, 3=difficile, 5=facile
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
  if (!wasMastered && d.repetitions >= 3 && d.interval >= 7 && typeof window.XP_REWARDS !== 'undefined') {
    addXP(window.XP_REWARDS.flashcard_mastered, 'Flashcard');
  }
  save();
}

export function sm2DaysUntilReview(idx) {
  const d = sm2Get(idx);
  const diff = d.nextReview - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}

export function sm2IsDue(idx) {
  const d = sm2Get(idx);
  return d.nextReview <= Date.now();
}

export function sm2IsMastered(idx) {
  const d = sm2Get(idx);
  return d.repetitions >= 3 && d.interval >= 7;
}

export function getDueCards() {
  return window.FLASHCARDS.map((_, i) => i).filter(i => sm2IsDue(i));
}

// ─── Helpers for reverse mode ───
function fcQ(card) { return S.fcReverse ? card.b : card.f; }
function fcA(card) { return S.fcReverse ? card.f : card.b; }

export function renderFlashcards() {
  const wrap = h('div', null);
  const cats = [...new Set(window.FLASHCARDS.map(f => f.c))];
  const knownCount = window.FLASHCARDS.filter((_, i) => sm2IsMastered(i)).length;
  const dueCount = getDueCards().length;

  // ── Header stats bar ──
  var statsBar = h('div', { className: 'fc-stats-bar' },
    h('div', { className: 'fc-stat' },
      h('span', { className: 'fc-stat-num', style: { color: 'var(--green)' } }, String(knownCount)),
      h('span', { className: 'fc-stat-label' }, 'ma\u00eetris\u00e9es')
    ),
    h('div', { className: 'fc-stat' },
      h('span', { className: 'fc-stat-num', style: { color: 'var(--accent)' } }, String(dueCount)),
      h('span', { className: 'fc-stat-label' }, '\u00e0 r\u00e9viser')
    ),
    h('div', { className: 'fc-stat' },
      h('span', { className: 'fc-stat-num', style: { color: 'var(--tx2)' } }, String(window.FLASHCARDS.length)),
      h('span', { className: 'fc-stat-label' }, 'total')
    ),
    // Session stats (if any cards answered this session)
    S.fcSessionCorrect + S.fcSessionWrong > 0 ? h('div', { className: 'fc-stat fc-stat-session' },
      h('span', { className: 'fc-stat-num' },
        h('span', { style: { color: 'var(--green)' } }, String(S.fcSessionCorrect)),
        ' / ',
        h('span', { style: { color: 'var(--red)' } }, String(S.fcSessionWrong))
      ),
      h('span', { className: 'fc-stat-label' }, 'session')
    ) : null
  );
  wrap.appendChild(statsBar);

  // ── Filters with counts ──
  var allCount = window.FLASHCARDS.length;
  var reviewCount = window.FLASHCARDS.filter((_, i) => !sm2IsMastered(i)).length;
  wrap.appendChild(h('div', { className: 'pills' },
    h('button', { className: 'pill' + (S.fcFilter === 'all' ? ' active' : ''), onClick: () => { S.fcFilter = 'all'; S.fcIdx = 0; S.fcFlipped = false; render(); } }, `Toutes (${allCount})`),
    h('button', { className: 'pill' + (S.fcFilter === 'due' ? ' active' : ''), onClick: () => { S.fcFilter = 'due'; S.fcIdx = 0; S.fcFlipped = false; render(); },
      style: { borderColor: 'var(--accent)', color: 'var(--accent)' }
    }, `R\u00e9vision du jour (${dueCount})`),
    h('button', { className: 'pill' + (S.fcFilter === 'review' ? ' active' : ''), onClick: () => { S.fcFilter = 'review'; S.fcIdx = 0; S.fcFlipped = false; render(); },
      style: { borderColor: 'var(--red)', color: 'var(--red)' }
    }, `Non ma\u00eetris\u00e9es (${reviewCount})`),
    ...cats.map(c => {
      var catCount = window.FLASHCARDS.filter(f => f.c === c).length;
      return h('button', { className: 'pill' + (S.fcFilter === c ? ' active' : ''), onClick: () => { S.fcFilter = c; S.fcIdx = 0; S.fcFlipped = false; render(); } }, `${c} (${catCount})`);
    })
  ));

  // Filter cards (use shuffled order if available)
  let fc;
  const base = S.fcShuffled || window.FLASHCARDS;
  if (S.fcFilter === 'all') fc = base;
  else if (S.fcFilter === 'due') fc = base.filter((c) => { const gi = window.FLASHCARDS.indexOf(c); return sm2IsDue(gi); });
  else if (S.fcFilter === 'review') fc = base.filter((c) => { const gi = window.FLASHCARDS.indexOf(c); return !sm2IsMastered(gi); });
  else fc = base.filter(f => f.c === S.fcFilter);

  if (fc.length === 0) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--tx3)' } },
      S.fcFilter === 'due' ? 'Aucune carte \u00e0 r\u00e9viser aujourd\'hui !' : S.fcFilter === 'review' ? 'Toutes les cartes sont ma\u00eetris\u00e9es !' : 'Aucune carte dans cette cat\u00e9gorie.'
    ));
    return wrap;
  }

  if (S.fcIdx >= fc.length) S.fcIdx = 0;
  const card = fc[S.fcIdx];
  const globalIdx = window.FLASHCARDS.indexOf(card);
  const sm2Data = sm2Get(globalIdx);
  const daysUntil = sm2DaysUntilReview(globalIdx);

  // Progress bar + card info
  var progressPct = Math.round((S.fcIdx + 1) / fc.length * 100);
  const sm2Label = sm2IsMastered(globalIdx) ? 'Ma\u00eetris\u00e9e' : sm2Data.repetitions === 0 ? 'Nouvelle' : `R\u00e9p. ${sm2Data.repetitions}`;
  const reviewLabel = daysUntil === 0 ? '\u00c0 r\u00e9viser' : `R\u00e9vision dans ${daysUntil}j`;
  wrap.appendChild(h('div', { style: { marginBottom: '12px' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--tx3)', marginBottom: '6px' } },
      h('span', null, `${S.fcIdx + 1} / ${fc.length}`),
      h('span', null, `Ch.${card.ch} \u00b7 ${card.c} \u00b7 ${sm2Label} \u00b7 ${reviewLabel}`)
    ),
    h('div', { className: 'progress-bar', style: { height: '3px' } },
      h('div', { className: 'progress-fill', style: { width: progressPct + '%', transition: 'width 0.3s' } })
    )
  ));

  // ── Mode toggle row (Classic/QCM + Reverse) ──
  wrap.appendChild(h('div', { style: { display: 'flex', gap: '8px', marginBottom: '14px', justifyContent: 'space-between', flexWrap: 'wrap' } },
    h('div', { style: { display: 'flex', gap: '6px' } },
      h('button', {
        onClick: function() { S.fcQuizMode = false; S.fcQuizSel = null; S.fcQuizShown = false; render(); },
        style: { fontSize: '11px', padding: '3px 10px', background: !S.fcQuizMode ? 'var(--accent)' : 'var(--bg)', color: !S.fcQuizMode ? 'white' : 'var(--tx3)', border: '1px solid ' + (!S.fcQuizMode ? 'var(--accent)' : 'var(--bd)'), borderRadius: '10px' }
      }, 'Classique'),
      h('button', {
        onClick: function() { S.fcQuizMode = true; S.fcQuizSel = null; S.fcQuizShown = false; var qd = generateFCQuizOptions(globalIdx, S.fcReverse); S.fcQuizOptions = qd.options; S._fcQuizCorrect = qd.correct; render(); },
        style: { fontSize: '11px', padding: '3px 10px', background: S.fcQuizMode ? 'var(--accent)' : 'var(--bg)', color: S.fcQuizMode ? 'white' : 'var(--tx3)', border: '1px solid ' + (S.fcQuizMode ? 'var(--accent)' : 'var(--bd)'), borderRadius: '10px' }
      }, 'QCM')
    ),
    h('button', {
      onClick: function() {
        S.fcReverse = !S.fcReverse;
        S.fcQuizSel = null; S.fcQuizShown = false; S.fcQuizOptions = [];
        if (S.fcQuizMode) {
          var qd = generateFCQuizOptions(globalIdx, S.fcReverse);
          S.fcQuizOptions = qd.options; S._fcQuizCorrect = qd.correct;
        }
        render();
      },
      style: { fontSize: '11px', padding: '3px 10px', background: S.fcReverse ? 'var(--purple-bg, rgba(123,31,162,0.1))' : 'var(--bg)', color: S.fcReverse ? 'var(--purple, #7B1FA2)' : 'var(--tx3)', border: '1px solid ' + (S.fcReverse ? 'var(--purple, #7B1FA2)' : 'var(--bd)'), borderRadius: '10px' }
    }, S.fcReverse ? '\u21c4 R\u00e9ponse en haut' : '\u21c4 Question en haut')
  ));

  if (S.fcQuizMode) {
    // QCM mode: show question side (respecting reverse), 4 options for answer side
    var questionText = fcQ(card);
    var questionLabel = S.fcReverse ? 'D\u00e9finition' : 'Question';
    wrap.appendChild(h('div', { className: 'flashcard', style: { minHeight: '120px', cursor: 'default' } },
      h('div', { style: { textAlign: 'center', maxWidth: '500px' } },
        h('span', { className: 'fc-cat-badge' }, card.c),
        h('div', { className: 'flashcard-label' }, questionLabel),
        h('div', { className: 'flashcard-text' }, questionText)
      )
    ));
    // Generate options if not yet
    if (!S.fcQuizOptions || S.fcQuizOptions.length === 0) {
      var qd = generateFCQuizOptions(globalIdx, S.fcReverse);
      S.fcQuizOptions = qd.options;
      S._fcQuizCorrect = qd.correct;
    }
    var qOpts = h('div', { className: 'quiz-options', style: { marginTop: '12px' } });
    S.fcQuizOptions.forEach(function(opt, i) {
      var cls = 'quiz-opt';
      if (S.fcQuizShown && i === S._fcQuizCorrect) cls += ' correct';
      else if (S.fcQuizShown && i === S.fcQuizSel && i !== S._fcQuizCorrect) cls += ' wrong';
      qOpts.appendChild(h('button', {
        className: cls,
        onClick: function() {
          if (S.fcQuizShown) return;
          S.fcQuizSel = i;
          S.fcQuizShown = true;
          var quality = i === S._fcQuizCorrect ? 5 : 1;
          if (quality === 5) S.fcSessionCorrect++;
          else S.fcSessionWrong++;
          sm2Update(globalIdx, quality);
          render();
        }
      }, h('span', { className: 'letter' }, String.fromCharCode(65 + i)), opt));
    });
    wrap.appendChild(qOpts);
    if (S.fcQuizShown) {
      // Show full explanation after answering
      var explanation = fcA(card);
      var fullAnswer = S.fcReverse ? card.f + ' \u2192 ' + card.b : card.b;
      if (S.fcQuizSel !== S._fcQuizCorrect) {
        wrap.appendChild(h('div', { className: 'fc-explanation' },
          h('span', { style: { fontWeight: '600', color: 'var(--green)' } }, 'R\u00e9ponse : '),
          fullAnswer
        ));
      }
      wrap.appendChild(h('button', { className: 'quiz-next', onClick: function() {
        S.fcQuizSel = null; S.fcQuizShown = false; S.fcQuizOptions = [];
        S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1);
        var nextGlobalIdx = window.FLASHCARDS.indexOf(fc[S.fcIdx]);
        if (nextGlobalIdx >= 0) {
          var nd = generateFCQuizOptions(nextGlobalIdx, S.fcReverse);
          S.fcQuizOptions = nd.options; S._fcQuizCorrect = nd.correct;
        }
        render();
      }}, 'Suivante \u2192'));
    }
  } else {
    // Classic mode
    var questionSide = fcQ(card);
    var answerSide = fcA(card);
    const cardEl = h('div', {
      className: 'flashcard' + (S.fcFlipped ? ' flashcard-back flipping' : ''),
      style: { background: S.fcFlipped ? 'var(--bg2)' : 'var(--bg)' },
      onClick: () => { S.fcFlipped = !S.fcFlipped; render(); }
    },
      h('div', { style: { textAlign: 'center', maxWidth: '500px' } },
        h('span', { className: 'fc-cat-badge' }, card.c),
        h('div', { className: 'flashcard-label' }, S.fcFlipped ? 'R\u00e9ponse' : 'Question'),
        h('div', { className: 'flashcard-text' }, S.fcFlipped ? answerSide : questionSide)
      )
    );
    wrap.appendChild(cardEl);

    // Actions (SM-2 quality buttons)
    if (S.fcFlipped) {
      wrap.appendChild(h('div', { className: 'flash-actions' },
        h('button', { className: 'review', onClick: () => {
          S.fcSessionWrong++;
          sm2Update(globalIdx, 1);
          S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render();
        }}, '\u00c0 revoir'),
        h('button', { onClick: () => {
          S.fcSessionCorrect++;
          sm2Update(globalIdx, 3);
          S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render();
        }, style: { borderColor: '#F0AD4E', color: '#F0AD4E' } }, 'Difficile'),
        h('button', { className: 'know', onClick: () => {
          S.fcSessionCorrect++;
          sm2Update(globalIdx, 5);
          S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render();
        }}, 'Facile')
      ));
    }
  }

  // Keyboard hints (desktop) + swipe hint (mobile)
  wrap.appendChild(h('div', { style: { textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--tx3)' } },
    h('span', { className: 'kbd' }, 'Espace'), ' retourner  ',
    h('span', { className: 'kbd' }, '\u2190'), h('span', { className: 'kbd' }, '\u2192'), ' naviguer  ',
    h('span', { className: 'kbd' }, '1'), ' \u00e0 revoir  ',
    h('span', { className: 'kbd' }, '2'), ' difficile  ',
    h('span', { className: 'kbd' }, '3'), ' facile'
  ));
  wrap.appendChild(h('div', { className: 'swipe-hint' }, 'Tap pour retourner \u00b7 Swipe \u2190 \u2192 pour naviguer'));

  // Restart + Shuffle + Reset session
  wrap.appendChild(h('div', { style: { textAlign: 'center', marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } },
    h('button', { onClick: () => { S.fcIdx = 0; S.fcFlipped = false; render(); }, style: { fontSize: '12px' } }, 'Recommencer'),
    h('button', { onClick: () => { S.fcShuffled = shuf(window.FLASHCARDS); S.fcIdx = 0; S.fcFlipped = false; render(); }, style: { fontSize: '12px' } }, 'M\u00e9langer'),
    S.fcSessionCorrect + S.fcSessionWrong > 0 ? h('button', { onClick: () => { S.fcSessionCorrect = 0; S.fcSessionWrong = 0; S.fcIdx = 0; S.fcFlipped = false; render(); }, style: { fontSize: '12px', color: 'var(--tx3)' } }, 'Reset session') : null
  ));

  return wrap;
}
