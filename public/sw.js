// Minimal service worker for PWA installability on Android.
// No caching — all requests pass through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);
