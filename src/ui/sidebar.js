import { S } from '../core/state.js';
import { h, render, APP_VERSION, isMobile, toggleTheme, getTotalMissions } from '../core/render.js';
import { icon, iconSearch, iconTimer, iconSun, iconMoon } from '../core/icons.js';
import { getLevel, isChapterUnlocked } from '../features/gamification.js';
import { showSyncModal, getSyncCode } from '../features/sync.js';
import { startPomodoro, pausePomodoro, stopPomodoro, resetPomodoro } from '../features/pomodoro.js';

let _getDueCards = null;
export function setSidebarDeps(deps) {
  if (deps.getDueCards) _getDueCards = deps.getDueCards;
}

const LEVELS = window.LEVELS;

export function renderHeader() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var headerRight = h('div', { className: 'header-right' });

  // Search button
  headerRight.appendChild(h('button', {
    onClick: () => { S.searchOpen = !S.searchOpen; S.searchQuery = ''; render(); if (S.searchOpen) setTimeout(() => { const inp = document.getElementById('search-input'); if (inp) inp.focus(); }, 50); },
    style: { fontSize: '13px', padding: '4px 12px' }
  }, iconSearch(), isMobile() ? '' : ' Ctrl+K'));

  // Sync button
  var syncBtn = h('button', {
    onClick: () => { showSyncModal(); },
    style: { fontSize: '13px', padding: '4px 12px', color: getSyncCode() ? 'var(--green)' : 'var(--tx3)' }
  }, icon('cloud', 16), getSyncCode() ? '' : '');
  headerRight.appendChild(syncBtn);

  // Focus timer
  var pomWrap = h('div', { style: { position: 'relative' } });
  if (!S.pomodoro.active) {
    pomWrap.appendChild(h('button', {
      className: 'pomodoro-btn',
      onClick: function() { startPomodoro(); }
    }, iconTimer(), ' Focus'));
  } else {
    var pomM = Math.floor(S.pomodoro.timeLeft / 60);
    var pomS = S.pomodoro.timeLeft % 60;
    var modeLabels = { work: 'Focus', break: 'Pause', longBreak: 'Pause longue' };
    var pomClass = 'pomodoro-btn ' + (S.pomodoro.mode === 'work' ? 'pomodoro-active' : 'pomodoro-break');
    pomWrap.appendChild(h('button', {
      className: pomClass,
      onClick: function() { S.pomodoro.dropdownOpen = !S.pomodoro.dropdownOpen; render(); }
    },
      iconTimer(), ' ',
      h('span', { id: 'pomodoro-time' }, pomM + ':' + String(pomS).padStart(2, '0')),
      ' ',
      h('span', { id: 'pomodoro-mode-label' }, modeLabels[S.pomodoro.mode])
    ));

    if (S.pomodoro.dropdownOpen) {
      var dropdown = h('div', { className: 'pomodoro-dropdown' });
      var bigTime = h('div', { style: { fontSize: '28px', fontWeight: '600', fontFamily: 'var(--mono)', textAlign: 'center', marginBottom: '8px' } },
        pomM + ':' + String(pomS).padStart(2, '0')
      );
      dropdown.appendChild(bigTime);
      dropdown.appendChild(h('div', { style: { textAlign: 'center', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: S.pomodoro.mode === 'work' ? 'var(--red)' : 'var(--green)' } },
        modeLabels[S.pomodoro.mode]
      ));
      dropdown.appendChild(h('div', { style: { textAlign: 'center', fontSize: '12px', color: 'var(--tx3)', marginBottom: '14px' } },
        'Cycle ' + (S.pomodoro.cycle + 1) + '/4'
      ));
      var pomBtns = h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center' } });
      pomBtns.appendChild(h('button', {
        onClick: function() { pausePomodoro(); },
        style: { fontSize: '12px', padding: '4px 12px' }
      }, S.pomodoro.paused ? '\u25BA Reprendre' : '\u2016 Pause'));
      pomBtns.appendChild(h('button', {
        onClick: function() { resetPomodoro(); },
        style: { fontSize: '12px', padding: '4px 12px' }
      }, 'Reset'));
      pomBtns.appendChild(h('button', {
        onClick: function() { stopPomodoro(); },
        style: { fontSize: '12px', padding: '4px 12px', color: 'var(--red)', borderColor: 'var(--red)' }
      }, 'Stop'));
      dropdown.appendChild(pomBtns);
      pomWrap.appendChild(dropdown);
    }
  }
  headerRight.appendChild(pomWrap);

  // Music button
  var musicBtn = h('button', { className: 'theme-btn', title: 'Ambiance studieuse', onClick: function() { window.location.href = 'music://music.apple.com/fr/station/ambiance-studieuse/ra.q-MMLEBw'; } });
  musicBtn.appendChild(icon('music', 16));
  headerRight.appendChild(musicBtn);

  // Theme button
  var themeBtn = h('button', { className: 'theme-btn', onClick: toggleTheme });
  themeBtn.appendChild(isDark ? icon('sun', 16) : icon('moon', 16));
  headerRight.appendChild(themeBtn);

  // XP bar section
  var lvl = getLevel(S.xp);
  var lvlData = LEVELS[lvl];
  var nextLvl = lvl < LEVELS.length - 1 ? LEVELS[lvl + 1] : null;
  var xpInLevel = S.xp - lvlData.xp;
  var xpForNext = nextLvl ? (nextLvl.xp - lvlData.xp) : 1;
  var xpPct = nextLvl ? Math.min(100, Math.round(xpInLevel / xpForNext * 100)) : 100;
  var xpSection = h('div', { className: 'header-xp' },
    h('span', { className: 'level-badge' }, lvlData.name),
    h('div', { className: 'xp-bar' },
      h('div', { className: 'xp-fill', style: { width: xpPct + '%' } })
    ),
    h('span', { style: { fontSize: '10px', color: 'var(--tx3)' } }, S.xp + ' XP')
  );
  if (S.streak > 0) {
    xpSection.appendChild(h('span', { className: 'streak-badge' }, icon('flame', 14), String(S.streak)));
  }

  return h('div', { className: 'header' },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
      h('h1', { style: { whiteSpace: 'nowrap', cursor: 'pointer' }, onClick: function() { S.chapterIdx = null; S.tab = 'home'; render(); } }, 'DAX Academy'),
      h('span', { style: { fontSize: '9px', color: 'var(--tx3)', alignSelf: 'flex-end', marginBottom: '2px' } }, 'v' + APP_VERSION),
      xpSection
    ),
    headerRight
  );
}

export function renderTabs() {
  return h('div', { className: 'tabs' });
}

export function makeSidebarSvg(pathD) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = pathD;
  return svg;
}

export function renderSidebar() {
  var getDueCards = _getDueCards || function() { return []; };
  var sidebar = h('nav', { className: 'sidebar', role: 'navigation', 'aria-label': 'Navigation principale' });

  // Logo
  var logoIcon = h('img', { src: 'icon.png', alt: 'DAX Academy', style: { width: '36px', height: '36px', borderRadius: '8px' } });
  var logo = h('div', { className: 'sidebar-logo' },
    logoIcon,
    h('span', { className: 'sidebar-logo-text' }, 'DAX Academy'),
    h('span', { className: 'sidebar-version' }, 'v' + APP_VERSION)
  );
  sidebar.appendChild(logo);

  // User card with XP bar + streak
  var lvl = getLevel(S.xp);
  var lvlData = LEVELS[lvl];
  var nextLvl = lvl < LEVELS.length - 1 ? LEVELS[lvl + 1] : null;
  var xpInLevel = S.xp - lvlData.xp;
  var xpForNext = nextLvl ? (nextLvl.xp - lvlData.xp) : 1;
  var xpPct = nextLvl ? Math.min(100, Math.round(xpInLevel / xpForNext * 100)) : 100;
  var userName = S.userName || 'Hugo';
  var initials = userName.charAt(0).toUpperCase();
  var userCard = h('div', { className: 'sidebar-user' });
  userCard.appendChild(h('div', { className: 'sidebar-avatar' }, initials));
  var userInfo = h('div', { className: 'sidebar-user-info' },
    h('div', { className: 'sidebar-user-name' }, userName),
    h('div', { className: 'sidebar-user-level' }, lvlData.name)
  );
  userCard.appendChild(userInfo);
  var xpWrap = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' } });
  var xpLabel = h('div', { className: 'sidebar-xp' }, icon('xp', 12), ' ' + S.xp);
  xpWrap.appendChild(xpLabel);
  if (S.streak > 0) {
    xpWrap.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: '2px' } }, icon('flame', 11), String(S.streak)));
  }
  userCard.appendChild(xpWrap);
  // XP progress bar under user card
  var xpBarRow = h('div', { style: { width: '100%', marginTop: '8px' } },
    h('div', { style: { height: '3px', borderRadius: '2px', background: 'var(--bd)', overflow: 'hidden' } },
      h('div', { style: { height: '100%', width: xpPct + '%', borderRadius: '2px', background: 'linear-gradient(90deg, var(--accent), var(--purple))' } })
    )
  );
  userCard.appendChild(xpBarRow);
  sidebar.appendChild(userCard);

  // Nav items config
  var navSections = [
    { label: 'Apprendre', items: [
      { id: 'home', text: 'Accueil', icon: '<path d="M2 6.5l7-5 7 5V15a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 15z"/><path d="M6 16V9h6v7"/>' },
      { id: 'formation', text: 'Formation', icon: '<rect x="2" y="3" width="14" height="12" rx="2"/><path d="M6 7h6M6 10h4"/>', badge: Object.entries(S.missions).filter(function(e) { return e[1] && !isNaN(e[0]) && e[0] > 0; }).length + '/' + getTotalMissions() }
    ]},
    { label: 'Pratiquer', items: [
      { id: 'quiz', text: 'Quiz PL-300', icon: '<circle cx="9" cy="9" r="7"/><path d="M9 6v3l2 1"/>' },
      { id: 'flash', text: 'Flashcards', icon: '<rect x="2" y="3" width="14" height="12" rx="2"/><path d="M5 7h8M5 10h5"/>', badge: String(getDueCards().length), badgeClass: 'orange' },
      { id: 'interview', text: 'Entretien', icon: '<circle cx="9" cy="6" r="3"/><path d="M3 16c0-3 3-5 6-5s6 2 6 5"/>' }
    ]},
    { label: 'Suivre', items: [
      { id: 'progress', text: 'Progression', icon: '<path d="M2 14l4-7 3.5 4.5 2.5-3 4 5.5"/>' },
      { id: 'ref', text: 'Référence DAX', icon: '<path d="M3 15.5v-11A2 2 0 015 2.5h10v13H5a2 2 0 01-2-2z"/><path d="M7 7h4M7 10h3"/>' }
    ]}
  ];

  navSections.forEach(function(section) {
    sidebar.appendChild(h('div', { className: 'sidebar-section-label' }, section.label));
    var nav = h('div', { className: 'sidebar-nav' });
    section.items.forEach(function(item) {
      var navItem = h('button', {
        className: 'nav-item' + (S.tab === item.id ? ' active' : ''),
        onClick: function() { S.tab = item.id; if (item.id === 'formation') S.chapterIdx = null; render(); }
      });
      navItem.appendChild(makeSidebarSvg(item.icon));
      navItem.appendChild(document.createTextNode(item.text));
      if (item.badge) {
        var badgeEl = h('span', { className: 'nav-badge' + (item.badgeClass ? ' ' + item.badgeClass : '') }, item.badge);
        navItem.appendChild(badgeEl);
      }
      nav.appendChild(navItem);
    });
    sidebar.appendChild(nav);
  });

  // Spacer
  sidebar.appendChild(h('div', { className: 'sidebar-spacer' }));

  // Search shortcut
  var searchBtn = h('button', { className: 'sidebar-search', onClick: function() { S.searchOpen = true; render(); } });
  searchBtn.appendChild(makeSidebarSvg('<circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3"/>'));
  searchBtn.appendChild(h('span', { className: 'sidebar-search-text' }, 'Rechercher\u2026'));
  searchBtn.appendChild(h('span', { className: 'sidebar-search-shortcut' }, '\u2318K'));
  sidebar.appendChild(searchBtn);

  // Pomodoro timer
  var pomWrap = h('div', { style: { padding: '0 4px', marginTop: '8px' } });
  if (!S.pomodoro.active) {
    var pomStartBtn = h('button', {
      className: 'nav-item',
      onClick: function() { startPomodoro(); },
      style: { width: '100%' }
    });
    pomStartBtn.appendChild(icon('timer', 18));
    pomStartBtn.appendChild(document.createTextNode('Focus'));
    pomWrap.appendChild(pomStartBtn);
  } else {
    var pomM = Math.floor(S.pomodoro.timeLeft / 60);
    var pomS = S.pomodoro.timeLeft % 60;
    var modeLabels = { work: 'Focus', break: 'Pause', longBreak: 'Pause longue' };
    var pomClass = S.pomodoro.mode === 'work' ? 'pomodoro-active' : 'pomodoro-break';
    var pomBtn = h('button', {
      className: 'nav-item ' + pomClass,
      onClick: function() { S.pomodoro.dropdownOpen = !S.pomodoro.dropdownOpen; render(); },
      style: { width: '100%', borderRadius: '10px', padding: '9px 12px', border: S.pomodoro.mode === 'work' ? '1px solid var(--red)' : '1px solid var(--green)', background: S.pomodoro.mode === 'work' ? 'rgba(255,59,48,0.08)' : 'rgba(52,199,89,0.08)' }
    });
    pomBtn.appendChild(icon('timer', 18));
    pomBtn.appendChild(h('span', { id: 'pomodoro-time' }, pomM + ':' + String(pomS).padStart(2, '0') + ' ' + modeLabels[S.pomodoro.mode]));
    pomWrap.appendChild(pomBtn);
    if (S.pomodoro.dropdownOpen) {
      var dropdown = h('div', { style: { padding: '12px', background: 'var(--surface)', borderRadius: '12px', border: '0.5px solid var(--bd)', marginTop: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } });
      dropdown.appendChild(h('div', { style: { fontSize: '24px', fontWeight: '700', fontFamily: 'var(--mono)', textAlign: 'center', marginBottom: '4px' } }, pomM + ':' + String(pomS).padStart(2, '0')));
      dropdown.appendChild(h('div', { style: { textAlign: 'center', fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' } }, 'Cycle ' + (S.pomodoro.cycle + 1) + '/4'));
      var pomBtns = h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center' } });
      pomBtns.appendChild(h('button', { onClick: function() { pausePomodoro(); }, style: { fontSize: '11px', padding: '4px 10px' } }, S.pomodoro.paused ? 'Reprendre' : 'Pause'));
      pomBtns.appendChild(h('button', { onClick: function() { resetPomodoro(); }, style: { fontSize: '11px', padding: '4px 10px' } }, 'Reset'));
      pomBtns.appendChild(h('button', { onClick: function() { stopPomodoro(); }, style: { fontSize: '11px', padding: '4px 10px', color: 'var(--red)', borderColor: 'var(--red)' } }, 'Stop'));
      dropdown.appendChild(pomBtns);
      pomWrap.appendChild(dropdown);
    }
  }
  sidebar.appendChild(pomWrap);

  // Bottom actions (theme, music, sync)
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bottomActions = h('div', { className: 'sidebar-bottom-actions' });

  // Theme toggle
  var themeBtn = h('button', { onClick: toggleTheme, title: isDark ? 'Mode clair' : 'Mode sombre' });
  themeBtn.appendChild(isDark ? icon('sun', 16) : icon('moon', 16));
  bottomActions.appendChild(themeBtn);

  // Music button
  var musicBtn = h('button', { onClick: function() { window.location.href = 'music://music.apple.com/fr/station/ambiance-studieuse/ra.q-MMLEBw'; }, title: 'Ambiance studieuse' });
  musicBtn.appendChild(icon('music', 16));
  bottomActions.appendChild(musicBtn);

  // Sync button
  var syncBtn = h('button', { onClick: function() { showSyncModal(); }, title: 'Synchroniser', style: getSyncCode() ? { color: 'var(--green)' } : {} });
  syncBtn.appendChild(icon('cloud', 16));
  bottomActions.appendChild(syncBtn);

  sidebar.appendChild(bottomActions);

  return sidebar;
}
