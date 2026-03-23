// ═══════════════════════════════════════════════════════════
// SMOKE TESTS — DAX Academy
// Run: node tests/smoke.js
// ═══════════════════════════════════════════════════════════
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function quote(p) { return '"' + p + '"'; }

function test(name, fn) {
  try {
    fn();
    console.log('  \u2713 ' + name);
    passed++;
  } catch (e) {
    console.log('  \u2717 ' + name + ' — ' + e.message);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('\nDAX Academy — Smoke Tests\n');

// ── Syntax checks ──
console.log('Syntax:');

var jsFiles = [
  'app.js',
  'data.js',
  'src/core/state.js',
  'src/core/render.js',
  'src/core/icons.js',
  'src/data/highlight.js',
  'src/features/gamification.js',
  'src/features/sync.js',
  'src/features/flashcards.js',
  'src/features/quiz.js',
  'src/features/missions.js',
  'src/features/exercises.js',
  'src/features/pomodoro.js',
  'src/features/chat.js',
  'src/features/search.js',
  'src/ui/sidebar.js',
  'src/ui/home.js',
  'src/ui/formation.js',
  'src/ui/progress.js',
  'src/ui/reference.js',
  'src/ui/interview.js'
];

jsFiles.forEach(function(f) {
  test(f + ' syntax valid', function() {
    execSync('node --check ' + quote(path.join(ROOT, f)), { stdio: 'pipe' });
  });
});

test('server/server.js syntax valid', function() {
  execSync('node --check ' + quote(path.join(ROOT, 'server', 'server.js')), { stdio: 'pipe' });
});

// ── Load data.js ──
console.log('\nData integrity:');

var src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
// Remove const/let/var declarations to make them global in eval
src = src.replace(/^const /gm, 'var ').replace(/^let /gm, 'var ');
// Provide window mock for data.js window assignments
if (typeof window === 'undefined') { global.window = global; }
eval(src);

test('CHAPTERS defined and has 7 entries', function() {
  assert(typeof CHAPTERS !== 'undefined', 'CHAPTERS not defined');
  assert(CHAPTERS.length === 7, 'Expected 7 chapters, got ' + CHAPTERS.length);
});

test('MISSIONS defined and has 100+ entries', function() {
  assert(typeof MISSIONS !== 'undefined', 'MISSIONS not defined');
  assert(MISSIONS.length >= 100, 'Expected 100+ missions, got ' + MISSIONS.length);
});

test('FLASHCARDS defined and has 70+ entries', function() {
  assert(typeof FLASHCARDS !== 'undefined', 'FLASHCARDS not defined');
  assert(FLASHCARDS.length >= 70, 'Expected 70+ flashcards, got ' + FLASHCARDS.length);
});

test('All missions have id and text fields', function() {
  var bad = MISSIONS.filter(function(m) { return !m.id || !m.text; });
  assert(bad.length === 0, bad.length + ' missions missing id or text: ' + bad.map(function(m) { return m.id; }).join(', '));
});

test('All missions have solution field', function() {
  var bad = MISSIONS.filter(function(m) { return !m.solution; });
  assert(bad.length === 0, bad.length + ' missions missing solution: ids ' + bad.map(function(m) { return m.id; }).join(', '));
});

test('All flashcards have front (f) and back (b) fields', function() {
  var bad = FLASHCARDS.filter(function(fc) { return !fc.f || !fc.b; });
  assert(bad.length === 0, bad.length + ' flashcards missing f or b');
});

test('All chapters have title and missions range', function() {
  var bad = CHAPTERS.filter(function(ch) { return !ch.title || !ch.missions; });
  assert(bad.length === 0, bad.length + ' chapters missing title or missions');
});

test('Chapter mission ranges are valid (start <= end)', function() {
  CHAPTERS.forEach(function(ch) {
    assert(ch.missions[0] <= ch.missions[1], ch.title + ': missions range invalid [' + ch.missions + ']');
  });
});

test('All chapters have sections with theory', function() {
  CHAPTERS.forEach(function(ch) {
    assert(ch.sections && ch.sections.length > 0, ch.title + ': no sections');
    ch.sections.forEach(function(sec, i) {
      assert(sec.theory, ch.title + ' section ' + i + ': missing theory');
    });
  });
});

// ── Version alignment ──
console.log('\nVersioning:');

var renderSrc = fs.readFileSync(path.join(ROOT, 'src', 'core', 'render.js'), 'utf8');
var appVersionMatch = renderSrc.match(/APP_VERSION\s*=\s*'([^']+)'/);
var appVersion = appVersionMatch ? appVersionMatch[1] : null;

test('APP_VERSION found in src/core/render.js', function() {
  assert(appVersion, 'APP_VERSION not found');
});

var swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
var swVersionMatch = swSrc.match(/pl300-v([^']+)'/);
var swVersion = swVersionMatch ? swVersionMatch[1] : null;

test('Version found in sw.js', function() {
  assert(swVersion, 'Version not found in sw.js CACHE_NAME');
});

test('APP_VERSION matches sw.js version', function() {
  assert(appVersion === swVersion, 'Version mismatch: render.js=' + appVersion + ' sw.js=' + swVersion);
});

// ── Summary ──
console.log('\n' + (passed + failed) + ' tests, ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
