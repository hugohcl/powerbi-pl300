import { S, save } from '../core/state.js';
import { h, render } from '../core/render.js';
import { icon } from '../core/icons.js';
import { addXP } from './gamification.js';
import { highlightCode } from '../data/highlight.js';

export function getGuidedSteps(ex) {
  var steps = [];
  var sol = ex.solution;

  if (sol.includes('CALCULATE')) {
    steps.push({ text: "Commence par CALCULATE( ... )", hint: "CALCULATE modifie le contexte de filtre" });
    steps.push({ text: "Quel est le 1er argument ? (la mesure a evaluer)", hint: "C'est souvent [CA] ou une mesure existante" });
    steps.push({ text: "Quel(s) filtre(s) ajouter ?", hint: "Les filtres viennent apres la virgule" });
  } else if (sol.includes('DIVIDE')) {
    steps.push({ text: "Utilise DIVIDE pour une division securisee", hint: "DIVIDE(numerateur, denominateur, alternative)" });
    steps.push({ text: "Quel est le numerateur ?", hint: "Ce que tu veux diviser" });
    steps.push({ text: "Quel est le denominateur ?", hint: "Par quoi tu divises" });
    steps.push({ text: "Quelle valeur alternative si division par 0 ?", hint: "Generalement 0 ou BLANK()" });
  } else if (sol.includes('TOTALYTD') || sol.includes('TOTALQTD') || sol.includes('TOTALMTD')) {
    steps.push({ text: "Quelle fonction de cumul utiliser ?", hint: "TOTALYTD pour Year-To-Date, TOTALQTD pour Quarter, TOTALMTD pour Month" });
    steps.push({ text: "Quel est le 1er argument ? (la mesure)", hint: "Ex: [CA Total]" });
    steps.push({ text: "Quel est le 2eme argument ? (la colonne date)", hint: "Utilise la table de dates marquee, PAS Sales[OrderDate]" });
  } else if (sol.includes('RANKX')) {
    steps.push({ text: "Utilise RANKX pour classer", hint: "RANKX(table, expression)" });
    steps.push({ text: "1er argument : quelle table ? (avec ALL !)", hint: "ALL(...) est obligatoire sinon rang toujours = 1" });
    steps.push({ text: "2eme argument : quelle mesure pour classer ?", hint: "Ex: [CA Total]" });
    steps.push({ text: "Ordre : ASC ou DESC ?", hint: "DESC = le plus grand en 1er" });
  } else if (sol.includes('SUMX') || sol.includes('AVERAGEX')) {
    var fn = sol.includes('SUMX') ? 'SUMX' : 'AVERAGEX';
    steps.push({ text: 'Utilise ' + fn + ' pour iterer ligne par ligne', hint: fn + '(table, expression par ligne)' });
    steps.push({ text: "1er argument : quelle table parcourir ?", hint: "Ex: Sales, DimProduct..." });
    steps.push({ text: "2eme argument : quelle expression calculer par ligne ?", hint: "Ex: Sales[Qty] * Sales[Price]" });
  } else if (sol.includes('SWITCH')) {
    steps.push({ text: "Utilise SWITCH(TRUE(), ...) pour des conditions multiples", hint: "Alternative propre aux IF imbriques" });
    steps.push({ text: "Ecris les conditions du PLUS restrictif au MOINS restrictif", hint: "Ex: > 10000 AVANT > 1000" });
    steps.push({ text: "N'oublie pas la valeur par defaut en dernier", hint: "La derniere valeur sans condition = else" });
  } else if (sol.includes('VAR')) {
    steps.push({ text: "Commence par d\u00e9clarer tes VARiables", hint: "VAR NomVariable = expression" });
    steps.push({ text: "Utilise RETURN pour le r\u00e9sultat final", hint: "RETURN utilise les VARiables d\u00e9clar\u00e9es au-dessus" });
  } else {
    steps.push({ text: "Identifie la fonction DAX principale \u00e0 utiliser", hint: (ex.hints && ex.hints[0]) || "" });
    steps.push({ text: "Quel(s) argument(s) fournir ?", hint: (ex.hints && ex.hints[1]) || "" });
    steps.push({ text: "\u00c9cris la mesure compl\u00e8te", hint: "V\u00e9rifie les parenth\u00e8ses et les crochets" });
  }

  return steps;
}

export function getFilteredExercises() {
  var exs = typeof window.EXERCISES !== 'undefined' ? window.EXERCISES : [];
  if (S.exFilter !== 'all') {
    var ch = parseInt(S.exFilter.replace('ch', ''));
    exs = exs.filter(function(e) { return e.ch === ch; });
  }
  if (S.exDiffFilter > 0) {
    exs = exs.filter(function(e) { return e.difficulty === S.exDiffFilter; });
  }
  return exs;
}

export function checkExercise(input, exercise) {
  if (exercise.expectedPattern.test(input)) return true;
  if (exercise.altPatterns) {
    for (var i = 0; i < exercise.altPatterns.length; i++) {
      if (exercise.altPatterns[i].test(input)) return true;
    }
  }
  return false;
}

export function renderExercises() {
  var wrap = h('div', null);
  var exs = typeof window.EXERCISES !== 'undefined' ? window.EXERCISES : [];
  if (exs.length === 0) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--tx3)' } }, 'Exercices bient\u00f4t disponibles.'));
    wrap.appendChild(h('button', { onClick: function() { S.exMode = false; render(); } }, '\u2190 Retour'));
    return wrap;
  }

  wrap.appendChild(h('button', { onClick: function() { S.exMode = false; render(); }, style: { marginBottom: '16px', fontSize: '13px' } }, '\u2190 Retour au quiz'));

  var completedCount = Object.keys(S.exCompleted).length;
  wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
    h('h3', { style: { fontSize: '16px' } }, 'Exercices DAX'),
    h('span', { style: { fontSize: '14px', color: 'var(--green)', fontWeight: '600' } }, completedCount + '/' + exs.length + ' r\u00e9ussis')
  ));

  var chFilters = ['all'];
  var chSet = {};
  exs.forEach(function(e) { chSet[e.ch] = true; });
  Object.keys(chSet).sort(function(a,b) { return a-b; }).forEach(function(ch) { chFilters.push('ch' + ch); });
  wrap.appendChild(h('div', { className: 'pills' },
    chFilters.map(function(f) {
      return h('button', { className: 'pill' + (S.exFilter === f ? ' active' : ''), onClick: function() { S.exFilter = f; S.exIdx = 0; S.exInput = ''; S.exChecked = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); } }, f === 'all' ? 'Tous' : 'Ch.' + f.replace('ch', ''));
    })
  ));
  wrap.appendChild(h('div', { className: 'pills', style: { marginBottom: '16px' } },
    [0, 1, 2, 3].map(function(d) {
      return h('button', { className: 'pill' + (S.exDiffFilter === d ? ' active' : ''), onClick: function() { S.exDiffFilter = d; S.exIdx = 0; S.exInput = ''; S.exChecked = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); } }, d === 0 ? 'Toutes difficultes' : 'Niveau ' + d);
    })
  ));

  var filtered = getFilteredExercises();
  if (filtered.length === 0) {
    wrap.appendChild(h('div', { style: { textAlign: 'center', padding: '20px', color: 'var(--tx3)' } }, 'Aucun exercice pour ce filtre.'));
    return wrap;
  }

  if (S.exIdx >= filtered.length) S.exIdx = filtered.length - 1;
  var ex = filtered[S.exIdx];

  var card = h('div', { className: 'card fade-in' });
  card.appendChild(h('div', { className: 'card-header' },
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      h('span', { className: 'badge', style: { background: 'var(--accent-bg)', color: 'var(--accent)' } }, 'Ch.' + ex.ch),
      h('span', { className: 'badge', style: { background: ex.difficulty === 1 ? 'var(--green-bg)' : ex.difficulty === 2 ? 'var(--yellow-bg)' : 'var(--red-bg)', color: ex.difficulty === 1 ? 'var(--green)' : ex.difficulty === 2 ? '#9A6700' : 'var(--red)' } }, 'Niveau ' + ex.difficulty),
      S.exCompleted[ex.id] ? h('span', { className: 'badge', style: { background: 'var(--green-bg)', color: 'var(--green)' } }, 'R\u00e9ussi') : null
    ),
    h('span', { style: { fontSize: '13px', color: 'var(--tx3)' } }, (S.exIdx + 1) + '/' + filtered.length)
  ));

  card.appendChild(h('h3', { style: { fontSize: '16px', fontWeight: '600', marginBottom: '12px' } }, ex.title));
  card.appendChild(h('div', { className: 'box box-theory', style: { marginBottom: '16px' } },
    h('span', { className: 'box-label' }, 'Consigne'),
    h('div', { style: { fontSize: '14px', lineHeight: '1.65', whiteSpace: 'pre-wrap' } }, ex.prompt)
  ));

  var taClass = 'dax-editor';
  if (S.exChecked && S.exCorrect) taClass += ' dax-correct';
  if (S.exChecked && !S.exCorrect && !S.exShowSolution) taClass += ' dax-wrong';

  var ta = h('textarea', {
    className: taClass,
    placeholder: 'Ecris ta mesure DAX ici...',
    id: 'dax-input',
    onInput: function(e) { S.exInput = e.target.value; },
    onKeydown: function(e) {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); verifyExercise(); }
      if (e.key === 'Tab' && !e.shiftKey && S.exChecked && !S.exCorrect) { e.preventDefault(); showExHint(); }
    }
  });
  ta.value = S.exInput;
  if (S.exChecked) ta.setAttribute('readonly', 'true');
  card.appendChild(ta);

  card.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--tx3)', marginTop: '6px', marginBottom: '12px' } },
    h('span', { className: 'kbd' }, 'Ctrl+Enter'), ' Verifier  ',
    h('span', { className: 'kbd' }, 'Tab'), ' Indice suivant'
  ));

  if (!S.exChecked) {
    var btnRow = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });
    btnRow.appendChild(h('button', {
      onClick: verifyExercise,
      style: { padding: '10px 28px', fontWeight: '500', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
    }, 'V\u00e9rifier'));
    if (!S.exGuided) {
      btnRow.appendChild(h('button', {
        onClick: function() { S.exGuided = true; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
        style: { padding: '10px 20px', fontWeight: '500', background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green)' }
      }, 'Mode guide'));
    } else {
      btnRow.appendChild(h('button', {
        onClick: function() { S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
        style: { padding: '10px 20px', fontWeight: '500', color: 'var(--tx3)' }
      }, 'Quitter le mode guide'));
    }
    card.appendChild(btnRow);
  }

  // Guided mode panel
  if (S.exGuided && !S.exChecked) {
    var steps = getGuidedSteps(ex);
    var guidedDiv = h('div', { style: { marginTop: '16px', marginBottom: '12px' } });
    guidedDiv.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '10px', fontWeight: '500' } },
      '\u00c9tape ' + (S.exGuidedStep + 1) + ' sur ' + steps.length
    ));
    steps.forEach(function(step, i) {
      var isActive = i === S.exGuidedStep;
      var isDone = i < S.exGuidedStep;
      var isLocked = i > S.exGuidedStep;
      var stepClass = 'guided-step' + (isActive ? ' active' : '') + (isLocked ? ' locked' : '');
      var stepDiv = h('div', { className: stepClass });
      var numClass = 'step-number' + (isDone ? ' done' : '');
      stepDiv.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { className: numClass }, isDone ? '\u2713' : String(i + 1)),
        h('span', { style: { fontWeight: '600', fontSize: '14px' } }, step.text)
      ));
      if (isActive && S.exGuidedHints[i]) {
        stepDiv.appendChild(h('div', { style: { marginTop: '8px', marginLeft: '34px', fontStyle: 'italic', color: 'var(--tx3)', fontSize: '13px' } }, step.hint));
      }
      if (isActive) {
        var stepBtns = h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', marginLeft: '34px' } });
        if (!S.exGuidedHints[i]) {
          stepBtns.appendChild(h('button', {
            onClick: function() { S.exGuidedHints[i] = true; render(); },
            style: { fontSize: '12px', padding: '4px 12px', background: 'var(--yellow-bg)', color: '#9A6700', borderColor: '#F0AD4E' }
          }, 'Voir l\'indice'));
        }
        if (i < steps.length - 1) {
          stepBtns.appendChild(h('button', {
            onClick: function() { S.exGuidedStep = i + 1; render(); },
            style: { fontSize: '12px', padding: '4px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
          }, '\u00c9tape suivante \u2192'));
        }
        stepDiv.appendChild(stepBtns);
      }
      guidedDiv.appendChild(stepDiv);
    });
    card.appendChild(guidedDiv);
  }

  if (S.exChecked && S.exCorrect) {
    card.appendChild(h('div', { className: 'quiz-explain', style: { borderLeftColor: 'var(--green)' } },
      h('div', { style: { fontWeight: '600', color: 'var(--green)', marginBottom: '6px' } }, 'Correct !'),
      ex.explanation
    ));
  }

  if (S.exChecked && !S.exCorrect && !S.exShowSolution) {
    card.appendChild(h('div', { style: { color: 'var(--red)', fontSize: '14px', fontWeight: '500', marginTop: '10px', marginBottom: '10px' } }, 'Pas tout a fait... Essaie les indices ou regarde la solution.'));

    var hintsDiv = h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } });
    ex.hints.forEach(function(hint, i) {
      if (i < S.exHintLevel) {
        hintsDiv.appendChild(h('div', { className: 'box box-tip', style: { flex: '1 1 100%' } },
          h('span', { className: 'box-label' }, 'Indice ' + (i + 1)), hint
        ));
      } else if (i === S.exHintLevel) {
        hintsDiv.appendChild(h('button', { onClick: showExHint, style: { background: 'var(--yellow-bg)', color: '#9A6700', borderColor: '#F0AD4E' } }, 'Indice ' + (i + 1)));
      }
    });
    card.appendChild(hintsDiv);

    card.appendChild(h('div', { style: { display: 'flex', gap: '8px' } },
      h('button', { onClick: function() { S.exChecked = false; S.exCorrect = false; render(); setTimeout(function() { var inp = document.getElementById('dax-input'); if (inp) inp.focus(); }, 50); } }, 'Reessayer'),
      h('button', { onClick: function() { S.exShowSolution = true; render(); }, style: { color: 'var(--tx3)' } }, 'Voir la solution')
    ));
  }

  if (S.exShowSolution) {
    card.appendChild(h('div', { className: 'quiz-explain' },
      h('div', { style: { fontWeight: '600', marginBottom: '8px' } }, 'Solution :'),
      Object.assign(h('div', { className: 'code-block' }), { innerHTML: highlightCode(ex.solution) }),
      h('div', { style: { marginTop: '10px' } }, ex.explanation)
    ));
  }

  card.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '16px' } },
    h('button', {
      onClick: function() { S.exIdx = Math.max(0, S.exIdx - 1); S.exInput = ''; S.exChecked = false; S.exCorrect = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
      style: { visibility: S.exIdx > 0 ? 'visible' : 'hidden' }
    }, '\u2190 Precedent'),
    h('button', {
      onClick: function() { S.exIdx = Math.min(filtered.length - 1, S.exIdx + 1); S.exInput = ''; S.exChecked = false; S.exCorrect = false; S.exHintLevel = 0; S.exShowSolution = false; S.exGuided = false; S.exGuidedStep = 0; S.exGuidedHints = {}; render(); },
      style: { visibility: S.exIdx < filtered.length - 1 ? 'visible' : 'hidden' }
    }, 'Suivant \u2192')
  ));

  wrap.appendChild(card);
  return wrap;
}

export function verifyExercise() {
  var filtered = getFilteredExercises();
  var ex = filtered[S.exIdx];
  if (!ex) return;
  var input = S.exInput.trim();
  if (!input) return;
  S.exChecked = true;
  S.exCorrect = checkExercise(input, ex);
  if (S.exCorrect && !S.exShowSolution) {
    if (!S.exCompleted[ex.id] && typeof window.XP_REWARDS !== 'undefined') {
      addXP(window.XP_REWARDS.exercise, 'Exercice DAX');
    }
    S.exCompleted[ex.id] = true;
    save();
  }
  render();
}

export function showExHint() {
  var filtered = getFilteredExercises();
  var ex = filtered[S.exIdx];
  if (ex && S.exHintLevel < ex.hints.length) {
    S.exHintLevel++;
    render();
  }
}
