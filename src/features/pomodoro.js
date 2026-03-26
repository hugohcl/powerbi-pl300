import { S } from '../core/state.js';
import { render } from '../core/render.js';

function _startInterval() {
  if (S.pomodoro.interval) clearInterval(S.pomodoro.interval);
  S.pomodoro.interval = setInterval(function() {
    S.pomodoro.timeLeft--;
    if (S.pomodoro.timeLeft <= 0) pomodoroNext();
    updatePomodoroDisplay();
  }, 1000);
}

export function startPomodoro() {
  S.pomodoro.active = true;
  S.pomodoro.mode = 'work';
  S.pomodoro.timeLeft = 25 * 60;
  S.pomodoro.cycle = 0;
  S.pomodoro.paused = false;
  S.pomodoro.dropdownOpen = false;
  _startInterval();
  render();
}

export function pomodoroNext() {
  if (S.pomodoro.mode === 'work') {
    S.pomodoro.cycle++;
    if (S.pomodoro.cycle >= 4) {
      S.pomodoro.mode = 'longBreak';
      S.pomodoro.timeLeft = 15 * 60;
      S.pomodoro.cycle = 0;
    } else {
      S.pomodoro.mode = 'break';
      S.pomodoro.timeLeft = 5 * 60;
    }
  } else {
    S.pomodoro.mode = 'work';
    S.pomodoro.timeLeft = 25 * 60;
  }
  try {
    var ctx = new AudioContext();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = S.pomodoro.mode === 'work' ? 523 : 659;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
  render();
}

export function updatePomodoroDisplay() {
  var el = document.getElementById('pomodoro-time');
  if (el) {
    var m = Math.floor(S.pomodoro.timeLeft / 60);
    var s = S.pomodoro.timeLeft % 60;
    el.textContent = m + ':' + String(s).padStart(2, '0');
  }
  var modeEl = document.getElementById('pomodoro-mode-label');
  if (modeEl) {
    var labels = { work: 'Focus', break: 'Pause', longBreak: 'Pause longue' };
    modeEl.textContent = labels[S.pomodoro.mode] || '';
  }
}

export function stopPomodoro() {
  clearInterval(S.pomodoro.interval);
  S.pomodoro.active = false;
  S.pomodoro.interval = null;
  S.pomodoro.dropdownOpen = false;
  render();
}

export function pausePomodoro() {
  if (S.pomodoro.paused) {
    S.pomodoro.paused = false;
    _startInterval();
  } else {
    if (S.pomodoro.interval) clearInterval(S.pomodoro.interval);
    S.pomodoro.interval = null;
    S.pomodoro.paused = true;
  }
  render();
}

export function resetPomodoro() {
  S.pomodoro.mode = 'work';
  S.pomodoro.timeLeft = 25 * 60;
  S.pomodoro.cycle = 0;
  S.pomodoro.paused = false;
  _startInterval();
  render();
}
