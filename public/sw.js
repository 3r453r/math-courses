// Minimal service worker for PWA installability on Android.
// A fetch handler is required for Chrome to consider the app installable.
// No caching — all requests pass through to the network.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
