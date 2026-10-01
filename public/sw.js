const CACHE = "aura-shell-v3";
const SHELL = ["/", "/expenses", "/plan", "/scanner", "/profile"];

function cacheKey(request) {
  const url = new URL(request.url);
  const kind = request.mode === "navigate" ? "nav" : "asset";
  return new Request(`https://aura.cache/${kind}${url.pathname}${url.search}`);
}

function hashedStatic(pathname) {
  return pathname.startsWith("/_next/static/") && /[a-f0-9]{8,}/.test(pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (path) => {
          try {
            const response = await fetch(path);
            if (response.ok) await cache.put(new Request(`https://aura.cache/nav${path}`), response);
          } catch {
            // A route can fail during install; the navigation handler fills it in later.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const key = cacheKey(request);
  const cached = await cache.match(key);
  if (!self.navigator.onLine && cached) return cached;
  try {
    const fresh = await fetchWithTimeout(request, cached ? 2500 : 8000);
    if (fresh.ok) cache.put(key, fresh.clone());
    return fresh;
  } catch {
    if (cached) return cached;
    if (request.mode === "navigate") {
      const home = await cache.match(new Request("https://aura.cache/nav/"));
      if (home) return home;
    }
    return new Response("Aura is offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const key = cacheKey(request);
  const cached = await cache.match(key);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(key, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.headers.has("authorization")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (hashedStatic(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
