// ═══════════════════════════════════════════════════════════
// APP.JS — Entry point (ES Module)
// ═══════════════════════════════════════════════════════════

// Core
import { S, save, load, setSyncCallback, getSaveData, applyData, SUPABASE_URL, SUPABASE_ANON_KEY } from './src/core/state.js';
import { APP_VERSION, h, $, render, setRenderFn, shuf, qHash, trackQuizAnswer, getTotalMissions, isMobile, initTheme, toggleTheme, formatStudyTime } from './src/core/render.js';
import { icon, iconSearch, iconTimer, iconSun, iconMoon } from './src/core/icons.js';
import { highlightCode } from './src/data/highlight.js';

// Features
import { setGamificationDeps, composeDailyMix, startDailyMix, renderDailyMix, getWeeklyChallenge, getWeeklyChallengeProgress, getGhostProfiles, getNarrativeMessages, showCelebration, getChapterPrereqs, isChapterUnlocked, generateFCQuizOptions, getLevel, addXP, updateStreak, checkBadges, showNotification, showOnboarding } from './src/features/gamification.js';
import { syncPush, syncPull, syncGenerate, syncConnect, syncDisconnect, showSyncModal, initSync, getSyncCode } from './src/features/sync.js';
import { sm2Default, sm2Get, sm2Update, sm2DaysUntilReview, sm2IsDue, sm2IsMastered, getDueCards, renderFlashcards } from './src/features/flashcards.js';
import { startQuiz, finishExam, renderCaseStudy, renderQuiz, setQuizDeps } from './src/features/quiz.js';
import { renderChapterDetail, renderMission, renderInteractiveMission, setMissionDeps } from './src/features/missions.js';
import { getGuidedSteps, getFilteredExercises, checkExercise, renderExercises, verifyExercise, showExHint } from './src/features/exercises.js';
import { startPomodoro, pomodoroNext, updatePomodoroDisplay, stopPomodoro, pausePomodoro, resetPomodoro } from './src/features/pomodoro.js';
import { renderChatFab, renderChatPanel, sendChatMessage } from './src/features/chat.js';
import { renderSearch } from './src/features/search.js';

// UI
import { renderSidebar, renderHeader, renderTabs, makeSidebarSvg, setSidebarDeps } from './src/ui/sidebar.js';
import { getProgress, renderRoadmap, renderHome, setHomeDeps } from './src/ui/home.js';
import { renderDiagram, renderFormation, renderChapterList, setFormationDeps } from './src/ui/formation.js';
import { getDomainStats, getRecommendations, getPredictiveStats, renderProgress, setProgressDeps } from './src/ui/progress.js';
import { renderReference } from './src/ui/reference.js';
import { renderInterview, renderExamStrategy } from './src/ui/interview.js';

// ─── Wire up late-bound dependencies ───
setGamificationDeps({
  getDueCards: getDueCards,
  sm2Update: sm2Update,
  sm2IsMastered: sm2IsMastered,
  sm2IsDue: sm2IsDue,
  sm2Get: sm2Get,
  getProgress: getProgress
});

setQuizDeps({
  renderExercises: renderExercises,
  renderExamStrategy: renderExamStrategy,
  makeSidebarSvg: makeSidebarSvg
});

setMissionDeps({
  renderDiagram: renderDiagram
});

setSidebarDeps({
  getDueCards: getDueCards
});

setHomeDeps({
  sm2Get: sm2Get,
  sm2IsMastered: sm2IsMastered,
  getDueCards: getDueCards
});

setFormationDeps({
  getDueCards: getDueCards
});

setProgressDeps({
  sm2IsMastered: sm2IsMastered,
  getDueCards: getDueCards,
  makeSidebarSvg: makeSidebarSvg
});

// ─── Main render function ───
function mainRender() {
  var appEl = document.getElementById('app');
  appEl.innerHTML = '';

  // Sidebar: persistent — rebuild only when pomodoro state changes, otherwise patch active classes
  var existingSidebar = document.querySelector('.sidebar');
  var _sbPomKey = (S.pomodoro.active ? '1' : '0') + (S.pomodoro.dropdownOpen ? '1' : '0') + (S.soundEnabled ? 's1' : 's0');
  if (!existingSidebar || existingSidebar.dataset.pomKey !== _sbPomKey) {
    if (existingSidebar) existingSidebar.remove();
    var newSidebar = renderSidebar();
    newSidebar.dataset.pomKey = _sbPomKey;
    document.body.insertBefore(newSidebar, appEl);
  } else {
    existingSidebar.querySelectorAll('[data-tab]').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === S.tab);
      btn.setAttribute('aria-current', btn.dataset.tab === S.tab ? 'page' : null);
    });
  }

  // Search overlay
  if (S.searchOpen) {
    var searchBox = h('div', { style: { marginBottom: '16px', padding: '16px', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bd)' } },
      h('input', {
        id: 'search-input',
        type: 'text',
        placeholder: 'Rechercher dans toute l\'app (DAX, RANKX, mesure...)...',
        value: S.searchQuery || '',
        style: { width: '100%', padding: '10px 14px', fontSize: '15px', border: '0.5px solid var(--bd)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--tx)', fontFamily: 'var(--font)', outline: 'none' },
        onInput: function(e) { S.searchQuery = e.target.value; clearTimeout(window._searchDebounce); window._searchDebounce = setTimeout(function() { render(); setTimeout(function() { var inp = document.getElementById('search-input'); if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = inp.value.length; } }, 10); }, 200); },
        onKeydown: function(e) { if (e.key === 'Escape') { S.searchOpen = false; render(); } }
      }),
      h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginTop: '6px' } }, '\u00C9chap pour fermer \u00B7 Cherche dans sections, quiz, flashcards, mesures, glossaire, missions')
    );
    appEl.appendChild(searchBox);
    if (S.searchQuery && S.searchQuery.length >= 2) {
      appEl.appendChild(renderSearch(S.searchQuery));
    }
    return;
  }

  // Daily Mix mode
  if (S.dailyMixActive) {
    appEl.appendChild(renderDailyMix());
    return;
  }

  // Add directional animation
  var tabOrder = ['home', 'formation', 'quiz', 'flash', 'interview', 'ref', 'progress'];
  var prevIdx = tabOrder.indexOf(S._prevTab || 'home');
  var curIdx = tabOrder.indexOf(S.tab);
  // Animate only on tab/chapter changes — within-tab interactions are instant (no flash)
  var animClass = '';
  if (S._prevTab !== S.tab) {
    animClass = curIdx > prevIdx ? 'slide-forward' : 'slide-back';
  } else if (S.tab === 'formation' && S.chapterIdx !== null && S._prevChapterIdx === null) {
    animClass = 'slide-forward';
  } else if (S.tab === 'formation' && S.chapterIdx === null && S._prevChapterIdx !== null) {
    animClass = 'slide-back';
  }
  S._prevTab = S.tab;
  S._prevChapterIdx = S.chapterIdx;
  var content = h('div', { className: animClass });
  if (S.tab === 'home') content.appendChild(renderHome());
  else if (S.tab === 'formation') content.appendChild(renderFormation());
  else if (S.tab === 'quiz') content.appendChild(renderQuiz());
  else if (S.tab === 'flash') content.appendChild(renderFlashcards());
  else if (S.tab === 'interview') content.appendChild(renderInterview());
  else if (S.tab === 'ref') content.appendChild(renderReference());
  else if (S.tab === 'progress') content.appendChild(renderProgress());
  appEl.appendChild(content);
  // Remove view-enter class after animation completes
  content.addEventListener('animationend', function() { content.classList.remove('view-enter'); }, { once: true });

  // Global progress bar: update in-place
  var totalMissions = getTotalMissions();
  var doneMissions = Object.values(S.missions).filter(Boolean).length;
  var masteredCards = window.FLASHCARDS.filter(function(_, i) { return sm2IsMastered(i); }).length;
  var globalPct = Math.round((doneMissions + masteredCards) / (totalMissions + window.FLASHCARDS.length) * 100);
  var existingProgress = document.querySelector('.global-progress');
  if (existingProgress) {
    var existingFill = existingProgress.querySelector('.global-progress-fill');
    if (existingFill) existingFill.style.width = globalPct + '%';
  } else if (globalPct > 0) {
    var gBar = h('div', { className: 'global-progress' },
      h('div', { className: 'global-progress-fill', style: { width: globalPct + '%' } })
    );
    document.body.appendChild(gBar);
  }

  // Mobile top bar: persistent — rebuild only when pomodoro state or theme changes
  var existingTopbar = document.querySelector('.mobile-topbar');
  var _curTheme = document.documentElement.getAttribute('data-theme') || 'light';
  var _tbKey = (S.pomodoro.active ? '1' : '0') + (S.pomodoro.dropdownOpen ? '1' : '0') + _curTheme + (S.soundEnabled ? 's1' : 's0');
  if (!existingTopbar || existingTopbar.dataset.stateKey !== _tbKey) {
    if (existingTopbar) existingTopbar.remove();
    var topbar = h('div', { className: 'mobile-topbar' });
    topbar.dataset.stateKey = _tbKey;
    var topLogo = h('img', { className: 'mobile-topbar-logo', src: 'icon.png', alt: 'DAX Academy', onClick: function() { S.tab = 'home'; S.chapterIdx = null; render(); } });
    topbar.appendChild(topLogo);
    var topActions = h('div', { className: 'mobile-topbar-actions' });

    if (!S.pomodoro.active) {
      var pomBtn = h('button', { onClick: function() { startPomodoro(); }, title: 'Focus', 'aria-label': 'D\u00e9marrer le mode focus' });
      pomBtn.appendChild(icon('timer', 22));
      topActions.appendChild(pomBtn);
    } else {
      var tPomM = Math.floor(S.pomodoro.timeLeft / 60);
      var tPomS = S.pomodoro.timeLeft % 60;
      var tPomLabel = tPomM + ':' + String(tPomS).padStart(2, '0');
      var tPomClass = S.pomodoro.mode === 'work' ? 'pomodoro-active-pill' : 'pomodoro-break-pill';
      var tPomBtn = h('button', {
        className: tPomClass,
        onClick: function() { S.pomodoro.dropdownOpen = !S.pomodoro.dropdownOpen; render(); }
      }, tPomLabel);
      topActions.appendChild(tPomBtn);
    }

    var searchBtn = h('button', { onClick: function() { S.searchOpen = true; render(); }, title: 'Rechercher', 'aria-label': 'Rechercher' });
    searchBtn.appendChild(icon('search', 22));
    topActions.appendChild(searchBtn);

    var soundBtnM = h('button', { onClick: function() { S.soundEnabled = !S.soundEnabled; save(); render(); }, title: S.soundEnabled ? 'Désactiver les sons' : 'Activer les sons', style: S.soundEnabled ? { color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: '8px' } : {} });
    soundBtnM.appendChild(icon(S.soundEnabled ? 'volume' : 'volume-x', 22));
    topActions.appendChild(soundBtnM);

    var musicBtn = h('button', { onClick: function() { window.location.href = 'music://music.apple.com/fr/station/ambiance-studieuse/ra.q-MMLEBw'; }, title: 'Musique' });
    musicBtn.appendChild(icon('music', 22));
    topActions.appendChild(musicBtn);

    var isDarkMobile = _curTheme === 'dark';
    var themeBtn = h('button', { onClick: function() { if (window._smoothToggleTheme) window._smoothToggleTheme(); else toggleTheme(); }, title: isDarkMobile ? 'Mode clair' : 'Mode sombre' });
    themeBtn.appendChild(isDarkMobile ? icon('sun', 22) : icon('moon', 22));
    topActions.appendChild(themeBtn);

    var syncBtnM = h('button', { onClick: function() { showSyncModal(); }, title: 'Sync', 'aria-label': 'Synchronisation cloud', style: getSyncCode() ? { color: 'var(--green)' } : {} });
    syncBtnM.appendChild(icon('cloud', 22));
    topActions.appendChild(syncBtnM);

    topbar.appendChild(topActions);
    document.body.appendChild(topbar);
  }

  // Mobile bottom tab bar with "Plus" menu for hidden tabs
  var mobileItems = [
    { id: 'home', label: 'Accueil', iconName: 'inbox' },
    { id: 'formation', label: 'Formation', iconName: 'book' },
    { id: 'quiz', label: 'Quiz', iconName: 'target' },
    { id: 'flash', label: 'Flash', iconName: 'zap' },
    { id: 'more', label: 'Plus', iconName: 'menu' }
  ];
  var moreTabIds = ['progress', 'interview', 'ref'];
  var isMoreActive = moreTabIds.indexOf(S.tab) !== -1;
  var existingMobileTabs = document.querySelector('.mobile-tabs');
  if (!existingMobileTabs) {
    var mobileTabs = h('div', { className: 'mobile-tabs', role: 'navigation', 'aria-label': 'Navigation mobile' });
    mobileItems.forEach(function(mi) {
      var isActive = mi.id === 'more' ? isMoreActive : S.tab === mi.id;
      var tab = h('button', {
        className: 'mobile-tab' + (isActive ? ' active' : ''),
        'aria-label': mi.label,
        'aria-current': isActive ? 'page' : null,
        role: 'tab',
        onClick: function() {
          if (mi.id === 'more') { S._moreMenuOpen = !S._moreMenuOpen; render(); return; }
          S._moreMenuOpen = false;
          S.tab = mi.id; if (mi.id === 'formation') S.chapterIdx = null; render();
        }
      }, icon(mi.iconName, 20), h('span', null, mi.label));
      mobileTabs.appendChild(tab);
    });
    document.body.appendChild(mobileTabs);
  } else {
    var tabBtns = existingMobileTabs.querySelectorAll('.mobile-tab');
    mobileItems.forEach(function(mi, i) {
      if (tabBtns[i]) {
        var isAct = mi.id === 'more' ? isMoreActive : S.tab === mi.id;
        tabBtns[i].classList.toggle('active', isAct);
        tabBtns[i].setAttribute('aria-current', isAct ? 'page' : null);
      }
    });
  }

  // "Plus" bottom sheet overlay
  var existingSheet = document.querySelector('.mobile-more-overlay');
  if (existingSheet) existingSheet.remove();
  var existingSheet2 = document.querySelector('.mobile-more-sheet');
  if (existingSheet2) existingSheet2.remove();
  if (S._moreMenuOpen) {
    var overlay = h('div', { className: 'mobile-more-overlay', onClick: function() { S._moreMenuOpen = false; render(); } });
    document.body.appendChild(overlay);
    var sheet = h('div', { className: 'mobile-more-sheet' });
    sheet.appendChild(h('div', { className: 'mobile-more-handle' }));
    var moreItems = [
      { id: 'progress', label: 'Progression', iconName: 'award' },
      { id: 'interview', label: 'Entretien', iconName: 'users' },
      { id: 'ref', label: 'Référence DAX', iconName: 'book-open' }
    ];
    moreItems.forEach(function(mi) {
      var item = h('button', {
        className: 'mobile-more-item' + (S.tab === mi.id ? ' active' : ''),
        onClick: function() { S._moreMenuOpen = false; S.tab = mi.id; render(); }
      }, icon(mi.iconName, 20), mi.label);
      sheet.appendChild(item);
    });
    document.body.appendChild(sheet);
  }
}

// Register the render function (overridden below with history tracking)
setRenderFn(mainRender);

// ─── Keyboard shortcuts ───
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !S.searchOpen)) {
    e.preventDefault();
    S.searchOpen = !S.searchOpen;
    S.searchQuery = '';
    render();
    if (S.searchOpen) setTimeout(function() { var inp = document.getElementById('search-input'); if (inp) inp.focus(); }, 50);
    return;
  }
  if (e.key === 'Escape' && S.searchOpen) { S.searchOpen = false; render(); return; }
  // Tab navigation with numbers 1-5
  if (!S.searchOpen && !S.examActive && e.key >= '1' && e.key <= '5' && S.tab !== 'quiz' && S.tab !== 'flash') {
    var tabIds = ['home', 'formation', 'quiz', 'flash', 'progress'];
    var tabIdx = parseInt(e.key) - 1;
    if (tabIdx < tabIds.length) { S.tab = tabIds[tabIdx]; if (tabIds[tabIdx] === 'formation') S.chapterIdx = null; render(); }
    return;
  }
  if (S.tab === 'quiz' && S.quizQuestions.length > 0 && S.qi >= 0 && S.qi < S.quizQuestions.length) {
    if (!S.shown && 'abcd'.includes(e.key.toLowerCase())) {
      var idx = e.key.toLowerCase().charCodeAt(0) - 97;
      var cq = S.quizQuestions[S.qi];
      if (idx < cq.o.length) { document.querySelectorAll('.quiz-opt')[idx]?.click(); }
      return;
    }
    if (S.shown && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight')) {
      e.preventDefault();
      document.querySelector('.quiz-next')?.click();
      return;
    }
  }
  if (S.tab === 'flash') {
    if (e.key === ' ') { e.preventDefault(); S.fcFlipped = !S.fcFlipped; render(); return; }
    if (e.key === 'ArrowRight' && S.fcFlipped) {
      var fc = S.fcFilter === 'all' ? window.FLASHCARDS : S.fcFilter === 'review' ? window.FLASHCARDS.filter(function(_, i) { return !sm2IsMastered(i); }) : S.fcFilter === 'due' ? window.FLASHCARDS.filter(function(_, i) { return sm2IsDue(i); }) : window.FLASHCARDS.filter(function(f) { return f.c === S.fcFilter; });
      S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render(); return;
    }
    if (e.key === 'ArrowLeft') { S.fcFlipped = false; S.fcIdx = Math.max(0, S.fcIdx - 1); render(); return; }
    if (S.fcFlipped && '123'.includes(e.key)) {
      var base2 = S.fcShuffled || window.FLASHCARDS;
      var fc2;
      if (S.fcFilter === 'all') fc2 = base2;
      else if (S.fcFilter === 'due') fc2 = base2.filter(function(c) { var gi = window.FLASHCARDS.indexOf(c); return sm2IsDue(gi); });
      else if (S.fcFilter === 'review') fc2 = base2.filter(function(c) { var gi = window.FLASHCARDS.indexOf(c); return !sm2IsMastered(gi); });
      else fc2 = base2.filter(function(f) { return f.c === S.fcFilter; });
      var globalIdx = window.FLASHCARDS.indexOf(fc2[S.fcIdx]);
      if (e.key === '1') sm2Update(globalIdx, 1);
      else if (e.key === '2') sm2Update(globalIdx, 3);
      else if (e.key === '3') sm2Update(globalIdx, 5);
      S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc2.length - 1); render();
      return;
    }
  }
});

// ─── Mobile swipe (flashcards) ───
(function() {
  var touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (S.tab !== 'flash') return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    var dt = Date.now() - touchStartTime;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || dt > 400) return;
    var base = S.fcShuffled || window.FLASHCARDS;
    var fc;
    if (S.fcFilter === 'all') fc = base;
    else if (S.fcFilter === 'due') fc = base.filter(function(c) { return sm2IsDue(window.FLASHCARDS.indexOf(c)); });
    else if (S.fcFilter === 'review') fc = base.filter(function(c) { return !sm2IsMastered(window.FLASHCARDS.indexOf(c)); });
    else fc = base.filter(function(f) { return f.c === S.fcFilter; });
    if (dx > 0) { S.fcFlipped = false; S.fcIdx = Math.max(0, S.fcIdx - 1); render(); }
    else { S.fcFlipped = false; S.fcIdx = Math.min(S.fcIdx + 1, fc.length - 1); render(); }
  }, { passive: true });
})();

// ─── Mobile swipe (tabs) ───
(function() {
  var tabOrder = ['home', 'formation', 'quiz', 'flash', 'progress'];
  var startX = 0, startY = 0, swiping = false;
  document.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (!swiping) return;
    swiping = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    var idx = tabOrder.indexOf(S.tab);
    if (idx === -1) return;
    if (dx < 0 && idx < tabOrder.length - 1) { S.tab = tabOrder[idx + 1]; if (S.tab === 'formation') S.chapterIdx = null; render(); }
    else if (dx > 0 && idx > 0) { S.tab = tabOrder[idx - 1]; if (S.tab === 'formation') S.chapterIdx = null; render(); }
  }, { passive: true });
})();

// ─── Init ───
S.searchOpen = false;
S.searchQuery = '';
load();
initTheme();
initSync();

// Default dark mode if no preference saved
if (!localStorage.getItem('pbi-theme')) {
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('pbi-theme', 'dark');
}

renderChatFab();

// ─── Browser history navigation (back/forward buttons) ───
var _skipPush = false;
var _origRenderForHistory = render;

// Push state on every tab/chapter change
function _pushHistoryState() {
  if (_skipPush) return;
  var state = { tab: S.tab, chapterIdx: S.chapterIdx };
  var current = history.state;
  // Only push if state actually changed
  if (!current || current.tab !== state.tab || current.chapterIdx !== state.chapterIdx) {
    history.pushState(state, '', '');
  }
}

// Listen for back/forward
window.addEventListener('popstate', function(e) {
  if (e.state) {
    _skipPush = true;
    S.tab = e.state.tab || 'home';
    S.chapterIdx = e.state.chapterIdx != null ? e.state.chapterIdx : null;
    render();
    _skipPush = false;
  }
});

// Replace initial state
history.replaceState({ tab: S.tab, chapterIdx: S.chapterIdx }, '', '');

// Hook into render to push state after each render
var _renderCount = 0;
var _lastPushedTab = S.tab;
var _lastPushedChapter = S.chapterIdx;
setRenderFn(function() {
  mainRender();
  if (S.tab !== _lastPushedTab || S.chapterIdx !== _lastPushedChapter) {
    _pushHistoryState();
    _lastPushedTab = S.tab;
    _lastPushedChapter = S.chapterIdx;
  }
});

render();
showOnboarding();

// Auto-sync on load if connected
if (getSyncCode()) { syncPull(); }

// ─── Study time tracker (counts seconds while window is visible) ───
(function() {
  var _studyInterval = null;
  function startTracking() {
    if (_studyInterval) return;
    _studyInterval = setInterval(function() {
      S.studyTime = (S.studyTime || 0) + 30;
      save();
      var el = document.getElementById('home-study-time');
      if (el) el.childNodes[0].textContent = formatStudyTime(S.studyTime);
    }, 30000); // save every 30s
  }
  function stopTracking() {
    if (_studyInterval) { clearInterval(_studyInterval); _studyInterval = null; }
  }
  if (!document.hidden) startTracking();
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) stopTracking(); else startTracking();
  });
})();

// Splash screen
(function() {
  var sp = document.getElementById('splash');
  if (!sp) return;
  var spVer = document.getElementById('splash-ver');
  if (spVer) spVer.textContent = 'v' + APP_VERSION;
  if (sessionStorage.getItem('pbi-splashed')) { sp.style.display = 'none'; return; }
  setTimeout(function() {
    sp.classList.add('hide');
    sessionStorage.setItem('pbi-splashed', '1');
    setTimeout(function() { sp.style.display = 'none'; }, 600);
  }, 2500);
})();

// ─── Glow cursor effect on cards ───
(function() {
  document.addEventListener('mousemove', function(e) {
    var cards = document.querySelectorAll('.bento-card, .chapter-card, .quiz-card-apple, .flashcard, .card');
    cards.forEach(function(card) {
      var rect = card.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        card.classList.add('glow-card');
        card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
      } else {
        card.classList.remove('glow-card');
      }
    });
  }, { passive: true });
})();

// ─── Ripple effect on mobile buttons ───
(function() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button, .mobile-tab, .nav-item, .pill, .quiz-opt, .hero-btn, .exam-btn-apple');
    if (!btn) return;
    btn.style.position = btn.style.position || 'relative';
    btn.style.overflow = 'hidden';
    var circle = document.createElement('span');
    circle.className = 'ripple';
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    circle.style.width = circle.style.height = size + 'px';
    circle.style.left = (e.clientX - rect.left - size / 2) + 'px';
    circle.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(circle);
    circle.addEventListener('animationend', function() { circle.remove(); });
  });
})();

// ─── Parallax scroll on bento stat cards ───
(function() {
  var ticking = false;
  window.addEventListener('scroll', function() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function() {
      var cards = document.querySelectorAll('.bento-stat, .stat-mini');
      cards.forEach(function(card) {
        var rect = card.getBoundingClientRect();
        var viewH = window.innerHeight;
        if (rect.top < viewH && rect.bottom > 0) {
          var center = rect.top + rect.height / 2;
          var offset = (center - viewH / 2) / viewH;
          var shift = Math.round(offset * -4 * 10) / 10;
          card.style.transform = 'translateY(' + shift + 'px)';
        }
      });
      ticking = false;
    });
  }, { passive: true });
})();

// ─── Smooth theme transition ───
var origToggleTheme = toggleTheme;
window._smoothToggleTheme = function() {
  document.documentElement.classList.add('theme-transitioning');
  origToggleTheme();
  setTimeout(function() {
    document.documentElement.classList.remove('theme-transitioning');
  }, 450);
};

// ─── Inject gradient mesh into hero bento on render ───
var _origRender = render;
(function() {
  var observer = new MutationObserver(function() {
    var hero = document.querySelector('.bento-hero');
    if (hero && !hero.querySelector('.gradient-mesh')) {
      var mesh = document.createElement('div');
      mesh.className = 'gradient-mesh';
      hero.insertBefore(mesh, hero.firstChild);
    }
  });
  observer.observe(document.getElementById('app'), { childList: true, subtree: true });
})();

// Debug access
window.S = S;
