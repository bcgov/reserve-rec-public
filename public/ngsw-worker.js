// Safety worker for the v1 Day Use Pass app's Angular service worker.
//
// v1 registered ngsw-worker.js at reserve.bcparks.ca/dayuse/ before this app
// took over the host. That worker serves its cached v1 shell for every
// navigation under /dayuse/, so returning visitors see v1's "page not found"
// on any v2 deep link. Angular's ngsw only self-unregisters on a 404 manifest,
// and S3 answers missing keys with 403, so it never notices the cutover.
//
// The browser refetches this URL on navigation; this replacement worker
// unregisters itself, drops the ngsw caches and reloads the open tabs so they
// load v2 from the network. Based on @angular/service-worker/safety-worker.js.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const names = await caches.keys();
      await Promise.all(names.filter((n) => /^ngsw:/.test(n)).map((n) => caches.delete(n)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((c) => c.navigate(c.url)));
    })(),
  );
});
