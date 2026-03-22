const CACHE_NAME = "pediapp-v4";

// Solo cacheamos lo que realmente controla el HTML
const ASSETS_TO_CACHE = [
  "./index.html",
  "./manifest.json"
];

// URLs de CDN que vamos a cachear dinámicamente
const CDN_PATTERNS = [
  "cdn.tailwindcss.com",
  "unpkg.com/react@18",
  "unpkg.com/react-dom@18",
  "unpkg.com/@babel/standalone",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

// Firebase NO se cachea con el SW porque usa IndexedDB y su propio sistema offline
const SKIP_PATTERNS = [
  "firebaseapp.com",
  "googleapis.com/identitytoolkit",
  "securetoken.googleapis.com",
  "firestore.googleapis.com"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = event.request.url;

  // Ignorar requests de Firebase Auth/Firestore (tienen su propia persistencia)
  if (SKIP_PATTERNS.some(p => url.includes(p))) return;

  // Estrategia: Cache First para recursos estáticos y CDN
  if (
    url.includes("index.html") ||
    url.includes("manifest.json") ||
    url.includes("sw.js") ||
    CDN_PATTERNS.some(p => url.includes(p))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const response = await fetch(event.request);
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          // Si es una navegación y no hay cache, devolvemos el index
          if (event.request.mode === "navigate") {
            return cache.match("./index.html");
          }
          throw err;
        }
      })
    );
    return;
  }

  // Para todo lo demás: Network first, fallback a cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});
