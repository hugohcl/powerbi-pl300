import { S, save } from '../core/state.js';
import { h, render, shuf, qHash, trackQuizAnswer, getTotalMissions } from '../core/render.js';
import { icon } from '../core/icons.js';
import { playXP, playLevelUp, playBadge } from './sounds.js';

// Late-bound dependencies (set by app.js to break circular deps)
let _getDueCards = null;
let _sm2Update = null;
let _sm2IsMastered = null;
let _sm2IsDue = null;
let _sm2Get = null;
let _getProgress = null;

export function setGamificationDeps(deps) {
  if (deps.getDueCards) _getDueCards = deps.getDueCards;
  if (deps.sm2Update) _sm2Update = deps.sm2Update;
  if (deps.sm2IsMastered) _sm2IsMastered = deps.sm2IsMastered;
  if (deps.sm2IsDue) _sm2IsDue = deps.sm2IsDue;
  if (deps.sm2Get) _sm2Get = deps.sm2Get;
  if (deps.getProgress) _getProgress = deps.getProgress;
}

export function composeDailyMix() {
  var steps = [];
  // 1. Add due flashcards (up to 3)
  var due = _getDueCards();
  var fcPick = shuf(due).slice(0, 3);
  fcPick.forEach(function(idx) {
    steps.push({ type: 'flashcard', idx: idx, card: window.FLASHCARDS[idx] });
  });
  // 2. Add weak quiz questions (up to 5)
  var weakQs = window.QUIZ.filter(function(q) {
    var st = S.quizStats[qHash(q)];
    return st && st.wrong > st.right;
  });
  if (weakQs.length < 5) {
    // Fill with random unanswered questions
    var unanswered = window.QUIZ.filter(function(q) { return !S.quizStats[qHash(q)]; });
    weakQs = weakQs.concat(shuf(unanswered).slice(0, 5 - weakQs.length));
  }
  shuf(weakQs).slice(0, 5).forEach(function(q) {
    steps.push({ type: 'quiz', question: q });
  });
  // 3. Add next mission from current chapter (1)
  var prog = _getProgress();
  var incompleteCh = prog.chProgress.find(function(c) { return c.pct < 100; });
  if (incompleteCh) {
    var ch = window.CHAPTERS[incompleteCh.ch - 1];
    for (var i = ch.missions[0]; i <= ch.missions[1]; i++) {
      if (!S.missions[i]) {
        var mission = window.MISSIONS.find(function(m) { return m.id === i; });
        if (mission) { steps.push({ type: 'mission', mission: mission }); break; }
      }
    }
  }
  return shuf(steps);
}

export function startDailyMix() {
  S.dailyMixSteps = composeDailyMix();
  S.dailyMixIdx = 0;
  S.dailyMixScore = 0;
  S.dailyMixTotal = S.dailyMixSteps.length;
  S.dailyMixActive = true;
  S.dailyMixFlipped = false;
  S.dailyMixSel = null;
  S.dailyMixShown = false;
  render();
}

export function renderDailyMix() {
  var wrap = h('div', { className: 'fade-in' });
  var steps = S.dailyMixSteps;
  if (S.dailyMixIdx >= steps.length) {
    // Session complete
    var pct = S.dailyMixTotal > 0 ? Math.round(S.dailyMixScore / S.dailyMixTotal * 100) : 0;
    wrap.appendChild(h('div', { className: 'daily-mix-complete' },
      h('div', { style: { fontSize: '48px', marginBottom: '16px' } }, icon('trophy', 48)),
      h('h2', { style: { fontSize: '22px', marginBottom: '8px' } }, 'Session termin\u00e9e !'),
      h('div', { style: { fontSize: '32px', fontWeight: '700', color: 'var(--accent)', marginBottom: '8px' } }, S.dailyMixScore + '/' + S.dailyMixTotal),
      h('div', { style: { fontSize: '14px', color: 'var(--tx2)', marginBottom: '24px' } },
        pct >= 80 ? 'Excellent travail !' : pct >= 50 ? 'Bien joue, continue !' : 'Continue de progresser !'),
      h('button', {
        onClick: function() { S.dailyMixActive = false; render(); },
        style: { padding: '12px 32px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)' }
      }, 'Retour')
    ));
    addXP(20, 'Daily Mix');
    return wrap;
  }

  var step = steps[S.dailyMixIdx];
  // Progress bar
  wrap.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' } },
    h('button', { onClick: function() { S.dailyMixActive = false; render(); }, style: { fontSize: '13px', padding: '4px 10px' } }, '\u2190 Quitter'),
    h('div', { style: { flex: '1' } },
      h('div', { className: 'exam-bar' },
        h('div', { className: 'exam-bar-fill', style: { width: Math.round((S.dailyMixIdx / steps.length) * 100) + '%' } })
      )
    ),
    h('span', { style: { fontSize: '13px', color: 'var(--tx3)', whiteSpace: 'nowrap' } }, (S.dailyMixIdx + 1) + '/' + steps.length)
  ));

  // Step type badge
  var typeLabels = { flashcard: 'Flashcard', quiz: 'Quiz', mission: 'Mission' };
  var typeColors = { flashcard: '#F0AD4E', quiz: 'var(--purple)', mission: 'var(--accent)' };
  wrap.appendChild(h('div', { style: { marginBottom: '12px' } },
    h('span', { className: 'badge', style: { background: typeColors[step.type] + '20', color: typeColors[step.type] } }, typeLabels[step.type])
  ));

  if (step.type === 'flashcard') {
    var card = step.card;
    var cardEl = h('div', {
      className: 'flashcard' + (S.dailyMixFlipped ? ' flashcard-back' : ''),
      style: { background: S.dailyMixFlipped ? 'var(--bg2)' : 'var(--bg)' },
      onClick: function() { S.dailyMixFlipped = !S.dailyMixFlipped; render(); }
    },
      h('div', { style: { textAlign: 'center', maxWidth: '500px' } },
        h('div', { className: 'flashcard-label' }, S.dailyMixFlipped ? 'Reponse' : 'Question'),
        h('div', { className: 'flashcard-text' }, S.dailyMixFlipped ? card.b : card.f)
      )
    );
    wrap.appendChild(cardEl);
    if (S.dailyMixFlipped) {
      wrap.appendChild(h('div', { className: 'flash-actions' },
        h('button', { className: 'review', onClick: function() {
          _sm2Update(step.idx, 1); S.dailyMixFlipped = false; S.dailyMixIdx++; render();
        }}, 'A revoir'),
        h('button', { onClick: function() {
          _sm2Update(step.idx, 3); S.dailyMixScore++; S.dailyMixFlipped = false; S.dailyMixIdx++; render();
        }, style: { borderColor: '#F0AD4E', color: '#F0AD4E' } }, 'Difficile'),
        h('button', { className: 'know', onClick: function() {
          _sm2Update(step.idx, 5); S.dailyMixScore++; S.dailyMixFlipped = false; S.dailyMixIdx++; render();
        }}, 'Facile')
      ));
    }
  } else if (step.type === 'quiz') {
    var q = step.question;
    wrap.appendChild(h('p', { className: 'quiz-q' }, q.q));
    var opts = h('div', { className: 'quiz-options' });
    q.o.forEach(function(o, i) {
      var cls = 'quiz-opt';
      if (S.dailyMixShown && i === q.a) cls += ' correct';
      else if (S.dailyMixShown && i === S.dailyMixSel && i !== q.a) cls += ' wrong';
      opts.appendChild(h('button', {
        className: cls,
        onClick: function() {
          if (S.dailyMixShown) return;
          S.dailyMixSel = i; S.dailyMixShown = true;
          if (i === q.a) S.dailyMixScore++;
          var hash = qHash(q);
          if (!S.quizStats[hash]) S.quizStats[hash] = { right: 0, wrong: 0 };
          S.quizStats[hash][i === q.a ? 'right' : 'wrong']++;
          trackQuizAnswer();
          addXP(i === q.a ? window.XP_REWARDS.quiz_correct : window.XP_REWARDS.quiz_wrong, 'Quiz');
          save(); render();
        }
      }, h('span', { className: 'letter' }, String.fromCharCode(65 + i)), o));
    });
    wrap.appendChild(opts);
    if (S.dailyMixShown && q.w) {
      wrap.appendChild(h('div', { className: 'quiz-explain' }, q.w));
    }
    if (S.dailyMixShown) {
      wrap.appendChild(h('button', { className: 'quiz-next', onClick: function() {
        S.dailyMixShown = false; S.dailyMixSel = null; S.dailyMixIdx++; render();
      }}, 'Suivante \u2192'));
    }
  } else if (step.type === 'mission') {
    var m = step.mission;
    wrap.appendChild(h('div', { className: 'mission' },
      h('div', { className: 'mission-header' },
        h('span', { className: 'mission-num' }, '#' + m.id),
        m.title ? h('span', { style: { fontSize: '13px', fontWeight: '500' } }, m.title) : null
      ),
      h('div', { className: 'mission-text' }, m.text),
      h('div', { style: { marginTop: '12px', display: 'flex', gap: '8px' } },
        h('button', {
          onClick: function() {
            if (!S.missions[m.id]) { S.missions[m.id] = true; addXP(window.XP_REWARDS.mission, 'Mission'); S.dailyMixScore++; }
            S.dailyMixIdx++; save(); render();
          },
          style: { background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green)' }
        }, 'Fait !'),
        h('button', { onClick: function() { S.dailyMixIdx++; render(); }, style: { color: 'var(--tx3)' } }, 'Passer')
      )
    ));
  }
  return wrap;
}

export function getWeeklyChallenge() {
  var today = new Date();
  var monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() || 7) + 1);
  var weekId = monday.toISOString().slice(0, 10);
  if (S.weeklyChallengeDate === weekId && S.weeklyChallenge) return S.weeklyChallenge;
  // Generate new challenge
  var challenges = [
    { id: 'flash10', title: 'Ma\u00eetre des cartes', desc: 'Ma\u00eetrise 10 nouvelles flashcards cette semaine', target: 10, metric: 'flashcards', icon: 'zap', xpBonus: 100 },
    { id: 'quiz30', title: 'Machine \u00e0 quiz', desc: 'R\u00e9ponds \u00e0 30 questions de quiz', target: 30, metric: 'quiz_answers', icon: 'target', xpBonus: 80 },
    { id: 'mission8', title: 'Compl\u00e9teur', desc: 'Termine 8 missions cette semaine', target: 8, metric: 'missions', icon: 'check', xpBonus: 120 },
    { id: 'streak5', title: 'R\u00e9gulier', desc: 'Maintiens un streak de 5+ jours', target: 5, metric: 'streak', icon: 'flame', xpBonus: 75 },
    { id: 'dax5', title: 'DAX Warrior', desc: 'Compl\u00e8te 5 exercices DAX', target: 5, metric: 'dax_exercises', icon: 'award', xpBonus: 100 },
    { id: 'xp200', title: 'Grind XP', desc: 'Gagne 200 XP cette semaine', target: 200, metric: 'weekly_xp', icon: 'xp', xpBonus: 60 }
  ];
  var challenge = challenges[Math.floor(Math.random() * challenges.length)];
  challenge.weekId = weekId;
  challenge.completed = false;
  S.weeklyChallenge = challenge;
  S.weeklyChallengeDate = weekId;
  save();
  return challenge;
}

export function getWeeklyChallengeProgress(challenge) {
  if (!challenge) return 0;
  var weekStart = new Date(challenge.weekId);
  var m = challenge.metric;
  if (m === 'streak') return Math.min(S.streak, challenge.target);
  if (m === 'weekly_xp') {
    return S.xpHistory.filter(function(e) { return e.date >= challenge.weekId; }).reduce(function(s, e) { return s + e.xp; }, 0);
  }
  // For quiz_answers, count answers logged this week
  if (m === 'quiz_answers') {
    var weeklyAnswers = 0;
    if (S.weeklyQuizLog) {
      S.weeklyQuizLog.forEach(function(entry) { if (entry.date >= challenge.weekId) weeklyAnswers += entry.count; });
    }
    return Math.min(weeklyAnswers, challenge.target);
  }
  if (m === 'flashcards') {
    return window.FLASHCARDS.filter(function(_, i) { return _sm2IsMastered(i); }).length;
  }
  if (m === 'missions') {
    return Object.values(S.missions).filter(Boolean).length;
  }
  if (m === 'dax_exercises') {
    return Object.keys(S.exCompleted).length;
  }
  return 0;
}

export function getGhostProfiles() {
  var totalMissions = getTotalMissions();
  var myProgress = Object.values(S.missions).filter(Boolean).length / totalMissions;
  var myXP = S.xp;
  return [
    { name: 'Marie L.', role: 'Reconversion DA', xp: Math.round(myXP * 1.3 + 200), streak: 12, level: 4, avatar: 'M' },
    { name: 'Alex T.', role: 'Junior Analyst', xp: Math.round(myXP * 0.85 + 100), streak: 5, level: 3, avatar: 'A' },
    { name: 'Toi', role: '', xp: myXP, streak: S.streak, level: S.level, avatar: '\u2605', isUser: true },
    { name: 'Karim B.', role: 'Etudiant M2', xp: Math.round(myXP * 0.65 + 50), streak: 3, level: 2, avatar: 'K' },
    { name: 'Julie R.', role: 'Comptable', xp: Math.round(myXP * 0.4), streak: 1, level: 1, avatar: 'J' }
  ].sort(function(a, b) { return b.xp - a.xp; });
}

export function getNarrativeMessages() {
  var msgs = [];
  // Weekly XP comparison
  var today = new Date();
  var thisWeekXP = 0, lastWeekXP = 0;
  S.xpHistory.forEach(function(e) {
    var d = new Date(e.date);
    var daysDiff = Math.round((today - d) / 86400000);
    if (daysDiff < 7) thisWeekXP += e.xp;
    else if (daysDiff < 14) lastWeekXP += e.xp;
  });
  if (lastWeekXP > 0 && thisWeekXP > lastWeekXP) {
    msgs.push({ text: 'Semaine en feu ! +' + thisWeekXP + ' XP vs ' + lastWeekXP + ' la semaine derniere', type: 'positive' });
  } else if (lastWeekXP > 0 && thisWeekXP < lastWeekXP * 0.5) {
    msgs.push({ text: 'Ralentissement detecte. ' + thisWeekXP + ' XP cette semaine vs ' + lastWeekXP + ' la semaine derniere', type: 'warning' });
  }
  // Flashcard mastery
  var mastered = window.FLASHCARDS.filter(function(_, i) { return _sm2IsMastered(i); }).length;
  var pct = Math.round(mastered / window.FLASHCARDS.length * 100);
  if (pct > 0 && pct < 100) {
    msgs.push({ text: 'Tu maitrises ' + pct + '% des flashcards (' + mastered + '/' + window.FLASHCARDS.length + ')', type: 'info' });
  }
  // Streak record
  if (S.streak >= 7) {
    msgs.push({ text: 'Streak de ' + S.streak + ' jours ! Continue comme ca.', type: 'positive' });
  }
  // Exam progress
  if (S.examHistory.length >= 2) {
    var scores = S.examHistory.map(function(e) { return e.score; });
    var lastScore = scores[scores.length - 1];
    var prevScore = scores[scores.length - 2];
    if (lastScore > prevScore) {
      msgs.push({ text: 'Score exam en hausse : ' + prevScore + ' \u2192 ' + lastScore + '/1000', type: 'positive' });
    }
  }
  // Daily goal
  var todayXP = 0;
  var todayStr = today.toISOString().slice(0, 10);
  var todayEntry = S.xpHistory.find(function(e) { return e.date === todayStr; });
  if (todayEntry) todayXP = todayEntry.xp;
  if (todayXP >= S.dailyGoal) {
    msgs.push({ text: 'Objectif du jour atteint ! (' + todayXP + '/' + S.dailyGoal + ' XP)', type: 'positive' });
  } else {
    msgs.push({ text: 'Objectif du jour : ' + todayXP + '/' + S.dailyGoal + ' XP', type: 'info' });
  }
  return msgs;
}

export function showCelebration(title, subtitle, type) {
  var overlay = h('div', { className: 'celebration-overlay', id: 'celebration' });
  var particles = h('div', { className: 'confetti-container' });
  var colors = ['#2E75B6', '#1D9E75', '#F0AD4E', '#534AB7', '#D85A30', '#ffc233'];
  for (var i = 0; i < 50; i++) {
    var p = h('div', { className: 'confetti-piece', style: {
      left: Math.random() * 100 + '%',
      animationDelay: Math.random() * 2 + 's',
      animationDuration: (2 + Math.random() * 2) + 's',
      background: colors[Math.floor(Math.random() * colors.length)],
      transform: 'rotate(' + Math.random() * 360 + 'deg)'
    }});
    particles.appendChild(p);
  }
  overlay.appendChild(particles);
  var iconName = type === 'badge' ? 'award' : type === 'level' ? 'trophy' : 'xp';
  var card = h('div', { className: 'celebration-card' },
    h('div', { className: 'celebration-icon badge-unlock' }, icon(iconName, 48)),
    h('h2', { style: { fontSize: '24px', fontWeight: '700', marginBottom: '8px' } }, title),
    h('div', { style: { fontSize: '15px', color: 'var(--tx2)', marginBottom: '24px' } }, subtitle),
    h('button', {
      onClick: function() { var el = document.getElementById('celebration'); if (el) el.remove(); },
      style: { padding: '12px 32px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)' }
    }, 'Continuer')
  );
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export function getChapterPrereqs() {
  // Define prerequisite relationships: ch -> [prerequisite chapters]
  return {
    1: [],
    2: [1],
    3: [1],
    4: [3],
    5: [4],
    6: [4, 5],
    7: [6]
  };
}

export function isChapterUnlocked(chId) {
  var prereqs = getChapterPrereqs();
  var reqs = prereqs[chId] || [];
  if (reqs.length === 0) return true;
  return reqs.every(function(reqId) {
    var ch = window.CHAPTERS[reqId - 1];
    if (!ch) return true;
    var done = 0;
    for (var i = ch.missions[0]; i <= ch.missions[1]; i++) { if (S.missions[i]) done++; }
    var total = ch.missions[1] - ch.missions[0] + 1;
    return done / total >= 0.5; // Unlock when 50% of prereq is done
  });
}

export function generateFCQuizOptions(correctIdx, reverse) {
  var correct = window.FLASHCARDS[correctIdx];
  // In reverse mode: question=b, answer=f. Normal: question=f, answer=b
  var answerField = reverse ? 'f' : 'b';
  var distractors = window.FLASHCARDS.filter(function(fc, i) { return i !== correctIdx && fc.c === correct.c; });
  if (distractors.length < 3) {
    distractors = window.FLASHCARDS.filter(function(fc, i) { return i !== correctIdx; });
  }
  var correctAnswer = correct[answerField];
  var picked = shuf(distractors).slice(0, 3).map(function(fc) { return fc[answerField]; });
  // Avoid duplicate options
  var seen = {};
  seen[correctAnswer] = true;
  var unique = [];
  for (var i = 0; i < picked.length; i++) {
    if (!seen[picked[i]]) { seen[picked[i]] = true; unique.push(picked[i]); }
  }
  // If not enough unique distractors, grab from all cards
  if (unique.length < 3) {
    var all = shuf(window.FLASHCARDS.filter(function(fc, j) { return j !== correctIdx; }));
    for (var k = 0; k < all.length && unique.length < 3; k++) {
      if (!seen[all[k][answerField]]) { seen[all[k][answerField]] = true; unique.push(all[k][answerField]); }
    }
  }
  var options = shuf(unique.slice(0, 3).concat([correctAnswer]));
  var correctOptionIdx = options.indexOf(correctAnswer);
  return { options: options, correct: correctOptionIdx };
}

export function getLevel(xp) {
  var lvl = 0;
  for (var i = 0; i < window.LEVELS.length; i++) {
    if (xp >= window.LEVELS[i].xp) lvl = i;
  }
  return lvl;
}

export function addXP(amount, source) {
  if (!amount || amount <= 0) return;
  S.xp += amount;
  playXP();
  // XP history
  var today = new Date().toISOString().slice(0, 10);
  var last = S.xpHistory.length > 0 ? S.xpHistory[S.xpHistory.length - 1] : null;
  if (last && last.date === today) last.xp += amount;
  else S.xpHistory.push({ date: today, xp: amount });
  // Keep 30 days
  if (S.xpHistory.length > 30) S.xpHistory = S.xpHistory.slice(-30);
  // Streak
  updateStreak();
  // Level up?
  var newLvl = getLevel(S.xp);
  if (newLvl > S.level) {
    S.level = newLvl;
    playLevelUp();
    showCelebration('Niveau ' + window.LEVELS[newLvl].name + ' !', 'Tu as atteint le niveau ' + (newLvl + 1) + '/' + window.LEVELS.length, 'level');
  }
  // Show XP notif
  showNotification('+' + amount + ' XP' + (source ? ' (' + source + ')' : ''), 'xp');
  // Check badges
  checkBadges();
  save();
}

export function updateStreak() {
  var today = new Date().toISOString().slice(0, 10);
  if (S.lastActiveDate === today) return;
  if (S.lastActiveDate) {
    var last = new Date(S.lastActiveDate);
    var now = new Date(today);
    var diff = Math.round((now - last) / 86400000);
    if (diff === 1) {
      S.streak++;
    } else if (diff === 2 && S.streakFreezes > 0 && S.streak > 0) {
      // Streak freeze: preserve streak but consume a freeze
      S.streakFreezes--;
      S.streak++;
      showNotification('Streak freeze utilise ! Streak sauvegarde.', 'xp');
    } else if (diff > 1) {
      S.streak = 1;
    }
  } else {
    S.streak = 1;
  }
  S.lastActiveDate = today;
}

export function checkBadges() {
  if (typeof window.BADGES === 'undefined') return;
  window.BADGES.forEach(function(b) {
    if (S.badges.indexOf(b.id) !== -1) return; // already earned
    var earned = false;
    var cond = b.condition;
    if (cond === 'mission_1') earned = Object.keys(S.missions).filter(function(k) { return S.missions[k]; }).length >= 1;
    else if (cond.match(/^chapter_(\d+)_complete$/)) {
      var chId = parseInt(cond.match(/^chapter_(\d+)_complete$/)[1]);
      var ch = window.CHAPTERS.find(function(c) { return c.id === chId; });
      if (ch) {
        var allDone = true;
        for (var i = ch.missions[0]; i <= ch.missions[1]; i++) { if (!S.missions[i]) allDone = false; }
        earned = allDone;
      }
    }
    else if (cond === 'streak_7') earned = S.streak >= 7;
    else if (cond === 'streak_30') earned = S.streak >= 30;
    else if (cond === 'quiz_total_100') {
      var total = Object.values(S.quizStats).reduce(function(s, v) { return s + v.right + v.wrong; }, 0);
      earned = total >= 100;
    }
    else if (cond === 'flash_50') {
      var mastered = window.FLASHCARDS.filter(function(_, i) { return _sm2IsMastered(i); }).length;
      earned = mastered >= 50;
    }
    else if (cond === 'exam_700') {
      earned = S.examHistory.some(function(e) { return e.score >= 700; });
    }
    else if (cond === 'quiz_calculate_10') {
      var calcQs = window.QUIZ.filter(function(q) { return q.q.toLowerCase().indexOf('calculate') !== -1; });
      var right = 0;
      calcQs.forEach(function(q) { var st = S.quizStats[qHash(q)]; if (st) right += st.right; });
      earned = right >= 10;
    }
    else if (cond === 'quiz_ti_10') {
      var tiQs = window.QUIZ.filter(function(q) { return q.ch === 6; });
      var right2 = 0;
      tiQs.forEach(function(q) { var st = S.quizStats[qHash(q)]; if (st) right2 += st.right; });
      earned = right2 >= 10;
    }
    else if (cond === 'exercises_all') {
      var exs = typeof window.EXERCISES !== 'undefined' ? window.EXERCISES : [];
      earned = exs.length > 0 && exs.every(function(e) { return S.exCompleted[e.id]; });
    }
    else if (cond === 'racing_complete') {
      earned = typeof window.RACING_MISSIONS !== 'undefined' && window.RACING_MISSIONS.length > 0 && window.RACING_MISSIONS.every(function(rm) { return S.missions['racing_' + rm.id]; });
    }
    if (earned) {
      S.badges.push(b.id);
      playBadge();
      showCelebration('Badge d\u00e9bloqu\u00e9 !', b.name + ' \u2014 ' + b.desc, 'badge');
    }
  });
}

var _notifTimeout = null;

export function showNotification(text, type) {
  var existing = document.querySelector('.notification');
  if (existing) existing.remove();
  var notif = document.createElement('div');
  notif.className = 'notification ' + (type || 'xp');
  notif.textContent = text;
  document.body.appendChild(notif);
  clearTimeout(_notifTimeout);
  _notifTimeout = setTimeout(function() {
    if (notif.parentNode) {
      notif.style.animation = 'notifOut .3s ease forwards';
      setTimeout(function() { if (notif.parentNode) notif.remove(); }, 300);
    }
  }, 2500);
}

export function showOnboarding() {
  if (localStorage.getItem('pbi-onboarded')) return;
  var _onboardingStep = 0;

  var steps = [
    { icon: 'award', title: 'Bienvenue dans DAX Academy', desc: 'Formation compl\u00e8te pour la certification Power\u00a0BI PL-300. 7 chapitres, 120 missions, 277 quiz.' },
    { icon: 'zap', title: 'Comment progresser', desc: 'Chaque action rapporte des XP\u00a0: missions (+15), quiz (+5), exercices (+30). Objectif\u00a0: atteindre le niveau PL-300 Ready (3\u202f000 XP).' },
    { icon: 'target', title: 'Outils d\u2019\u00e9tude', desc: 'Daily Mix\u00a0: session personnalis\u00e9e quotidienne. Flashcards\u00a0: r\u00e9p\u00e9tition espac\u00e9e (SM-2). Examen blanc\u00a0: simulation PL-300 chronom\u00e9tr\u00e9e.' }
  ];

  var overlay = h('div', { className: 'onboarding-overlay', id: 'onboarding' });
  var card = h('div', { className: 'onboarding-card' });
  overlay.appendChild(card);

  function renderStep() {
    var s = steps[_onboardingStep];
    card.innerHTML = '';

    // Icon
    var iconWrap = h('div', { style: { marginBottom: '16px' } }, icon(s.icon, 32));
    card.appendChild(iconWrap);

    // Title
    card.appendChild(h('h2', null, s.title));

    // Description
    card.appendChild(h('p', { style: { fontSize: '14px', color: 'var(--tx2)', lineHeight: '1.6', margin: '16px 0 24px' } }, s.desc));

    // Dots
    var dotsWrap = h('div', { style: { display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' } });
    for (var i = 0; i < steps.length; i++) {
      var dotStyle = {
        width: '8px', height: '8px', borderRadius: '50%',
        background: i === _onboardingStep ? 'var(--accent)' : 'var(--bd)',
        transition: 'background .2s'
      };
      dotsWrap.appendChild(h('div', { style: dotStyle }));
    }
    card.appendChild(dotsWrap);

    // Button
    var isLast = _onboardingStep === steps.length - 1;
    var btn = h('button', {
      onClick: function() {
        if (isLast) {
          localStorage.setItem('pbi-onboarded', '1');
          var el = document.getElementById('onboarding');
          if (el) el.remove();
        } else {
          _onboardingStep++;
          renderStep();
        }
      },
      style: { padding: '12px 32px', fontSize: '14px', fontWeight: '600', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)' }
    }, isLast ? 'Commencer' : 'Suivant');
    card.appendChild(btn);
  }

  renderStep();
  document.body.appendChild(overlay);
}
