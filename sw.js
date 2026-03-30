const CACHE_NAME = 'pl300-v5.1.5';
const ASSETS = [
  './',
  './index.html',
  './app.js?v=5.1.5',
  './data.js?v=5.1.5',
  './src/core/state.js',
  './src/core/render.js',
  './src/core/icons.js',
  './src/data/highlight.js',
  './src/features/gamification.js',
  './src/features/sync.js',
  './src/features/flashcards.js',
  './src/features/quiz.js',
  './src/features/missions.js',
  './src/features/exercises.js',
  './src/features/pomodoro.js',
  './src/features/chat.js',
  './src/features/search.js',
  './src/ui/sidebar.js',
  './src/ui/home.js',
  './src/ui/formation.js',
  './src/ui/progress.js',
  './src/ui/reference.js',
  './src/ui/interview.js',
  './icon.png',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        ASSETS.map(url => fetch(url, { cache: 'reload' }).then(res => cache.put(url, res)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: network first, no cache fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Static assets: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return res;
    }))
  );
});
