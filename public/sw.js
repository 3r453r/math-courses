// Minimal service worker for PWA installability on Android.
// A fetch handler is required for Chrome to consider the app installable.
// Only intercept navigation requests — API calls, version checks, and static
// assets bypass the SW entirely so their Cache-Control headers work normally.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request));
});
