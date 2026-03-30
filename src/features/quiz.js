import { S, save } from '../core/state.js';
import { h, render, shuf, qHash, trackQuizAnswer } from '../core/render.js';
import { icon } from '../core/icons.js';
import { addXP, getLevel } from './gamification.js';

// Late-bound dependencies (set by app.js)
let _renderExercises = null;
let _renderExamStrategy = null;
let _makeSidebarSvg = null;

export function setQuizDeps(deps) {
  if (deps.renderExercises) _renderExercises = deps.renderExercises;
  if (deps.renderExamStrategy) _renderExamStrategy = deps.renderExamStrategy;
  if (deps.makeSidebarSvg) _makeSidebarSvg = deps.makeSidebarSvg;
}

export function startQuiz(filter, mode) {
  S.quizMode = mode || 'training';
  S.quizFilter = filter;
  let qs;
  if (filter === 'all') qs = [...window.QUIZ];
  else if (filter.startsWith('ch')) qs = window.QUIZ.filter(q => q.ch === parseInt(filter.slice(2)));
  else qs = window.QUIZ.filter(q => q.d === filter);

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
    // Quiz adaptatif: prioritize weak questions
    var weakQs = qs.filter(function(q) { var st = S.quizStats[qHash(q)]; return st && st.wrong > st.right; });
    var otherQs = qs.filter(function(q) { var st = S.quizStats[qHash(q)]; return !st || st.wrong <= st.right; });
    // Put weak questions first, then shuffle the rest
    qs = shuf(weakQs).concat(shuf(otherQs));
    S.examActive = false;
    S._quizRetryPool = []; // Pool of wrong questions to re-ask
  }

  S.quizQuestions = qs;
  S.qi = 0; S.sel = null; S.shown = false; S.score = 0; S.total = 0;
  S.quizHistory = []; S.multiSel = []; S.orderSel = []; S._quizIsReview = false;
  render();
}

export function finishExam() {
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
  if (typeof window.XP_REWARDS !== 'undefined') addXP(window.XP_REWARDS.exam_complete, 'Examen blanc');
  save();
  S.qi = -1; // signal to show results
  render();
}

export function renderCaseStudy() {
  const wrap = h('div', null);
  const hasCases = typeof window.CASES !== 'undefined' && Array.isArray(window.CASES) && window.CASES.length > 0;

  if (!hasCases) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--tx3)' } },
      'Les \u00e9tudes de cas seront bient\u00f4t disponibles.'
    ));
    wrap.appendChild(h('button', { onClick: () => { S.caseMode = false; render(); }, style: { marginTop: '12px' } }, '\u2190 Retour'));
    return wrap;
  }

  // Case list
  if (S.caseIdx === null) {
    wrap.appendChild(h('button', { onClick: () => { S.caseMode = false; render(); }, style: { marginBottom: '16px', fontSize: '13px' } }, '\u2190 Retour au quiz'));
    wrap.appendChild(h('h3', { style: { fontSize: '16px', marginBottom: '16px' } }, '\u00c9tudes de cas'));
    window.CASES.forEach((c, i) => {
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
  const cs = window.CASES[S.caseIdx];
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
        trackQuizAnswer();
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
    }, isLast ? 'Voir le r\u00e9sultat' : 'Suivante \u2192'));
  }

  // Quit
  wrap.appendChild(h('button', {
    onClick: () => { S.caseIdx = null; render(); },
    style: { marginTop: '12px', fontSize: '12px', color: 'var(--tx3)', background: 'none', border: 'none' }
  }, 'Quitter le cas'));

  return wrap;
}

export function renderQuiz() {
  const wrap = h('div', null);

  // Exercise mode
  if (S.exMode) return _renderExercises();
  // Case study mode
  if (S.caseMode) return renderCaseStudy();

  // If no quiz started, show menu
  if (S.quizQuestions.length === 0) {
    // Page header
    wrap.appendChild(h('div', { className: 'page-header' },
      h('div', { className: 'page-label' }, 'Certification'),
      h('h1', { className: 'page-title' }, 'Quiz PL-300')
    ));

    // Domain pills
    var pillsDiv = h('div', { className: 'pills' });
    var domainFilters = [
      { key: 'all', label: 'Tous les domaines' },
      { key: 'PQ', label: 'Pr\u00e9parer les donn\u00e9es' },
      { key: 'MO', label: 'Mod\u00e9liser les donn\u00e9es' },
      { key: 'VA', label: 'Visualiser et analyser' },
      { key: 'DE', label: 'D\u00e9ployer et maintenir' }
    ];
    domainFilters.forEach(function(df) {
      pillsDiv.appendChild(h('button', {
        className: 'pill' + (df.key === 'all' ? ' active' : ''),
        onClick: function() { startQuiz(df.key, 'training'); }
      }, df.label));
    });
    wrap.appendChild(pillsDiv);

    // Quiz mode cards (Apple bento style)
    wrap.appendChild(h('div', { className: 'section-label-apple' }, 'Modes d\'entra\u00eenement'));
    var quizBento = h('div', { className: 'quiz-bento' });

    var quizModes = [
      { title: 'Toutes les questions', sub: 'Entra\u00eenement libre sur l\'ensemble du programme', bg: 'var(--accent-bg)', color: 'var(--accent)', count: window.QUIZ.length, action: function() { startQuiz('all', 'training'); } },
      { title: '\u00c9tudes de cas', sub: 'Sc\u00e9narios m\u00e9tier avec contexte complet', bg: '#af52de10', color: 'var(--purple)', action: function() { S.caseMode = true; S.caseIdx = null; render(); } },
      { title: 'Exercices DAX', sub: '\u00c9criture de mesures et formules DAX', bg: '#34c75910', color: 'var(--green)', action: function() { S.exMode = true; S.exIdx = 0; S.exInput = ''; S.exChecked = false; S.exCorrect = false; S.exHintLevel = 0; S.exShowSolution = false; render(); } },
      { title: 'Par chapitre', sub: 'Chapitres 1 \u00e0 7 du parcours', bg: '#ff9f0a10', color: 'var(--orange)', action: function() { /* show chapter pills */ } }
    ];

    quizModes.forEach(function(qm) {
      var card = h('div', { className: 'quiz-card-apple', onClick: qm.action });
      if (qm.count) {
        card.appendChild(h('div', { className: 'quiz-card-count' }, String(qm.count)));
      }
      var iconEl = h('div', { className: 'quiz-card-icon', style: { background: qm.bg } });
      var svgI = _makeSidebarSvg('<path d="M3 5.5h12M3 9h12M3 12.5h8"/>');
      svgI.setAttribute('stroke', qm.color);
      iconEl.appendChild(svgI);
      card.appendChild(iconEl);
      card.appendChild(h('div', { className: 'quiz-card-title' }, qm.title));
      card.appendChild(h('div', { className: 'quiz-card-sub' }, qm.sub));
      quizBento.appendChild(card);
    });
    wrap.appendChild(quizBento);

    // Exam strategy (collapsible)
    wrap.appendChild(_renderExamStrategy());

    // Chapter pills (for "Par chapitre")
    var chPills = h('div', { className: 'pills', style: { marginBottom: '24px' } });
    window.CHAPTERS.forEach(function(ch) {
      chPills.appendChild(h('button', {
        className: 'pill',
        onClick: function() { startQuiz('ch' + ch.id, 'training'); }
      }, 'Ch.' + ch.id));
    });
    wrap.appendChild(chPills);

    // Review wrong answers
    var wrongQs = window.QUIZ.filter(function(q) { var st = S.quizStats[qHash(q)]; return st && st.wrong > st.right; });
    if (wrongQs.length > 0) {
      wrap.appendChild(h('button', {
        onClick: function() { S.quizQuestions = shuf(wrongQs); S.qi = 0; S.sel = null; S.shown = false; S.score = 0; S.total = 0; S.quizMode = 'training'; render(); },
        style: { marginBottom: '24px', background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red)', padding: '10px 24px', fontWeight: '500' }
      }, 'R\u00e9viser les erreurs (' + wrongQs.length + ' questions)'));
    }

    // Exam card (Apple style)
    wrap.appendChild(h('div', { className: 'section-label-apple' }, 'Examen blanc'));
    var examCard = h('div', { className: 'exam-card-apple' });
    var examIconWrap = h('div', { className: 'exam-icon-wrap' });
    var examSvg = _makeSidebarSvg('<path d="M3 3h12v14H3z"/><path d="M7 7h4M7 10h2"/>');
    examSvg.setAttribute('stroke', '#ffffff');
    examIconWrap.appendChild(examSvg);
    examCard.appendChild(examIconWrap);
    examCard.appendChild(h('div', { className: 'exam-info' },
      h('div', { className: 'exam-title-apple' }, 'Simulation PL-300'),
      h('div', { className: 'exam-meta' },
        h('span', { className: 'exam-meta-item' }, '100 minutes'),
        h('span', { className: 'exam-meta-item' }, '50 questions'),
        h('span', { className: 'exam-meta-item' }, 'Score /1000'),
        h('span', { className: 'exam-meta-item' }, 'Seuil : 700')
      )
    ));
    var examBtn = h('button', { className: 'exam-btn-apple', onClick: function() { startQuiz('all', 'exam'); } });
    examBtn.appendChild(icon('zap', 14));
    examBtn.appendChild(document.createTextNode('Lancer l\'examen'));
    examCard.appendChild(examBtn);
    wrap.appendChild(examCard);

    // Exam history (Apple style)
    wrap.appendChild(h('div', { className: 'section-label-apple', style: { marginTop: '36px' } }, 'R\u00e9sultats r\u00e9cents'));
    if (S.examHistory.length === 0) {
      wrap.appendChild(h('div', { className: 'empty-state' },
        h('div', { className: 'empty-circle' }, icon('target', 24)),
        h('div', { className: 'empty-title' }, 'Aucun r\u00e9sultat pour le moment'),
        h('div', { className: 'empty-sub' }, 'Entra\u00eene-toi avec les quiz puis lance un examen blanc')
      ));
    } else {
      var resultsGrid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '36px' } });
      S.examHistory.slice().reverse().slice(0, 6).forEach(function(ex) {
        var passed = ex.score >= 700;
        resultsGrid.appendChild(h('div', { style: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '0.5px solid var(--bd)', padding: '20px', textAlign: 'center' } },
          h('div', { style: { fontSize: '36px', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: '1', marginBottom: '2px', color: passed ? 'var(--green)' : 'var(--red)' } }, ex.score + '/1000'),
          h('div', { style: { fontSize: '12px', color: 'var(--tx3)', fontWeight: '500' } }, ex.right + '/' + ex.total + ' bonnes'),
          h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginTop: '8px', fontWeight: '400' } }, ex.date),
          h('span', { style: { display: 'inline-block', fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '8px', marginTop: '8px', background: passed ? '#34c75912' : '#ff3b3012', color: passed ? 'var(--green)' : 'var(--red)' } }, passed ? 'R\u00e9ussi' : '\u00c9chou\u00e9')
        ));
      });
      wrap.appendChild(resultsGrid);
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
        passed ? 'F\u00e9licitations \u2014 tu as le niveau PL-300 !' : `Score insuffisant (seuil : 700). Continue de t'entra\u00eener.`
      ),
      h('div', { style: { fontSize: '14px', marginBottom: '16px', color: 'var(--tx2)' } }, `${ex.right}/${ex.total} bonnes r\u00e9ponses`)
    ));

    // By domain
    wrap.appendChild(h('h3', { style: { fontSize: '14px', marginTop: '20px', marginBottom: '12px' } }, 'Score par domaine'));
    Object.entries(ex.byDomain).forEach(([d, stats]) => {
      const pct = Math.round(stats.right / stats.total * 100);
      const dom = window.DOMAINS[d];
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
            var prefix = isCorrect ? '\u2713 ' : (isUserPick ? '\u2717 ' : '');
            reviewCard.appendChild(h('div', { style: optStyle }, prefix + String.fromCharCode(65 + oi) + '. ' + opt));
          });
        }
        if (q.w) {
          reviewCard.appendChild(h('div', { className: 'quiz-explain', style: { marginTop: '10px' } }, q.w));
        }
        if (q.ch && window.CHAPTERS[q.ch - 1]) {
          reviewCard.appendChild(h('button', {
            onClick: function() { S.tab = 'formation'; S.chapterIdx = q.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
            style: { marginTop: '8px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', cursor: 'pointer', textDecoration: 'underline' }
          }, 'Revoir Ch.' + q.ch + ' \u2014 ' + window.CHAPTERS[q.ch - 1].title));
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
        var dom = window.DOMAINS[d];
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
        var domLabel = window.DOMAINS[q.d] ? h('span', { className: 'badge', style: { background: window.DOMAINS[q.d].color + '15', color: window.DOMAINS[q.d].color, marginLeft: '8px', fontSize: '11px' } }, window.DOMAINS[q.d].name) : null;
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
            var prefix = optCorrect ? '\u2713 ' : (optPicked ? '\u2717 ' : '');
            frc.appendChild(h('div', { style: optStyle }, prefix + String.fromCharCode(65 + oi) + '. ' + opt));
          });
        }
        if (!qCorrect && q.w) {
          frc.appendChild(h('div', { className: 'quiz-explain', style: { marginTop: '10px' } }, q.w));
        }
        if (!qCorrect && q.ch && window.CHAPTERS[q.ch - 1]) {
          frc.appendChild(h('button', {
            onClick: function() { S.tab = 'formation'; S.chapterIdx = q.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
            style: { marginTop: '8px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', cursor: 'pointer', textDecoration: 'underline' }
          }, 'Revoir Ch.' + q.ch + ' \u2014 ' + window.CHAPTERS[q.ch - 1].title));
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
    if (S.quizFilter && S.quizFilter !== 'all' && !S.quizFilter.startsWith('ch') && window.DOMAINS[S.quizFilter]) {
      var domName = window.DOMAINS[S.quizFilter].name;
      var domTips = {
        PQ: 'R\u00e9vise les types de donn\u00e9es et les transformations Power Query.',
        MO: 'R\u00e9vise les relations, les hi\u00e9rarchies et les sch\u00e9mas en \u00e9toile.',
        VA: 'R\u00e9vise les visuels, les filtres et la mise en forme conditionnelle.',
        DE: 'R\u00e9vise les espaces de travail, la s\u00e9curit\u00e9 RLS et le partage.'
      };
      domFeedback = h('div', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '14px', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius)' } },
        h('strong', null, domName + ' : ' + pctInt + '%'),
        ' \u2014 ',
        pctInt >= 85 ? 'Excellent ! Ce domaine est bien ma\u00eetris\u00e9.' : pctInt >= 70 ? 'Bien ! ' + (domTips[S.quizFilter] || '') : (domTips[S.quizFilter] || 'Continue de t\'entra\u00eener sur ce domaine.')
      );
    }

    wrap.appendChild(h('div', { className: 'quiz-result', style: { background: pct >= .7 ? 'var(--green-bg)' : 'var(--red-bg)' } },
      h('div', { className: 'score', style: { color: pct >= .7 ? 'var(--green)' : 'var(--red)' } }, `${S.score}/${S.total}`),
      h('div', { style: { fontSize: '14px', color: pct >= .7 ? 'var(--green)' : 'var(--red)', marginBottom: '14px' } },
        pct >= .85 ? 'Excellent !' : pct >= .7 ? (S._quizIsReview ? 'Bien !' : 'Bien. R\u00e9vise les erreurs.') : (S._quizIsReview ? 'Continue de t\'entra\u00eener.' : 'Continue de t\'entra\u00eener.')
      ),
      domFeedback,
      h('button', { onClick: () => { S.quizQuestions = []; render(); } }, 'Retour'),
      S.quizHistory.length > 0 && !S._quizIsReview ? h('button', {
        onClick: () => { S.quizQuestions = shuf(S.quizHistory); S.qi = 0; S.sel = null; S.shown = false; S.score = 0; S.total = 0; S.quizHistory = []; S._quizIsReview = true; render(); },
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
        var _domInfo = window.PL300_INFO.domains.find(function(x) { return x.id === _weakestDom; });
        if (_domInfo && _domInfo.chapters.length > 0) _targetCh = _domInfo.chapters[0];
      }
      if (_targetCh && window.CHAPTERS[_targetCh - 1]) {
        wrap.appendChild(h('button', {
          onClick: function() { S.tab = 'formation'; S.chapterIdx = _targetCh - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
          style: { marginTop: '16px', width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }
        }, 'Retourner au chapitre : Ch.' + _targetCh + ' \u2014 ' + window.CHAPTERS[_targetCh - 1].title));
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
  const dom = window.DOMAINS[cq.d];
  wrap.appendChild(h('div', { className: 'quiz-meta' },
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      dom ? h('span', { className: 'badge', style: { background: dom.color + '15', color: dom.color } }, dom.name) : null,
      h('span', { style: { fontSize: '11px', color: 'var(--tx3)' } }, `Ch.${cq.ch}`)
    ),
    !S.examActive ? h('span', { style: { fontSize: '13px', color: 'var(--tx2)' } }, `${S.qi + 1}/${S.quizQuestions.length} \u00B7 ${S.score}/${S.total}`) : null
  ));

  // Quiz progress bar
  var quizPct = Math.round((S.qi + 1) / S.quizQuestions.length * 100);
  wrap.appendChild(h('div', { style: { height: '3px', background: 'var(--bg3)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' } },
    h('div', { style: { height: '100%', width: quizPct + '%', background: 'var(--accent)', borderRadius: '2px', transition: 'width .3s ease' } })
  ));

  // Question
  const qType = cq.type || 'single';
  wrap.appendChild(h('p', { className: 'quiz-q' }, cq.q));

  if (qType === 'multi' && !S.shown) {
    wrap.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--accent)', marginBottom: '10px', fontWeight: '500' } },
      `S\u00e9lectionnez ${cq.a.length} r\u00e9ponses`
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
        h('span', { style: { marginRight: '10px', fontSize: '14px' } }, selected ? '\u2611' : '\u2610'),
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
          trackQuizAnswer();
          if (typeof window.XP_REWARDS !== 'undefined') {
            addXP(correct ? window.XP_REWARDS.quiz_correct : window.XP_REWARDS.quiz_wrong, 'Quiz');
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
        h('span', { style: { marginRight: '10px', fontWeight: '600', color: assigned ? 'var(--accent)' : 'var(--tx3)', minWidth: '20px', display: 'inline-block' } }, assigned ? `${pos + 1}` : '\u00b7'),
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
          trackQuizAnswer();
          if (typeof window.XP_REWARDS !== 'undefined') {
            addXP(correct ? window.XP_REWARDS.quiz_correct : window.XP_REWARDS.quiz_wrong, 'Quiz');
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
          if (typeof window.XP_REWARDS !== 'undefined') {
            addXP(correct ? window.XP_REWARDS.quiz_correct : window.XP_REWARDS.quiz_wrong, 'Quiz');
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
    if (_isWrong && cq.ch && window.CHAPTERS[cq.ch - 1]) {
      wrap.appendChild(h('button', {
        onClick: function() { S.tab = 'formation'; S.chapterIdx = cq.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
        style: { marginTop: '8px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', cursor: 'pointer', textDecoration: 'underline' }
      }, 'Revoir Ch.' + cq.ch + ' \u2014 ' + window.CHAPTERS[cq.ch - 1].title));
    }
  }

  // Next
  if (S.shown) {
    const isLast = S.qi >= S.quizQuestions.length - 1;
    wrap.appendChild(h('button', {
      className: 'quiz-next',
      onClick: () => {
        // Adaptive: queue wrong answers for re-ask (training only)
        if (!S.examActive && S._quizRetryPool) {
          var cqCurrent = S.quizQuestions[S.qi];
          var wasWrong = false;
          if (cqCurrent) {
            var qt2 = cqCurrent.type || 'single';
            if (qt2 === 'single') wasWrong = S.sel !== cqCurrent.a;
            else if (qt2 === 'multi') wasWrong = !(Array.isArray(S.multiSel) && Array.isArray(cqCurrent.a) && cqCurrent.a.length === S.multiSel.length && cqCurrent.a.every(function(a) { return S.multiSel.includes(a); }));
          }
          if (wasWrong && !cqCurrent._isRetry) {
            // Re-insert this question 3 positions later
            var retryQ = Object.assign({}, cqCurrent, { _isRetry: true });
            var insertAt = Math.min(S.qi + 4, S.quizQuestions.length);
            S.quizQuestions.splice(insertAt, 0, retryQ);
          }
        }
        if (isLast && !(S._quizRetryPool && S.qi < S.quizQuestions.length - 1)) {
          if (S.examActive) { finishExam(); return; }
          S.qi++;
        } else {
          S.qi++; S.sel = null; S.shown = false; S.multiSel = []; S.orderSel = [];
        }
        render();
      }
    }, isLast ? (S.examActive ? 'Terminer l\'examen' : 'Voir le r\u00e9sultat') : 'Suivante \u2192'));
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
