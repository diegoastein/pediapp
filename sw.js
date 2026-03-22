// sw.js — PediApp Service Worker
// Ubicación esperada: https://usuario.github.io/pediapp/sw.js
// El scope se define automáticamente como /pediapp/ por estar en esa carpeta

const CACHE_NAME = "pediapp-v5";
const BASE = "/pediapp";

// Shell de la app — rutas absolutas obligatorias para GitHub Pages
const APP_SHELL = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/manifest.json`,
];

// Hosts de CDN — cacheamos dinámicamente (Cache First)
const CDN_HOSTS = [
  "cdn.tailwindcss.com",
  "unpkg.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

// Hosts de Firebase — NO interceptamos, tienen su propio sistema offline con IndexedDB
const BYPASS_HOSTS = [
  "firebaseapp.com",
  "firebase.google.com",
  "googleapis.com",
  "gstatic.com",
  "securetoken.google.com",
  "identitytoolkit",
  "firestore.googleapis.com",
];

// ── INSTALL: pre-cachear el shell ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          APP_SHELL.map((url) =>
            cache.add(url).catch((e) => console.warn("[SW] No se pudo pre-cachear:", url, e))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: eliminar caches viejos y tomar control inmediato ────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Solo GET
  if (event.request.method !== "GET") return;

  // Bypassear Firebase — no tocar nada de Firebase con el SW
  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h) || url.href.includes(h))) {
    return;
  }

  // CDN externos — Cache First con actualización en background
  if (CDN_HOSTS.some((h) => url.hostname.includes(h))) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Recursos propios bajo /pediapp/ — Cache First con fallback al index
  if (url.pathname.startsWith(BASE) || url.pathname === BASE) {
    event.respondWith(cacheFirstWithFallback(event.request));
    return;
  }
});

// Cache First: devuelve cache si existe, sino busca en red y guarda
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.status === 200 || response.type === "opaque")) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    throw err;
  }
}

// Cache First con fallback al index.html para navegación
async function cacheFirstWithFallback(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.status === 200 || response.type === "opaque")) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Sin red — devolver el index cacheado (SPA fallback)
    const fallback =
      (await cache.match(`${BASE}/`)) ||
      (await cache.match(`${BASE}/index.html`));
    if (fallback) return fallback;
    throw err;
  }
}
