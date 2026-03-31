import { S, save, getSaveData, applyData } from '../core/state.js';
import { h, render, qHash, shuf, getTotalMissions, APP_VERSION, formatStudyTime } from '../core/render.js';
import { icon } from '../core/icons.js';
import { getLevel, checkBadges, getNarrativeMessages, showNotification } from '../features/gamification.js';

let _sm2IsMastered = null;
let _getDueCards = null;
let _makeSidebarSvg = null;
export function setProgressDeps(deps) {
  if (deps.sm2IsMastered) _sm2IsMastered = deps.sm2IsMastered;
  if (deps.getDueCards) _getDueCards = deps.getDueCards;
  if (deps.makeSidebarSvg) _makeSidebarSvg = deps.makeSidebarSvg;
}

const CHAPTERS = window.CHAPTERS;
const FLASHCARDS = window.FLASHCARDS;
const QUIZ = window.QUIZ;
const DOMAINS = window.DOMAINS;
const BADGES = window.BADGES;
const PL300_INFO = window.PL300_INFO;

export function getDomainStats() {
  const stats = {};
  Object.entries(DOMAINS).forEach(([d]) => {
    const domainQs = QUIZ.filter(q => q.d === d);
    let right = 0, total = 0;
    domainQs.forEach(q => {
      const st = S.quizStats[qHash(q)];
      if (st) { right += st.right; total += st.right + st.wrong; }
    });
    stats[d] = { right, total, pct: total > 0 ? Math.round(right / total * 100) : 0 };
  });
  return stats;
}

export function getRecommendations() {
  var getDueCards = _getDueCards || function() { return []; };
  const recs = [];
  const ds = getDomainStats();

  // 1. Weakest domain
  let weakest = null, weakPct = 101;
  Object.entries(ds).forEach(([d, s]) => {
    if (s.total > 3 && s.pct < weakPct) { weakest = d; weakPct = s.pct; }
  });
  if (weakest && weakPct < 70) {
    const dom = DOMAINS[weakest];
    const chapters = PL300_INFO.domains.find(x => x.id === weakest)?.chapters || [];
    recs.push({
      text: `Point faible : ${dom.name} (${weakPct}%). Revise les chapitres ${chapters.join(', ')}.`,
      iconName: dom.icon,
      action: chapters.length > 0 ? () => { S.tab = 'formation'; S.chapterIdx = chapters[0] - 1; render(); } : null,
      label: chapters.length > 0 ? `R\u00e9viser Ch.${chapters[0]}` : null
    });
  }

  // 2. Unstarted chapters
  const unstarted = CHAPTERS.filter(ch => {
    const [from, to] = ch.missions;
    const done = Array.from({ length: to - from + 1 }, (_, i) => S.missions[from + i]).filter(Boolean).length;
    return done === 0;
  });
  if (unstarted.length > 0 && unstarted.length < CHAPTERS.length) {
    const ch = unstarted[0];
    recs.push({
      text: `${unstarted.length} chapitre${unstarted.length > 1 ? 's' : ''} non commenc\u00e9${unstarted.length > 1 ? 's' : ''}. Commence par Ch.${ch.id} \u2014 ${ch.title}.`,
      action: () => { S.tab = 'formation'; S.chapterIdx = ch.id - 1; render(); },
      label: `Ch.${ch.id}`
    });
  }

  // 3. SM-2 due cards
  const dueCount = getDueCards().length;
  if (dueCount > 0) {
    recs.push({
      text: `${dueCount} flashcard${dueCount > 1 ? 's' : ''} \u00e0 r\u00e9viser aujourd'hui (r\u00e9p\u00e9tition espac\u00e9e).`,
      action: () => { S.tab = 'flash'; S.fcFilter = 'due'; S.fcIdx = 0; S.fcFlipped = false; render(); },
      label: 'R\u00e9viser'
    });
  }

  // 4. Suggest exam if progression > 70%
  const missionsDone = Object.entries(S.missions).filter(([k, v]) => v && !isNaN(k) && k > 0 && k <= getTotalMissions()).length;
  if (missionsDone / getTotalMissions() > 0.7 && (S.examHistory.length === 0 || S.examHistory[S.examHistory.length - 1].score < 700)) {
    recs.push({
      text: 'Progression > 70%. Tente un examen blanc pour evaluer ton niveau.',
      action: () => { S.tab = 'quiz'; render(); },
      label: 'Examen blanc'
    });
  }

  return recs.slice(0, 3);
}

export function getPredictiveStats() {
  const ds = getDomainStats();
  const weights = { PQ: 0.275, MO: 0.275, VA: 0.275, DE: 0.175 };

  // Global success rate
  const totalR = Object.values(S.quizStats).reduce((s, v) => s + v.right, 0);
  const totalA = Object.values(S.quizStats).reduce((s, v) => s + v.right + v.wrong, 0);
  const globalPct = totalA > 0 ? Math.round(totalR / totalA * 100) : 0;

  // Strongest and weakest
  let strongest = null, strongPct = -1, weakest = null, weakPct = 101;
  Object.entries(ds).forEach(([d, s]) => {
    if (s.total > 0 && s.pct > strongPct) { strongest = d; strongPct = s.pct; }
    if (s.total > 0 && s.pct < weakPct) { weakest = d; weakPct = s.pct; }
  });

  // Estimated PL-300 score
  let estimatedScore = 0;
  let hasData = false;
  Object.entries(weights).forEach(([d, w]) => {
    if (ds[d].total > 0) { estimatedScore += (ds[d].pct / 100) * w * 1000; hasData = true; }
  });
  estimatedScore = hasData ? Math.round(estimatedScore) : 0;
  const ready = estimatedScore >= 700;

  // Weeks estimate
  const missionsDone = Object.entries(S.missions).filter(([k, v]) => v && !isNaN(k) && k > 0 && k <= getTotalMissions()).length;
  const pctDone = missionsDone / getTotalMissions();
  let weeksEstimate = null;
  if (pctDone > 0.05 && pctDone < 1) {
    // Simple linear projection
    weeksEstimate = Math.ceil((1 - pctDone) / pctDone * 4); // assume current pace took ~4 weeks
    if (weeksEstimate > 52) weeksEstimate = null;
  }

  return { globalPct, strongest, strongPct, weakest, weakPct, estimatedScore, ready, weeksEstimate };
}

export function renderProgress() {
  var sm2IsMastered = _sm2IsMastered || function() { return false; };
  var getDueCards = _getDueCards || function() { return []; };
  const wrap = h('div', null);
  const missionsDone = Object.entries(S.missions).filter(([k, v]) => v && !isNaN(k) && k > 0 && k <= getTotalMissions()).length;
  const knownCards = FLASHCARDS.filter((_, i) => sm2IsMastered(i)).length;
  const totalQuizAnswered = Object.values(S.quizStats).reduce((sum, s) => sum + s.right + s.wrong, 0);
  const totalQuizRight = Object.values(S.quizStats).reduce((sum, s) => sum + s.right, 0);
  const quizPct = totalQuizAnswered > 0 ? Math.round(totalQuizRight / totalQuizAnswered * 100) : 0;

  // Page header
  wrap.appendChild(h('div', { className: 'page-header' },
    h('div', { className: 'page-label' }, 'Suivi'),
    h('h1', { className: 'page-title' }, 'Progression')
  ));

  // Top bento: Activity Rings + Key Numbers
  var topBento = h('div', { className: 'top-bento' });

  // Activity Rings card
  var totalMissionsCount = getTotalMissions();
  var missionPct = totalMissionsCount > 0 ? missionsDone / totalMissionsCount : 0;
  var flashPct = FLASHCARDS.length > 0 ? knownCards / FLASHCARDS.length : 0;
  var todayXPr = 0;
  var todayStrR = new Date().toISOString().slice(0, 10);
  var todayEntryR = S.xpHistory.find(function(e) { return e.date === todayStrR; });
  if (todayEntryR) todayXPr = todayEntryR.xp;
  var xpDayPct = Math.min(1, todayXPr / S.dailyGoal);

  var ringsCard = h('div', { className: 'bento-card' });
  var ringsLayout = h('div', { className: 'rings-layout' });

  // SVG rings
  var c1 = 2 * Math.PI * 70, o1 = c1 * (1 - missionPct);
  var c2 = 2 * Math.PI * 55, o2 = c2 * (1 - flashPct);
  var c3 = 2 * Math.PI * 40, o3 = c3 * (1 - xpDayPct);
  var ringsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ringsSvg.setAttribute('class', 'rings-svg');
  ringsSvg.setAttribute('viewBox', '0 0 160 160');
  ringsSvg.innerHTML = '<circle cx="80" cy="80" r="70" fill="none" stroke="#e8e8ed" stroke-width="11"/>' +
    '<circle cx="80" cy="80" r="70" fill="none" stroke="#ff3b30" stroke-width="11" stroke-dasharray="' + c1.toFixed(1) + '" stroke-dashoffset="' + o1.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 80 80)"/>' +
    '<circle cx="80" cy="80" r="55" fill="none" stroke="#e8e8ed" stroke-width="11"/>' +
    '<circle cx="80" cy="80" r="55" fill="none" stroke="#34c759" stroke-width="11" stroke-dasharray="' + c2.toFixed(1) + '" stroke-dashoffset="' + o2.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 80 80)"/>' +
    '<circle cx="80" cy="80" r="40" fill="none" stroke="#e8e8ed" stroke-width="11"/>' +
    '<circle cx="80" cy="80" r="40" fill="none" stroke="#0071e3" stroke-width="11" stroke-dasharray="' + c3.toFixed(1) + '" stroke-dashoffset="' + o3.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 80 80)"/>';
  ringsLayout.appendChild(ringsSvg);

  // Legend
  var legend = h('div', { className: 'rings-legend' },
    h('div', { className: 'ring-row' },
      h('div', { className: 'ring-dot', style: { background: '#ff3b30' } }),
      h('div', { className: 'ring-info' },
        h('div', { className: 'ring-name' }, 'Missions'),
        h('div', { className: 'ring-detail' }, 'Chapitres 1 \u00e0 7')
      ),
      h('div', { className: 'ring-value' }, missionsDone + '/' + totalMissionsCount)
    ),
    h('div', { className: 'ring-row' },
      h('div', { className: 'ring-dot', style: { background: '#34c759' } }),
      h('div', { className: 'ring-info' },
        h('div', { className: 'ring-name' }, 'Flashcards'),
        h('div', { className: 'ring-detail' }, 'R\u00e9p\u00e9tition espac\u00e9e')
      ),
      h('div', { className: 'ring-value' }, knownCards + '/' + FLASHCARDS.length)
    ),
    h('div', { className: 'ring-row' },
      h('div', { className: 'ring-dot', style: { background: '#0071e3' } }),
      h('div', { className: 'ring-info' },
        h('div', { className: 'ring-name' }, 'XP du jour'),
        h('div', { className: 'ring-detail' }, 'Objectif quotidien')
      ),
      h('div', { className: 'ring-value' }, todayXPr + '/' + S.dailyGoal)
    )
  );
  ringsLayout.appendChild(legend);
  ringsCard.appendChild(ringsLayout);
  topBento.appendChild(ringsCard);

  // Key Numbers card
  var studyHoursP = formatStudyTime(S.studyTime);
  var keyCard = h('div', { className: 'bento-card', style: { padding: '22px' } },
    h('div', { className: 'stats-mini' },
      h('div', { className: 'stat-mini' },
        h('div', { className: 'stat-mini-value' }, String(S.xp)),
        h('div', { className: 'stat-mini-label' }, 'XP total')
      ),
      h('div', { className: 'stat-mini' },
        h('div', { className: 'stat-mini-inline' },
          h('div', { className: 'stat-mini-value' }, String(S.streak || 0)),
          icon('flame', 20)
        ),
        h('div', { className: 'stat-mini-label' }, 'jour' + ((S.streak || 0) > 1 ? 's' : '') + ' de streak')
      ),
      h('div', { className: 'stat-mini' },
        h('div', { className: 'stat-mini-value' }, String(quizPct), h('span', null, '%')),
        h('div', { className: 'stat-mini-label' }, 'taux quiz')
      ),
      h('div', { className: 'stat-mini' },
        h('div', { className: 'stat-mini-value' }, studyHoursP),
        h('div', { className: 'stat-mini-label' }, 'temps d\'\u00e9tude')
      )
    )
  );
  topBento.appendChild(keyCard);
  wrap.appendChild(topBento);

  // ── Narrative messages ──
  var narrativeMsgs = getNarrativeMessages();
  if (narrativeMsgs.length > 0) {
    var narrativeBox = h('div', { style: { marginBottom: '20px' } });
    narrativeMsgs.slice(0, 3).forEach(function(msg) {
      var msgColor = msg.type === 'positive' ? 'var(--green)' : msg.type === 'warning' ? 'var(--red)' : 'var(--accent)';
      var msgBg = msg.type === 'positive' ? 'var(--green-bg)' : msg.type === 'warning' ? 'var(--red-bg)' : 'var(--accent-bg)';
      narrativeBox.appendChild(h('div', { style: {
        padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '6px',
        background: msgBg, borderLeft: '3px solid ' + msgColor, fontSize: '13px', color: 'var(--tx)'
      }}, msg.text));
    });
    wrap.appendChild(narrativeBox);
  }

  // ── Streak enhanced ──
  var streakBox = h('div', { style: { display: 'flex', gap: '12px', marginBottom: '20px' } });
  // Streak card
  streakBox.appendChild(h('div', { className: 'stat-card', style: { flex: '1', textAlign: 'center' } },
    h('div', { style: { fontSize: '32px', color: '#ffc233' } }, icon('flame', 32)),
    h('div', { style: { fontSize: '28px', fontWeight: '700', color: '#ffc233' } }, String(S.streak)),
    h('div', { style: { fontSize: '12px', color: 'var(--tx3)' } }, 'jours de streak'),
    S.streakFreezes > 0
      ? h('div', { style: { fontSize: '11px', color: 'var(--accent)', marginTop: '4px' } }, icon('shield', 12), ' ' + S.streakFreezes + ' freeze dispo')
      : h('div', { style: { fontSize: '11px', color: 'var(--red)', marginTop: '4px' } }, 'Aucun freeze !'),
    S.streakFreezes === 0 && S.streak >= 3
      ? h('button', {
          onClick: function() { if (S.xp >= 50) { S.xp -= 50; S.streakFreezes++; save(); render(); showNotification('-50 XP : streak freeze achete !', 'xp'); } else { showNotification('Pas assez d\'XP (50 requis)', 'xp'); } },
          style: { marginTop: '6px', fontSize: '11px', padding: '4px 10px' }
        }, 'Acheter (50 XP)')
      : null
  ));
  // Daily goal card
  var todayXP2 = 0;
  var todayStr2 = new Date().toISOString().slice(0, 10);
  var todayEntry2 = S.xpHistory.find(function(e) { return e.date === todayStr2; });
  if (todayEntry2) todayXP2 = todayEntry2.xp;
  var goalPct2 = Math.min(100, Math.round(todayXP2 / S.dailyGoal * 100));
  streakBox.appendChild(h('div', { className: 'stat-card', style: { flex: '1', textAlign: 'center' } },
    h('div', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '8px' } }, 'Objectif du jour'),
    h('div', { style: { fontSize: '28px', fontWeight: '700', color: goalPct2 >= 100 ? 'var(--green)' : 'var(--accent)' } }, todayXP2 + '/' + S.dailyGoal),
    h('div', { className: 'progress-bar', style: { marginTop: '8px' } },
      h('div', { className: 'progress-fill' + (goalPct2 >= 100 ? ' green' : ''), style: { width: goalPct2 + '%' } })
    ),
    h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '8px' } },
      [30, 50, 100].map(function(g) {
        return h('button', {
          onClick: function() { S.dailyGoal = g; save(); render(); },
          style: { fontSize: '10px', padding: '2px 8px', background: S.dailyGoal === g ? 'var(--accent)' : 'var(--bg)', color: S.dailyGoal === g ? 'white' : 'var(--tx3)', border: '1px solid ' + (S.dailyGoal === g ? 'var(--accent)' : 'var(--bd)'), borderRadius: '10px' }
        }, g + ' XP');
      })
    )
  ));
  wrap.appendChild(streakBox);


  // Prochaine r\u00e9vision
  var dueCount = getDueCards().length;
  var revBox = h('div', { className: 'box ' + (dueCount > 0 ? 'box-tip' : 'box-business'), style: { marginBottom: '20px' } },
    h('span', { className: 'box-label' }, 'Prochaine r\u00e9vision'),
    dueCount > 0
      ? h('span', null, icon('shuffle', 14), ' ', String(dueCount), ' flashcard' + (dueCount > 1 ? 's' : '') + ' \u00e0 revoir aujourd\'hui')
      : h('span', null, icon('check', 14), ' Aucune flashcard \u00e0 revoir \u2014 bien jou\u00e9 !')
  );
  if (dueCount > 0) {
    revBox.appendChild(h('button', {
      onClick: function() { S.tab = 'flash'; S.fcFilter = 'due'; render(); },
      style: { marginTop: '8px', fontSize: '12px', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
    }, 'R\u00e9viser maintenant \u2192'));
  }
  wrap.appendChild(revBox);

  // XP Activity Chart (14 last days)
  if (S.xpHistory.length > 0) {
    var totalXp14 = S.xpHistory.reduce(function(sum, e) {
      var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
      return e.date >= cutoff.toISOString().slice(0, 10) ? sum + e.xp : sum;
    }, 0);
    wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '4px' } }, 'XP des 30 derniers jours'));
    wrap.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' } }, String(totalXp14) + ' XP gagn\u00e9s sur les 14 derniers jours'));
    var last14 = [];
    var today = new Date();
    for (var d = 13; d >= 0; d--) {
      var dt = new Date(today); dt.setDate(dt.getDate() - d);
      var dateStr = dt.toISOString().slice(0, 10);
      var entry = S.xpHistory.find(function(e) { return e.date === dateStr; });
      last14.push({ date: dateStr, xp: entry ? entry.xp : 0, day: dt.getDate() });
    }
    var maxXp = Math.max.apply(null, last14.map(function(e) { return e.xp; })) || 1;
    var chart = h('div', { className: 'xp-chart', style: { marginBottom: '4px' } });
    last14.forEach(function(e) {
      var pct = Math.round(e.xp / maxXp * 100);
      var col = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1', height: '100%', justifyContent: 'flex-end' } });
      var bar = h('div', { className: 'xp-chart-bar', style: { height: Math.max(2, pct) + '%' }, title: e.date + ': ' + e.xp + ' XP' });
      if (e.xp === 0) bar.style.background = 'var(--bg3)';
      col.appendChild(bar);
      chart.appendChild(col);
    });
    wrap.appendChild(chart);
    var labels = h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '0 2px' } });
    last14.forEach(function(e) {
      labels.appendChild(h('span', { style: { fontSize: '9px', color: 'var(--tx3)', flex: '1', textAlign: 'center' } }, String(e.day)));
    });
    wrap.appendChild(labels);
  } else {
    wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '10px' } }, 'XP des 30 derniers jours'));
    wrap.appendChild(h('div', { className: 'box box-business', style: { marginBottom: '20px', textAlign: 'center', padding: '24px 16px' } },
      h('div', { style: { fontSize: '13px', color: 'var(--tx3)' } }, 'Commence \u00e0 apprendre pour voir ta progression ici.')
    ));
  }

  // Heatmap (90 days)
  wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '10px' } }, 'Heatmap d\'activit\u00e9 (90 jours)'));
  var heatmapGrid = h('div', { className: 'heatmap', style: { marginBottom: '20px' } });
  var todayHeat = new Date();
  for (var hd = 89; hd >= 0; hd--) {
    var hdt = new Date(todayHeat); hdt.setDate(hdt.getDate() - hd);
    var hdStr = hdt.toISOString().slice(0, 10);
    var hEntry = S.xpHistory.find(function(e) { return e.date === hdStr; });
    var hxp = hEntry ? hEntry.xp : 0;
    var hClass = 'heatmap-cell';
    if (hxp > 0 && hxp < 30) hClass += ' l1';
    else if (hxp >= 30 && hxp < 80) hClass += ' l2';
    else if (hxp >= 80 && hxp < 150) hClass += ' l3';
    else if (hxp >= 150) hClass += ' l4';
    heatmapGrid.appendChild(h('div', { className: hClass, title: hdStr + ': ' + hxp + ' XP' }));
  }
  wrap.appendChild(heatmapGrid);

  // Badges
  if (typeof BADGES !== 'undefined') {
    wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '10px' } }, 'Badges (' + S.badges.length + '/' + BADGES.length + ')'));
    var badgeGrid = h('div', { className: 'badge-grid', style: { marginBottom: '20px' } });
    BADGES.forEach(function(b) {
      var earned = S.badges.indexOf(b.id) !== -1;
      badgeGrid.appendChild(h('div', { className: 'badge-item' + (earned ? '' : ' locked') },
        h('div', { className: 'badge-icon' }, earned ? icon('award', 24) : icon('lock', 24)),
        h('div', { className: 'badge-name' }, b.name),
        h('div', { className: 'badge-desc' }, b.desc)
      ));
    });
    wrap.appendChild(badgeGrid);
  }

  // Recommendations
  const recs = getRecommendations();
  if (recs.length > 0) {
    const recBox = h('div', { className: 'box box-tip', style: { marginBottom: '20px' } },
      h('span', { className: 'box-label' }, 'Recommandations')
    );
    recs.forEach(r => {
      const row = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' } },
        h('span', null, ...(r.iconName ? [icon(r.iconName, 14), ' '] : []), r.text)
      );
      if (r.action && r.label) {
        row.appendChild(h('button', {
          onClick: r.action,
          style: { marginLeft: '12px', fontSize: '12px', whiteSpace: 'nowrap', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
        }, r.label + ' \u2192'));
      }
      recBox.appendChild(row);
    });
    wrap.appendChild(recBox);
  }

  // Predictive progression
  const pred = getPredictiveStats();
  if (pred.globalPct > 0) {
    const predBox = h('div', { className: 'box box-theory', style: { marginBottom: '20px' } },
      h('span', { className: 'box-label' }, 'Estimation PL-300')
    );
    predBox.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' } },
      h('div', null, 'Taux de r\u00e9ussite global : ', h('strong', null, `${pred.globalPct}%`)),
      h('div', null, 'Score estim\u00e9 : ', h('strong', { style: { color: pred.ready ? 'var(--green)' : 'var(--red)' } }, `${pred.estimatedScore}/1000`)),
      pred.strongest ? h('div', null, 'Domaine le plus fort : ', h('strong', { style: { color: 'var(--green)' } }, `${DOMAINS[pred.strongest]?.name} (${pred.strongPct}%)`)) : h('div'),
      pred.weakest ? h('div', null, 'Domaine le plus faible : ', h('strong', { style: { color: 'var(--red)' } }, `${DOMAINS[pred.weakest]?.name} (${pred.weakPct}%)`)) : h('div')
    ));
    predBox.appendChild(h('div', { style: { marginTop: '10px', fontSize: '14px', fontWeight: '600', color: pred.ready ? 'var(--green)' : 'var(--red)' } },
      pred.ready ? 'Pr\u00eat pour la PL-300 !' : 'Pas encore pr\u00eat pour la PL-300'
    ));
    if (pred.weeksEstimate) {
      predBox.appendChild(h('div', { style: { marginTop: '4px', fontSize: '13px', color: 'var(--tx2)' } },
        `A ton rythme actuel, tu seras pr\u00eat dans environ ${pred.weeksEstimate} semaine${pred.weeksEstimate > 1 ? 's' : ''}`
      ));
    }
    wrap.appendChild(predBox);
  }

  // Progress by chapter
  wrap.appendChild(h('h3', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '14px' } }, 'Progression par chapitre'));
  CHAPTERS.forEach(ch => {
    const [from, to] = ch.missions;
    const total = to - from + 1;
    const done = Array.from({ length: total }, (_, i) => S.missions[from + i]).filter(Boolean).length;
    const pct = Math.round(done / total * 100);

    wrap.appendChild(h('div', { style: { marginBottom: '14px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' } },
        h('span', { style: { fontWeight: '500' } }, `Ch.${ch.id} \u2014 ${ch.title}`),
        h('span', { style: { color: 'var(--tx3)' } }, `${done}/${total}`)
      ),
      h('div', { className: 'progress-bar' },
        h('div', { className: 'progress-fill' + (pct === 100 ? ' green' : ''), style: { width: pct + '%' } })
      )
    ));
  });

  // Quiz by domain (Apple style cards)
  wrap.appendChild(h('div', { className: 'section-label-apple', style: { marginTop: '8px' } }, 'Quiz par domaine PL-300'));
  var domainGrid = h('div', { className: 'domain-grid' });
  Object.entries(DOMAINS).forEach(([d, dom]) => {
    const domainQs = QUIZ.filter(q => q.d === d);
    let right = 0, total = 0;
    domainQs.forEach(q => {
      const st = S.quizStats[qHash(q)];
      if (st) { right += st.right; total += st.right + st.wrong; }
    });
    const pct = total > 0 ? Math.round(right / total * 100) : 0;

    domainGrid.appendChild(h('div', { className: 'domain-card' },
      h('div', { className: 'domain-info' },
        h('div', { className: 'domain-name' }, dom.name),
        h('div', { className: 'domain-weight' }, dom.weight + ' de l\'examen')
      ),
      h('div', { className: 'domain-bar-wrap' },
        h('div', { className: 'domain-bar-fill', style: { width: pct + '%' } })
      ),
      h('div', { className: 'domain-score' }, total > 0 ? pct + '%' : '\u2014')
    ));
  });
  wrap.appendChild(domainGrid);

  // Weak domain recommendations
  var _weakDoms = [];
  Object.entries(DOMAINS).forEach(function(entry) {
    var dId = entry[0];
    var domainQs = QUIZ.filter(function(q) { return q.d === dId; });
    var dRight = 0, dTotal = 0;
    domainQs.forEach(function(q) {
      var st = S.quizStats[qHash(q)];
      if (st) { dRight += st.right; dTotal += st.right + st.wrong; }
    });
    if (dTotal >= 5) {
      var dPct = Math.round(dRight / dTotal * 100);
      if (dPct < 70) {
        var domInfo = PL300_INFO.domains.find(function(x) { return x.id === dId; });
        var firstCh = domInfo && domInfo.chapters.length > 0 ? domInfo.chapters[0] : null;
        _weakDoms.push({ id: dId, name: entry[1].name, pct: dPct, ch: firstCh });
      }
    }
  });
  if (_weakDoms.length > 0) {
    var weakBox = h('div', { className: 'box box-error', style: { marginTop: '16px', marginBottom: '20px' } },
      h('span', { className: 'box-label' }, 'Recommandations')
    );
    _weakDoms.forEach(function(wd) {
      var wdRow = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' } },
        h('span', null, 'Domaine faible d\u00e9tect\u00e9 : ', h('strong', null, wd.name), ' (' + wd.pct + '%)')
      );
      if (wd.ch && CHAPTERS[wd.ch - 1]) {
        wdRow.appendChild(h('button', {
          onClick: function() { S.tab = 'formation'; S.chapterIdx = wd.ch - 1; S.qi = 0; S.sel = null; S.shown = false; render(); },
          style: { marginLeft: '12px', fontSize: '12px', whiteSpace: 'nowrap', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
        }, 'R\u00e9viser Ch.' + wd.ch + ' \u2192'));
      }
      weakBox.appendChild(wdRow);
    });
    // Button: start weak domain review session
    var weakDomIds = _weakDoms.map(function(wd) { return wd.id; });
    weakBox.appendChild(h('button', {
      className: 'quiz-next',
      style: { marginTop: '12px', width: '100%', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' },
      onClick: function() {
        // Filter quiz to weak domains only
        var weakQs = QUIZ.filter(function(q) { return weakDomIds.includes(q.d); });
        if (weakQs.length === 0) return;
        shuf(weakQs);
        S.quizQuestions = weakQs.slice(0, Math.min(20, weakQs.length));
        S.qi = 0; S.sel = null; S.shown = false; S.score = 0; S.total = 0;
        S.quizHistory = []; S.multiSel = []; S.orderSel = [];
        S.quizMode = 'training'; S.examActive = false;
        S._quizRetryPool = true;
        S.tab = 'quiz';
        S._weakReviewMode = true;
        render();
      }
    }, 'R\u00e9viser mes points faibles (' + weakDomIds.length + ' domaine' + (weakDomIds.length > 1 ? 's' : '') + ')'));
    wrap.appendChild(weakBox);
  }

  // Best exam
  if (S.examHistory.length > 0) {
    const best = S.examHistory.reduce((a, b) => a.score > b.score ? a : b);
    wrap.appendChild(h('div', { className: 'box ' + (best.score >= 700 ? 'box-business' : 'box-error'), style: { marginTop: '20px' } },
      h('span', { className: 'box-label' }, 'Meilleur examen'),
      `${best.score}/1000 \u2014 ${best.date} \u2014 ${best.score >= 700 ? 'R\u00c9USSI' : 'Pas encore le niveau'}`
    ));
  } else {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '16px', color: 'var(--tx3)', fontSize: '13px', marginTop: '20px' } },
      'Pas encore d\'examen blanc. Lance-toi quand tu te sens pr\u00eat !'
    ));
  }

  // Export / Import
  var exportImportSection = h('div', { style: { marginTop: '32px', padding: '20px', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '0.5px solid var(--bd)' } });
  exportImportSection.appendChild(h('div', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '12px' } }, 'Mes donn\u00e9es'));

  // Export button
  exportImportSection.appendChild(h('button', {
    style: { marginRight: '12px', padding: '8px 16px', fontSize: '13px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)', borderRadius: 'var(--radius)' },
    onClick: function() {
      var data = getSaveData();
      data._exportDate = new Date().toISOString();
      data._appVersion = APP_VERSION;
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'dax-academy-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click(); URL.revokeObjectURL(url);
    }
  }, 'Exporter mes donn\u00e9es'));

  // Import button
  exportImportSection.appendChild(h('button', {
    style: { padding: '8px 16px', fontSize: '13px', background: 'var(--bg3)', color: 'var(--tx2)', borderColor: 'var(--bd)', borderRadius: 'var(--radius)' },
    onClick: function() {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.addEventListener('change', function() {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            var data = JSON.parse(e.target.result);
            if (!data.missions && !data.xp && !data.known) {
              alert('Fichier invalide : aucune donn\u00e9e de progression trouv\u00e9e.');
              return;
            }
            if (!confirm('\u00c9craser la progression actuelle avec les donn\u00e9es import\u00e9es ?')) return;
            applyData(data);
            save(); render();
            showNotification('Donn\u00e9es import\u00e9es avec succ\u00e8s', 'xp');
          } catch(err) {
            alert('Erreur de lecture du fichier JSON.');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    }
  }, 'Importer'));

  exportImportSection.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginTop: '8px' } }, 'Sauvegarde locale au format JSON. Compatible entre appareils.'));
  wrap.appendChild(exportImportSection);

  // Reset
  wrap.appendChild(h('button', {
    onClick: () => {
      if (confirm('R\u00e9initialiser toute la progression ?')) {
        S.missions = {}; S.checklist = {}; S.known = {}; S.quizStats = {}; S.examHistory = []; S.exCompleted = {}; S.xp = 0; S.level = 0; S.badges = []; S.streak = 0; S.lastActiveDate = null; S.xpHistory = []; S.interviewReviewed = {}; S.streakFreezes = 1; S.weeklyChallenge = null; S.weeklyChallengeDate = null;
        save(); render();
      }
    },
    style: { marginTop: '24px', fontSize: '12px', color: 'var(--red)', background: 'none', border: 'none' }
  }, 'R\u00e9initialiser toute la progression'));

  return wrap;
}
