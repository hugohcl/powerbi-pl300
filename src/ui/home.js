import { S } from '../core/state.js';
import { h, render, qHash, getTotalMissions, APP_VERSION, formatStudyTime } from '../core/render.js';
import { icon } from '../core/icons.js';
import { getLevel, startDailyMix, getChapterPrereqs, isChapterUnlocked } from '../features/gamification.js';
import { makeSidebarSvg } from './sidebar.js';

let _sm2Get = null;
let _sm2IsMastered = null;
let _getDueCards = null;
export function setHomeDeps(deps) {
  if (deps.sm2Get) _sm2Get = deps.sm2Get;
  if (deps.sm2IsMastered) _sm2IsMastered = deps.sm2IsMastered;
  if (deps.getDueCards) _getDueCards = deps.getDueCards;
}

const CHAPTERS = window.CHAPTERS;
const FLASHCARDS = window.FLASHCARDS;
const QUIZ = window.QUIZ;
const DOMAINS = window.DOMAINS;
const LEVELS = window.LEVELS;

export function getProgress() {
  var sm2Get = _sm2Get || function() { return { interval: 0 }; };
  var chProgress = CHAPTERS.map(function(ch) {
    var total = ch.missions[1] - ch.missions[0] + 1;
    var done = 0;
    for (var i = ch.missions[0]; i <= ch.missions[1]; i++) {
      if (S.missions[i]) done++;
    }
    return { ch: ch.id, done: done, total: total, pct: Math.round(done / total * 100) };
  });
  var totalMissions = chProgress.reduce(function(a, c) { return a + c.done; }, 0);
  var totalMissionsMax = CHAPTERS.reduce(function(s, c) { return s + (c.missions[1] - c.missions[0] + 1); }, 0);
  var fcMastered = FLASHCARDS.filter(function(_, i) {
    var d = sm2Get(i);
    return d.interval >= 7;
  }).length;
  var quizPct = 0;
  var quizTotal = 0;
  Object.keys(DOMAINS).forEach(function(d) {
    var qs = QUIZ.filter(function(q) { return q.d === d; });
    var right = 0, total = 0;
    qs.forEach(function(q) {
      var st = S.quizStats[qHash(q)];
      if (st) { right += st.right; total += st.right + st.wrong; }
    });
    if (total > 0) { quizPct += right / total; quizTotal++; }
  });
  var avgQuizPct = quizTotal > 0 ? Math.round(quizPct / quizTotal * 100) : 0;
  var bestExam = S.examHistory.length > 0 ? Math.max.apply(null, S.examHistory.map(function(e) { return e.score || 0; })) : 0;
  var phase = 1;
  var nextStep = '';
  var nextAction = null;
  if (totalMissions < totalMissionsMax * 0.8) {
    phase = 1;
    var incompleteCh = chProgress.find(function(c) { return c.pct < 70; });
    if (incompleteCh) {
      var chData = CHAPTERS[incompleteCh.ch - 1];
      nextStep = 'Continue le Ch.' + incompleteCh.ch + ' \u2014 ' + chData.title + ' (' + incompleteCh.done + '/' + incompleteCh.total + ' missions)';
      nextAction = function() { S.chapterIdx = incompleteCh.ch - 1; render(); };
    } else {
      nextStep = 'Tous les chapitres avanc\u00e9s ! Termine les missions restantes.';
    }
  } else if (fcMastered < FLASHCARDS.length * 0.5) {
    phase = 2;
    nextStep = 'R\u00e9vise les flashcards (' + fcMastered + '/' + FLASHCARDS.length + ' ma\u00eetris\u00e9es)';
    nextAction = function() { S.tab = 'flash'; render(); };
  } else if (bestExam < 700) {
    phase = 3;
    nextStep = avgQuizPct < 80
      ? 'Entra\u00eene-toi aux quiz par domaine (moyenne : ' + avgQuizPct + '%, objectif : 80%)'
      : 'Lance un examen blanc (meilleur score : ' + bestExam + '/1000, objectif : 700)';
    nextAction = function() { S.tab = 'quiz'; render(); };
  } else {
    phase = 4;
    nextStep = 'Tu es pr\u00eat ! Inscris-toi \u00e0 l\'examen PL-300.';
  }
  return { chProgress: chProgress, totalMissions: totalMissions, totalMissionsMax: totalMissionsMax, fcMastered: fcMastered, avgQuizPct: avgQuizPct, bestExam: bestExam, phase: phase, nextStep: nextStep, nextAction: nextAction };
}

export function renderRoadmap() {
  var prog = getProgress();
  var phases = [
    { num: 1, label: 'Apprendre', sub: 'Ch.1-7' },
    { num: 2, label: 'Ancrer', sub: 'Flashcards' },
    { num: 3, label: 'Tester', sub: 'Quiz PL-300' },
    { num: 4, label: 'Certifier', sub: 'Examen' }
  ];
  var phasesRow = h('div', { className: 'roadmap-phases' });
  phases.forEach(function(p) {
    var dotClass = 'phase-dot';
    if (p.num < prog.phase) dotClass += ' done';
    else if (p.num === prog.phase) dotClass += ' active';
    else dotClass += ' pending';
    phasesRow.appendChild(h('div', { className: 'roadmap-phase' },
      h('div', { className: dotClass }, String(p.num)),
      h('div', { className: 'phase-label' }, p.label),
      h('div', { className: 'phase-sublabel' }, p.sub)
    ));
  });
  var nextBox = h('div', { className: 'roadmap-next' });
  var nextLabel = h('div', { className: 'roadmap-next-text' }, 'Prochaine \u00e9tape : ' + prog.nextStep);
  nextBox.appendChild(nextLabel);
  if (prog.nextAction) {
    var goBtn = h('button', {
      onClick: prog.nextAction,
      style: { marginTop: '8px', fontSize: '12px', padding: '4px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)' }
    }, 'Continuer');
    nextBox.appendChild(goBtn);
  }
  var progressPct = Math.round(prog.totalMissions / prog.totalMissionsMax * 100);
  var progressInfo = h('div', { style: { marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--tx3)' } },
    h('span', null, prog.totalMissions + '/' + prog.totalMissionsMax + ' missions (' + progressPct + '%)'),
    h('span', null, prog.fcMastered + '/' + FLASHCARDS.length + ' flashcards')
  );
  var progressBar = h('div', { className: 'progress-bar', style: { marginTop: '6px' } },
    h('div', { className: 'progress-fill', style: { width: progressPct + '%' } })
  );
  var wrap = h('div', { className: 'roadmap' },
    h('div', { style: { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx3)', marginBottom: '14px' } }, 'Parcours d\'apprentissage'),
    phasesRow,
    nextBox,
    progressInfo,
    progressBar
  );
  return wrap;
}

export function renderHome() {
  var getDueCards = _getDueCards || function() { return []; };
  var sm2IsMastered = _sm2IsMastered || function() { return false; };
  var wrap = h('div', null);

  // Page header
  var hour = new Date().getHours();
  var greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apr\u00e8s-midi' : 'Bonsoir';
  var userName = S.userName || 'Hugo';
  wrap.appendChild(h('div', { className: 'page-header' },
    h('div', { className: 'page-label' }, greeting + ' ' + userName),
    h('h1', { className: 'page-title' }, 'Tableau de bord')
  ));

  // Bento grid
  var bento = h('div', { className: 'bento' });

  // Hero card — Session du jour
  var dueCards = getDueCards().length;
  var todayXP = 0;
  var todayStr = new Date().toISOString().slice(0, 10);
  var todayEntry = S.xpHistory.find(function(e) { return e.date === todayStr; });
  if (todayEntry) todayXP = todayEntry.xp;
  var goalPct = Math.min(100, Math.round(todayXP / S.dailyGoal * 100));
  var missionsDone = Object.entries(S.missions).filter(function(e) { return e[1] && !isNaN(e[0]) && Number(e[0]) > 0 && Number(e[0]) <= getTotalMissions(); }).length;
  var nextMission = getTotalMissions() - missionsDone;

  var hero = h('div', { className: 'bento-card bento-hero', onClick: startDailyMix });
  hero.innerHTML = '';
  var heroTop = h('div', null,
    h('div', { className: 'hero-label' }, 'Session du jour'),
    h('div', { className: 'hero-title' }, 'Reprends o\u00f9 tu en \u00e9tais'),
    h('div', { className: 'hero-sub' }, dueCards + ' flashcards \u00B7 quiz cibl\u00e9s \u00B7 ' + (nextMission > 0 ? '1 mission' : '0 mission') + ' \u2014 environ 10 min')
  );
  hero.appendChild(heroTop);
  var heroBottom = h('div', { className: 'hero-bottom' });
  var heroBtn = h('button', { className: 'hero-btn', onClick: function(e) { e.stopPropagation(); startDailyMix(); } }, 'Commencer');
  heroBottom.appendChild(heroBtn);
  var progressWrap = h('div', { className: 'hero-progress-wrap' },
    h('div', { className: 'hero-bar' },
      h('div', { className: 'hero-bar-fill', style: { width: goalPct + '%' } })
    ),
    h('span', { className: 'hero-xp-label' }, todayXP + '/' + S.dailyGoal + ' XP')
  );
  heroBottom.appendChild(progressWrap);
  hero.appendChild(heroBottom);
  bento.appendChild(hero);

  // Streak card
  var streak = h('div', { className: 'bento-card bento-streak' },
    h('div', { className: 'streak-flame' }, '\uD83D\uDD25'),
    h('div', { className: 'streak-number' }, String(S.streak || 0)),
    h('div', { className: 'streak-label' }, (S.streak || 0) <= 1 ? 'jour de streak' : 'jours de streak')
  );
  bento.appendChild(streak);

  // 4 stat cards
  var totalMissions = getTotalMissions();
  var knownCards = (typeof FLASHCARDS !== 'undefined' ? FLASHCARDS : []).filter(function(_, i) { return sm2IsMastered(i); }).length;
  var totalFlash = (typeof FLASHCARDS !== 'undefined' ? FLASHCARDS : []).length;
  var totalQuizAnswered = Object.values(S.quizStats).reduce(function(sum, s) { return sum + s.right + s.wrong; }, 0);
  var totalQuizRight = Object.values(S.quizStats).reduce(function(sum, s) { return sum + s.right; }, 0);
  var quizPct = totalQuizAnswered > 0 ? Math.round(totalQuizRight / totalQuizAnswered * 100) : 0;
  var stats = [
    { bg: 'var(--accent-bg)', iconPath: '<rect x="2" y="3" width="14" height="12" rx="2"/><path d="M6 7h6M6 10h4"/>', value: missionsDone, suffix: '/' + totalMissions, label: 'Missions termin\u00e9es', color: 'var(--accent)' },
    { bg: '#34c75912', iconPath: '<rect x="2" y="3" width="14" height="12" rx="2"/><path d="M6 8l2 2 4-4"/>', value: knownCards, suffix: '/' + totalFlash, label: 'Flashcards ma\u00eetris\u00e9es', color: 'var(--green)' },
    { bg: '#af52de12', iconPath: '<circle cx="9" cy="9" r="7"/><path d="M9 6v3l2 1"/>', value: quizPct, suffix: '%', label: 'Taux de r\u00e9ussite quiz', color: 'var(--purple)' },
    { bg: '#ff9f0a12', iconPath: '<circle cx="9" cy="9" r="7"/><path d="M9 5v4h3"/>', value: formatStudyTime(S.studyTime), suffix: '', label: 'Temps d\'étude total', color: 'var(--orange)' }
  ];

  stats.forEach(function(st) {
    var statCard = h('div', { className: 'bento-card bento-stat' });
    var iconWrap = h('div', { className: 'stat-icon', style: { background: st.bg } });
    var svgEl = makeSidebarSvg(st.iconPath);
    svgEl.setAttribute('stroke', st.color);
    iconWrap.appendChild(svgEl);
    statCard.appendChild(iconWrap);
    statCard.appendChild(h('div', { className: 'stat-value' },
      String(st.value),
      h('span', { style: { fontSize: '16px', color: 'var(--tx3)' } }, st.suffix)
    ));
    statCard.appendChild(h('div', { className: 'stat-label' }, st.label));
    bento.appendChild(statCard);
  });

  wrap.appendChild(bento);

  // Parcours section
  var sectionHeader = h('div', { className: 'section-header' },
    h('h2', { className: 'section-title' }, 'Parcours'),
    h('a', { className: 'section-link', href: '#', onClick: function(e) { e.preventDefault(); S.tab = 'formation'; S.chapterIdx = null; render(); } }, 'Voir tout \u2192')
  );
  wrap.appendChild(sectionHeader);

  var chaptersGrid = h('div', { className: 'chapters-grid' });
  var prereqs = getChapterPrereqs();
  CHAPTERS.forEach(function(ch, i) {
    var isLocked = !isChapterUnlocked(ch.id);
    var done = Object.entries(S.missions).filter(function(e) { return e[1] && Number(e[0]) >= ch.missions[0] && Number(e[0]) <= ch.missions[1]; }).length;
    var total = ch.missions[1] - ch.missions[0] + 1;
    var pct = Math.round(done / total * 100);

    var card = h('div', { className: 'chapter-card stagger-item' + (isLocked ? ' locked' : ''), style: { animationDelay: (i * 50) + 'ms' } });
    if (!isLocked) {
      card.addEventListener('click', function() { S.tab = 'formation'; S.chapterIdx = i; render(); });
    }

    // Icon
    var chIcon = h('div', { className: 'ch-icon-apple ' + (isLocked ? 'locked-icon' : 'active-icon') });
    if (isLocked) {
      chIcon.textContent = String(i + 1);
    } else {
      var chIcons = ['book', 'inbox', 'target', 'crosshair', 'zap', 'timer', 'shield'];
      chIcon.appendChild(icon(chIcons[i] || 'book', 20));
    }
    card.appendChild(chIcon);

    // Info
    card.appendChild(h('div', { className: 'ch-info' },
      h('div', { className: 'ch-name' }, 'Ch.' + (i + 1) + ' \u2014 ' + ch.title),
      h('div', { className: 'ch-sub' }, done + '/' + total + ' missions')
    ));

    // Progress ring or lock
    if (isLocked) {
      var lockDiv = h('div', { className: 'lock-icon' });
      lockDiv.appendChild(icon('lock', 16));
      card.appendChild(lockDiv);
    } else {
      var ring = h('div', { className: 'ch-ring' });
      var circumference = 2 * Math.PI * 16;
      var offset = circumference * (1 - pct / 100);
      ring.innerHTML = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="#e5e5ea" stroke-width="3"/><circle cx="20" cy="20" r="16" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 20 20)"/></svg>';
      var ringLabel = h('span', { className: 'ch-ring-label' }, pct + '%');
      ring.appendChild(ringLabel);
      card.appendChild(ring);
    }

    chaptersGrid.appendChild(card);
  });
  wrap.appendChild(chaptersGrid);

  return wrap;
}
