var V = 'itlaa-v1';
var SHELL = ['index.html', 'style.css', 'app.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== V; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url); if (u.origin !== location.origin) return;
  var fresh = /\.json$/.test(u.pathname) || r.mode === 'navigate';
  if (fresh) e.respondWith(fetch(r).then(function (res) { var c = res.clone(); caches.open(V).then(function (ch) { ch.put(r, c); }); return res; }).catch(function () { return caches.match(r).then(function (m) { return m || caches.match('index.html'); }); }));
  else e.respondWith(caches.match(r).then(function (m) { return m || fetch(r); }));
});
