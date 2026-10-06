// Service Worker - شاورما السلطان
// استراتيجية: الشبكة أولاً (عشان التحديثات تظهر فوراً)، والكاش للعمل بدون إنترنت.
const CACHE_NAME = "shawarma-soltan-v2";

const CORE_FILES = [
  "./",
  "index.html",
  "app.js",
  "data.js",
  "promo_data.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_FILES).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // نتعامل مع ملفات الموقع نفسه فقط (GET)، وسيب Firebase وباقي الروابط تعدي عادي
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("index.html")))
  );
});
