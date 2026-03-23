import { S, save } from './state.js';
import { icon } from './icons.js';

export const APP_VERSION = '4.4.3';

// ─── Render proxy ───
let _renderFn = null;
export function setRenderFn(fn) { _renderFn = fn; }
export function render() { if (_renderFn) _renderFn(); }

// ─── Helpers ───
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.flat(3).forEach(c => {
    if (c == null || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}
export function shuf(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function qHash(q) { return q.q.slice(0, 40); }
export function trackQuizAnswer() {
  var today = new Date().toISOString().slice(0, 10);
  if (!S.weeklyQuizLog) S.weeklyQuizLog = [];
  var last = S.weeklyQuizLog.length > 0 ? S.weeklyQuizLog[S.weeklyQuizLog.length - 1] : null;
  if (last && last.date === today) last.count++;
  else S.weeklyQuizLog.push({ date: today, count: 1 });
  // Keep 14 days max
  if (S.weeklyQuizLog.length > 14) S.weeklyQuizLog = S.weeklyQuizLog.slice(-14);
}
export function $(sel) { return document.querySelector(sel); }
export function getTotalMissions() { return window.CHAPTERS.reduce(function(s, c) { return s + (c.missions[1] - c.missions[0] + 1); }, 0); }

// ─── Theme ───
export function initTheme() {
  const saved = localStorage.getItem('pbi-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
}
export function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('pbi-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('pbi-theme', 'dark');
  }
  render();
}

export function isMobile() { return window.innerWidth <= 600; }
