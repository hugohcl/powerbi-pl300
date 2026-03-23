import { S, save } from '../core/state.js';
import { h, render, getTotalMissions } from '../core/render.js';
import { icon } from '../core/icons.js';
import { addXP } from './gamification.js';
import { highlightCode } from '../data/highlight.js';
import { startQuiz } from './quiz.js';

// Late-bound dependencies
let _renderDiagram = null;
export function setMissionDeps(deps) {
  if (deps.renderDiagram) _renderDiagram = deps.renderDiagram;
}

export function renderChapterDetail(ch) {
  const wrap = h('div', null);

  // Back button
  wrap.appendChild(h('button', {
    onClick: () => { S.chapterIdx = null; render(); },
    style: { marginBottom: '16px', fontSize: '13px' }
  }, '\u2190 Chapitres'));

  // Chapter header
  wrap.appendChild(h('div', { style: { marginBottom: '20px' } },
    h('div', { style: { fontSize: '12px', color: 'var(--tx3)', marginBottom: '4px' } }, `Chapitre ${ch.id} \u2014 ${ch.domainPL}`),
    h('h2', { style: { fontSize: '22px', fontWeight: '600', marginBottom: '8px' } }, ch.title),
    h('div', { style: { fontSize: '13px', color: 'var(--tx2)' } }, `Missions ${ch.missions[0]}-${ch.missions[1]} sur ${getTotalMissions()}`)
  ));

  // Objectives as plain text
  wrap.appendChild(h('p', { style: { fontSize: '14px', lineHeight: '1.75', color: 'var(--tx2)', marginBottom: '16px' } },
    ch.objectives
  ));

  // Recap as subtle text
  if (ch.recap) {
    wrap.appendChild(h('p', { style: { fontSize: '13px', lineHeight: '1.6', color: 'var(--tx3)', fontStyle: 'italic', marginBottom: '16px' } },
      'Pr\u00e9requis : ', ch.recap
    ));
  }

  // Interview as inline Q&A
  if (ch.interview) {
    wrap.appendChild(h('div', { style: { fontSize: '13px', lineHeight: '1.6', marginBottom: '20px', padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--bg2)' } },
      h('span', { style: { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx3)', display: 'block', marginBottom: '4px' } }, 'Question d\'entretien'),
      h('strong', null, ch.interview.q), ' \u2014 ',
      ch.interview.a
    ));
  }

  // Sections
  ch.sections.forEach(sec => {
    wrap.appendChild(h('div', { className: 'section-title' },
      h('span', { className: 'section-id' }, sec.id),
      sec.title
    ));

    // Theory as plain text paragraph
    if (sec.theory) {
      wrap.appendChild(h('p', { style: { fontSize: '14px', lineHeight: '1.75', marginBottom: '14px', color: 'var(--tx)' } }, sec.theory));
    }

    // Business context merged as a second paragraph (no colored box)
    if (sec.business) {
      wrap.appendChild(h('p', { style: { fontSize: '14px', lineHeight: '1.75', marginBottom: '14px', color: 'var(--tx2)' } }, sec.business));
    }

    if (sec.code) {
      const codeBlock = h('div', { className: 'code-block' });
      codeBlock.innerHTML = highlightCode(sec.code);
      const copyBtn = h('button', { className: 'copy-btn', onClick: () => {
        navigator.clipboard.writeText(sec.code).then(() => { copyBtn.textContent = 'Copi\u00e9 !'; setTimeout(() => copyBtn.textContent = 'Copier', 1500); });
      }}, 'Copier');
      codeBlock.appendChild(copyBtn);
      wrap.appendChild(codeBlock);
    }

    if (sec.result) {
      const table = h('table', { className: 'mini-table' },
        h('thead', null, h('tr', null, ...sec.result.headers.map(hd => h('th', null, hd)))),
        h('tbody', null, ...sec.result.rows.map(row =>
          h('tr', null, ...row.map(cell => h('td', null, cell)))
        ))
      );
      wrap.appendChild(table);
    }

    // Tip as subtle italic line (no box)
    if (sec.tip) {
      wrap.appendChild(h('p', { style: { fontSize: '13px', lineHeight: '1.6', color: 'var(--tx3)', fontStyle: 'italic', marginBottom: '14px' } },
        '\u25B8 ', sec.tip
      ));
    }

    // SVG diagrams for specific sections
    if (sec.id === '3.1') wrap.appendChild(_renderDiagram('star-schema'));
    if (sec.id === '4.2') wrap.appendChild(_renderDiagram('calculate-flow'));
    if (sec.id === '2.1') wrap.appendChild(_renderDiagram('pq-pipeline'));

    if (sec.deep) {
      const deepContent = h('div', { style: { display: 'none', fontSize: '14px', lineHeight: '1.75', color: 'var(--tx2)', marginBottom: '14px', whiteSpace: 'pre-line' } }, sec.deep);
      const deepToggle = h('button', {
        style: { fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', padding: '0', marginBottom: '14px' },
        onClick: () => {
          const visible = deepContent.style.display !== 'none';
          deepContent.style.display = visible ? 'none' : 'block';
          deepToggle.textContent = visible ? '\u25B8 En savoir plus' : 'Masquer';
        }
      }, '\u25B8 En savoir plus');
      wrap.appendChild(deepToggle);
      wrap.appendChild(deepContent);
    }
  });

  // Errors
  if (ch.errors && ch.errors.length) {
    wrap.appendChild(h('div', { className: 'section-title' }, 'Erreurs courantes'));
    wrap.appendChild(h('div', { className: 'box box-error' },
      h('span', { className: 'box-label' }, 'Ce qu\'il ne faut PAS faire'),
      ...ch.errors.map(e => h('div', { style: { marginBottom: '4px', fontSize: '14px' } },
        h('span', { style: { color: 'var(--red)' } }, e.bad),
        ' \u2192 ',
        h('span', { style: { color: 'var(--green)' } }, e.good)
      ))
    ));
  }

  // PL-300 traps
  if (ch.pl300 && ch.pl300.length) {
    wrap.appendChild(h('div', { className: 'box box-pl300' },
      h('span', { className: 'box-label' }, 'Pi\u00e8ges PL-300'),
      ...ch.pl300.map(p => h('div', { style: { fontSize: '14px', marginBottom: '4px' } }, p))
    ));
  }

  // Checklist (s\u00e9par\u00e9 des missions \u2014 ne compte PAS dans la progression)
  if (ch.checklist && ch.checklist.length) {
    const clKey = 'cl-' + ch.id;
    wrap.appendChild(h('div', { className: 'box', style: { background: 'var(--bg2)', borderColor: 'var(--bd)' } },
      h('span', { className: 'box-label' }, 'Checklist fin de chapitre'),
      ...ch.checklist.map((item, i) => {
        const chkId = `${clKey}-${i}`;
        const checked = S.checklist[chkId];
        return h('div', { style: { marginBottom: '4px' } },
          h('label', { style: { fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' } },
            h('input', { type: 'checkbox', ...(checked ? { checked: 'checked' } : {}), onChange: () => {
              S.checklist[chkId] = !S.checklist[chkId];
              save(); render();
            }}),
            item
          )
        );
      })
    ));
  }

  // Bridge as plain transition text
  if (ch.bridge) {
    wrap.appendChild(h('p', { style: { fontSize: '13px', lineHeight: '1.6', color: 'var(--tx3)', fontStyle: 'italic', marginTop: '20px', marginBottom: '20px' } },
      '\u2192 ', ch.bridge
    ));
  }

  // Missions
  wrap.appendChild(h('div', { className: 'section-title' }, `Missions ${ch.missions[0]} \u00e0 ${ch.missions[1]}`));
  const chMissions = window.MISSIONS.filter(m => m.ch === ch.id);
  chMissions.forEach(m => wrap.appendChild(renderMission(m)));

  // Racing Games section
  if (typeof window.RACING_MISSIONS !== 'undefined') {
    var racingMs = window.RACING_MISSIONS.filter(function(rm) { return rm.ch === ch.id; });
    if (racingMs.length > 0) {
      var racingSection = h('div', { className: 'racing-section' });
      racingSection.appendChild(h('div', { className: 'racing-section-title' },
        icon('flag', 18),
        'Applique sur ton projet \u2014 Racing Games'
      ));
      racingSection.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx2)', marginBottom: '14px' } },
        racingMs.length + ' missions pour appliquer ce chapitre sur le projet Racing Games (base racing_prices).'
      ));
      racingMs.forEach(function(rm) { racingSection.appendChild(renderMission(rm)); });
      wrap.appendChild(racingSection);
    }
  }

  // Interactive missions
  if (typeof window.INTERACTIVE_MISSIONS !== 'undefined') {
    var interactiveMissions = window.INTERACTIVE_MISSIONS.filter(function(im) { return im.ch === ch.id; });
    if (interactiveMissions.length > 0) {
      wrap.appendChild(h('div', { className: 'section-title' }, 'Missions interactives'));
      interactiveMissions.forEach(function(im) {
        wrap.appendChild(renderInteractiveMission(im));
      });
    }
  }

  // Quiz de validation du chapitre
  const chQuizQs = window.QUIZ.filter(q => q.ch === ch.id);
  if (chQuizQs.length > 0) {
    wrap.appendChild(h('div', { className: 'section-title' }, `Quiz de validation \u2014 Chapitre ${ch.id}`));
    wrap.appendChild(h('div', { style: { marginBottom: '12px', fontSize: '13px', color: 'var(--tx2)' } },
      `${chQuizQs.length} questions cibl\u00e9es sur ce chapitre. Teste tes connaissances avant de passer au suivant.`
    ));
    wrap.appendChild(h('button', {
      onClick: () => { S.tab = 'quiz'; startQuiz('ch' + ch.id, 'training'); },
      style: { padding: '10px 24px', fontSize: '14px', fontWeight: '500', background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' }
    }, `Lancer le quiz Ch.${ch.id} (${chQuizQs.length} questions)`));
  }

  // Navigation chapitres
  wrap.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--bd)' } },
    ch.id > 1 ? h('button', { onClick: () => { S.chapterIdx = ch.id - 2; window.scrollTo(0, 0); render(); } }, `\u2190 Ch.${ch.id - 1}`) : h('div'),
    ch.id < 7 ? h('button', { onClick: () => { S.chapterIdx = ch.id; window.scrollTo(0, 0); render(); }, style: { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent)' } }, `Ch.${ch.id + 1} \u2192`) : h('div')
  ));

  return wrap;
}

export function renderMission(m) {
  var mKey = m.id;
  // Support racing missions keyed differently
  if (typeof m.id === 'string' && m.id.startsWith('r')) mKey = 'racing_' + m.id;
  const done = S.missions[mKey];
  const typeLabels = { standard: null, debug: 'DEBUG', brief: 'BRIEF', pl300: 'PL-300', dax: 'DAX', action: 'ACTION' };
  const typeClasses = { standard: '', debug: 'debug', brief: 'brief', pl300: 'pl300', dax: 'pl300', action: 'brief' };
  const spoilerId = 'spoiler-' + m.id;
  var missionType = m.type || 'standard';
  var isDax = missionType === 'dax';
  var inputStateKey = '_mission_input_' + m.id;
  var checkedStateKey = '_mission_checked_' + m.id;
  var correctStateKey = '_mission_correct_' + m.id;
  var hintStateKey = '_mission_hint_' + m.id;

  const mission = h('div', { className: 'mission' + (done ? ' mission-done' : '') });
  // Header
  mission.appendChild(h('div', { className: 'mission-header' },
    h('span', { className: 'mission-num' }, '#' + m.id),
    missionType !== 'standard' && typeLabels[missionType] ? h('span', { className: 'mission-type ' + (typeClasses[missionType] || '') }, typeLabels[missionType]) : null,
    m.title ? h('span', { style: { fontSize: '13px', fontWeight: '500', marginLeft: '4px' } }, m.title) : null,
    h('div', { style: { flex: '1' } }),
    h('button', {
      className: 'done-btn' + (done ? ' checked' : ''),
      onClick: function(e) {
        e.stopPropagation();
        var wasDone = S.missions[mKey];
        S.missions[mKey] = !S.missions[mKey];
        if (!wasDone && S.missions[mKey] && typeof window.XP_REWARDS !== 'undefined') {
          addXP(m.xp || window.XP_REWARDS.mission, 'Mission');
          // Check chapter complete
          var ch = window.CHAPTERS.find(function(c) { return c.id === m.ch; });
          if (ch) {
            var allDone = true;
            for (var i = ch.missions[0]; i <= ch.missions[1]; i++) { if (!S.missions[i]) { allDone = false; break; } }
            if (allDone && typeof window.XP_REWARDS !== 'undefined') addXP(window.XP_REWARDS.chapter_complete, 'Chapitre ' + ch.id);
          }
        }
        save(); render();
      }
    }, done ? h('span', null, icon('check', 12), ' Fait') : 'Marquer fait')
  ));
  // Brief text
  mission.appendChild(h('div', { className: 'mission-text' }, m.text));

  // DAX editor for DAX missions
  if (isDax && !done) {
    var editorDiv = h('div', { className: 'mission-editor' });
    var taClass = 'dax-editor';
    if (S[checkedStateKey] && S[correctStateKey]) taClass += ' dax-correct';
    else if (S[checkedStateKey] && !S[correctStateKey]) taClass += ' dax-wrong';
    var ta = h('textarea', {
      className: taClass,
      placeholder: 'Ecris ta mesure DAX ici...',
      onInput: function(e) { S[inputStateKey] = e.target.value; }
    });
    ta.value = S[inputStateKey] || '';
    if (S[checkedStateKey]) ta.setAttribute('readonly', 'true');
    editorDiv.appendChild(ta);

    if (!S[checkedStateKey]) {
      var btnRow = h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } });
      btnRow.appendChild(h('button', {
        onClick: function() {
          var input = (S[inputStateKey] || '').trim();
          if (!input) return;
          S[checkedStateKey] = true;
          var correct = false;
          if (m.expectedPattern && m.expectedPattern.test(input)) correct = true;
          if (!correct && m.altPatterns) {
            for (var i = 0; i < m.altPatterns.length; i++) { if (m.altPatterns[i].test(input)) { correct = true; break; } }
          }
          S[correctStateKey] = correct;
          if (correct) {
            S.missions[mKey] = true;
            if (typeof window.XP_REWARDS !== 'undefined') addXP(m.xp || window.XP_REWARDS.exercise, 'DAX Mission');
          }
          save(); render();
        },
        style: { padding: '8px 20px', fontWeight: '500', background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
      }, 'V\u00e9rifier'));
      // Hint buttons
      if (m.hints && m.hints.length > 0) {
        var hintLvl = S[hintStateKey] || 0;
        if (hintLvl < m.hints.length) {
          btnRow.appendChild(h('button', {
            onClick: function() { S[hintStateKey] = (S[hintStateKey] || 0) + 1; render(); },
            style: { background: 'var(--yellow-bg)', color: '#9A6700', borderColor: '#F0AD4E' }
          }, 'Indice ' + (hintLvl + 1)));
        }
      }
      editorDiv.appendChild(btnRow);
      // Show hints
      var hLvl = S[hintStateKey] || 0;
      if (hLvl > 0 && m.hints) {
        for (var hi = 0; hi < Math.min(hLvl, m.hints.length); hi++) {
          editorDiv.appendChild(h('div', { className: 'box box-tip', style: { marginTop: '8px' } },
            h('span', { className: 'box-label' }, 'Indice ' + (hi + 1)), m.hints[hi]
          ));
        }
      }
    }
    // Feedback
    if (S[checkedStateKey]) {
      if (S[correctStateKey]) {
        editorDiv.appendChild(h('div', { className: 'mission-feedback correct' }, icon('check', 14), ' Correct !'));
      } else {
        editorDiv.appendChild(h('div', { className: 'mission-feedback wrong' }, 'Pas tout a fait...'));
        editorDiv.appendChild(h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          h('button', { onClick: function() { S[checkedStateKey] = false; S[correctStateKey] = false; render(); } }, 'Reessayer'),
          h('button', { onClick: function() { S[checkedStateKey] = true; S[correctStateKey] = false; render(); var el = document.getElementById(spoilerId); if (el) el.classList.add('open'); }, style: { color: 'var(--tx3)' } }, 'Voir la solution')
        ));
      }
    }
    mission.appendChild(editorDiv);
  }

  // Spoiler (corrig\u00e9)
  mission.appendChild(h('div', { className: 'spoiler' },
    h('button', { className: 'spoiler-btn', onClick: function() {
      var el = document.getElementById(spoilerId);
      if (el) el.classList.toggle('open');
    }}, 'Voir le corrig\u00e9'),
    h('div', { className: 'spoiler-content', id: spoilerId },
      m.hint ? h('div', { style: { marginBottom: '6px', color: 'var(--tx3)', fontSize: '12px' } }, m.hint) : null,
      m.hints && m.hints.length ? h('div', { style: { marginBottom: '6px', color: 'var(--tx3)', fontSize: '12px' } }, m.hints.join(' | ')) : null,
      h('div', null, h('strong', null, 'Solution : '), m.solution),
      m.why ? h('div', { className: 'why', style: { fontStyle: 'italic', color: 'var(--tx2)', marginTop: '6px' } }, m.why) : null
    )
  ));
  return mission;
}

export function renderInteractiveMission(im) {
  var stateKey = '_im_' + im.id;
  var done = S.missions[im.id];
  var card = h('div', { className: 'mission' + (done ? ' mission-done' : '') });
  var typeBadge = im.type === 'find_error' ? 'TROUVE L\'ERREUR' : im.type === 'fill_blank' ? 'COMPLETE' : 'ORDONNE';
  var typeColor = im.type === 'find_error' ? 'var(--red)' : im.type === 'fill_blank' ? 'var(--purple)' : 'var(--accent)';

  card.appendChild(h('div', { className: 'mission-header' },
    h('span', { className: 'mission-type', style: { background: typeColor + '18', color: typeColor } }, typeBadge),
    im.title ? h('span', { style: { fontSize: '13px', fontWeight: '500', marginLeft: '8px' } }, im.title) : null,
    h('div', { style: { flex: '1' } }),
    done ? h('span', { style: { fontSize: '12px', color: 'var(--green)' } }, icon('check', 14), ' Fait') : null
  ));
  card.appendChild(h('div', { className: 'mission-text', style: { marginBottom: '12px' } }, im.text));

  if (im.type === 'find_error' && !done) {
    // Show code with line numbers, click to select error line
    var codeBlock = h('div', { className: 'code-block', style: { cursor: 'pointer' } });
    codeBlock.innerHTML = highlightCode(im.code);
    card.appendChild(codeBlock);
    var selectedLine = S[stateKey + '_line'];
    var checked = S[stateKey + '_checked'];
    if (!checked) {
      card.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx3)', marginBottom: '8px' } }, 'Identifie le probleme dans ce code.'));
      card.appendChild(h('button', {
        onClick: function() {
          S[stateKey + '_checked'] = true;
          S.missions[im.id] = true;
          addXP(im.xp || 20, 'Mission interactive');
          save(); render();
        },
        style: { padding: '8px 20px', fontWeight: '500', background: typeColor, color: 'white', border: 'none', borderRadius: 'var(--radius)' }
      }, 'J\'ai trouve !'));
    }
    if (checked || done) {
      card.appendChild(h('div', { className: 'mission-feedback correct', style: { marginTop: '8px' } },
        h('strong', null, 'Explication : '), im.errorExplanation
      ));
      card.appendChild(h('div', { style: { marginTop: '8px' } },
        h('div', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--green)', marginBottom: '4px' } }, 'Version corrigee :'),
        Object.assign(h('div', { className: 'code-block' }), { innerHTML: highlightCode(im.solution) })
      ));
    }
  } else if (im.type === 'fill_blank' && !done) {
    // Show template with blanks
    card.appendChild(h('div', { className: 'code-block', style: { fontSize: '14px' } },
      h('span', null, im.template.replace(/_____/g, '______'))
    ));
    var inputVal = S[stateKey + '_input'] || '';
    var checked2 = S[stateKey + '_checked'];
    if (!checked2) {
      card.appendChild(h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
        h('input', {
          type: 'text',
          placeholder: 'Tape la fonction manquante...',
          value: inputVal,
          onInput: function(e) { S[stateKey + '_input'] = e.target.value; },
          style: { flex: '1', padding: '8px 12px', fontSize: '14px', fontFamily: 'var(--mono)', border: '1px solid var(--bd)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--tx)' }
        }),
        h('button', {
          onClick: function() {
            var input = (S[stateKey + '_input'] || '').trim().toUpperCase();
            S[stateKey + '_checked'] = true;
            var correct = im.blanks.some(function(b) { return input === b.toUpperCase(); });
            S[stateKey + '_correct'] = correct;
            if (correct) { S.missions[im.id] = true; addXP(im.xp || 15, 'Mission interactive'); }
            save(); render();
          },
          style: { padding: '8px 20px', fontWeight: '500', background: typeColor, color: 'white', border: 'none', borderRadius: 'var(--radius)' }
        }, 'Verifier')
      ));
      if (im.hints && im.hints.length > 0) {
        card.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--tx3)', fontStyle: 'italic', marginTop: '6px' } }, 'Indice : ' + im.hints[0]));
      }
    }
    if (checked2) {
      if (S[stateKey + '_correct']) {
        card.appendChild(h('div', { className: 'mission-feedback correct', style: { marginTop: '8px' } }, icon('check', 14), ' Correct ! La reponse est : ' + im.blanks[0]));
      } else {
        card.appendChild(h('div', { className: 'mission-feedback wrong', style: { marginTop: '8px' } }, 'La bonne reponse etait : ' + im.blanks[0]));
        card.appendChild(h('button', { onClick: function() { S[stateKey + '_checked'] = false; S[stateKey + '_input'] = ''; render(); }, style: { marginTop: '6px', fontSize: '12px' } }, 'Reessayer'));
      }
    }
  } else if (im.type === 'order_steps' && !done) {
    // Drag-and-drop ordering (simplified: click to build order)
    var userOrder = S[stateKey + '_order'] || [];
    var remaining = im.steps.filter(function(_, i) { return userOrder.indexOf(i) === -1; });
    card.appendChild(h('div', { style: { fontSize: '13px', color: 'var(--tx3)', marginBottom: '8px' } }, 'Clique les etapes dans le bon ordre :'));
    // Show selected order
    if (userOrder.length > 0) {
      var selectedDiv = h('div', { style: { marginBottom: '10px' } });
      userOrder.forEach(function(stepIdx, pos) {
        selectedDiv.appendChild(h('div', { className: 'guided-step active', style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { className: 'step-number done' }, String(pos + 1)),
          h('span', null, im.steps[stepIdx]),
          h('button', {
            onClick: function() { S[stateKey + '_order'] = userOrder.filter(function(_, i) { return i !== pos; }); render(); },
            style: { marginLeft: 'auto', fontSize: '11px', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }
          }, 'x')
        ));
      });
      card.appendChild(selectedDiv);
    }
    // Show remaining choices
    if (remaining.length > 0) {
      var choicesDiv = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' } });
      im.steps.forEach(function(step, i) {
        if (userOrder.indexOf(i) !== -1) return;
        choicesDiv.appendChild(h('button', {
          onClick: function() {
            if (!S[stateKey + '_order']) S[stateKey + '_order'] = [];
            S[stateKey + '_order'].push(i);
            render();
          },
          style: { fontSize: '13px', padding: '6px 12px' }
        }, step));
      });
      card.appendChild(choicesDiv);
    }
    // Check button
    if (userOrder.length === im.steps.length) {
      var isCorrect = im.correctOrder.every(function(v, i) { return userOrder[i] === v; });
      if (!S[stateKey + '_checked']) {
        card.appendChild(h('button', {
          onClick: function() {
            S[stateKey + '_checked'] = true;
            if (isCorrect) { S.missions[im.id] = true; addXP(im.xp || 20, 'Mission interactive'); }
            save(); render();
          },
          style: { padding: '8px 20px', fontWeight: '500', background: typeColor, color: 'white', border: 'none', borderRadius: 'var(--radius)' }
        }, 'Verifier l\'ordre'));
      } else {
        if (isCorrect) {
          card.appendChild(h('div', { className: 'mission-feedback correct', style: { marginTop: '8px' } }, icon('check', 14), ' Ordre correct !'));
        } else {
          card.appendChild(h('div', { className: 'mission-feedback wrong', style: { marginTop: '8px' } }, 'Pas dans le bon ordre. ' + im.solution));
          card.appendChild(h('button', { onClick: function() { S[stateKey + '_order'] = []; S[stateKey + '_checked'] = false; render(); }, style: { marginTop: '6px', fontSize: '12px' } }, 'Reessayer'));
        }
      }
    }
  }

  // Show solution for completed interactive missions
  if (done && im.solution) {
    card.appendChild(h('div', { className: 'spoiler' },
      h('button', { className: 'spoiler-btn', onClick: function() {
        var el = document.getElementById('sp-' + im.id);
        if (el) el.classList.toggle('open');
      }}, 'Voir la solution'),
      h('div', { className: 'spoiler-content', id: 'sp-' + im.id },
        h('div', null, h('strong', null, 'Solution : '), im.solution)
      )
    ));
  }
  return card;
}
