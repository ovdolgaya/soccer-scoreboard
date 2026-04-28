// Service Worker for Soccer Scoreboard PWA
// Strategy: Network-first for everything (app requires live Firebase data)
// Only caches static shell files so the app loads offline gracefully

const CACHE_NAME = 'scoreboard-v5';

const STATIC_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app-layout.css',
  './match-helpers.js',
  './match-management.js',
  './match-control.js',
  './match-edit-modal.js',
  './goal-tracking.js',
  './roster-thumbnail-helper.js',
  './roster.js',
  './roster-styles.css',
  './auth.js',
  './nav.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Streaming widgets
  './widget.html',
  './goals-widget.html',
  './broadcast-widget.html',
  './broadcast-widget.css',
  './broadcast-widget-2k.css',
  './broadcast-widget-canvas.js',
  './broadcast-widget-scoreboard.js',
  './broadcast-widget-sequences.js',
  // Shared widget modules
  './widget-shared.css',
  './widget-shared-2k.css',
  './widget-shared.js',
  './widget-goal-listener.js',
  // Vertical widget
  './vertical-widget.html',
  // Firebase widget config
  './firebase-config-widget.js',
  // Player/coach placeholder images
  './soccerplayer.png',
  './soccerplayer_blue.png',
  './soccerplayer_yellow.png',
  './goalkeeper.png',
  './goalkeeper_blue.png',
  './goalkeeper_yellow.png',
  './coach.png',
  './coach_yellow.png',
  './football.png'
];

// Install: cache static shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        STATIC_SHELL.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.error('[SW] Failed to cache:', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first
// Firebase, CDN, and API calls always go to network.
// Static shell falls back to cache if offline.
self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  // Always bypass service worker for Firebase and external CDN requests
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.includes('cdnjs.cloudflare.com') ||
      url.includes('firebase')) {
    return; // Let browser handle directly
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Update cache with fresh version
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(function() {
        // Network failed — serve from cache
        return caches.match(event.request);
      })
  );
});
