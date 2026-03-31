// ─── Sound Effects (Web Audio API, no external files) ───
import { S } from '../core/state.js';

let _audioCtx = null;

function getCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (iOS requirement)
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function playTone(freq, duration, waveform, volume) {
  try {
    var ctx = getCtx();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = waveform || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

export function playCorrect() {
  if (!S.soundEnabled) return;
  // Two ascending tones: C5 → E5
  playTone(523, 0.12, 'sine', 0.08);
  setTimeout(function() { playTone(659, 0.15, 'sine', 0.08); }, 80);
}

export function playWrong() {
  if (!S.soundEnabled) return;
  // Low descending tone
  try {
    var ctx = getCtx();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

export function playLevelUp() {
  if (!S.soundEnabled) return;
  // Ascending arpeggio: C5-E5-G5-C6
  var notes = [523, 659, 784, 1047];
  notes.forEach(function(freq, i) {
    setTimeout(function() { playTone(freq, 0.18, 'sine', 0.07); }, i * 100);
  });
}

export function playBadge() {
  if (!S.soundEnabled) return;
  // Sparkle: high quick tones
  var notes = [880, 1100, 1320, 1760];
  notes.forEach(function(freq, i) {
    setTimeout(function() { playTone(freq, 0.08, 'sine', 0.05); }, i * 60);
  });
}

export function playXP() {
  if (!S.soundEnabled) return;
  // Quick subtle ding
  playTone(1200, 0.06, 'sine', 0.04);
}

export function playClick() {
  if (!S.soundEnabled) return;
  playTone(800, 0.03, 'sine', 0.03);
}
