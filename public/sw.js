// public/sw.js
const VERSION = "v1.4.0";
const CACHE_NAME = `workout-cache-${VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/settings",
  "/history",
  "/exercise",
  "/summary",
  "/manifest.webmanifest",
  "/favicon.ico",
];

// === Install ===
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// === Activate ===
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event?.data === "SKIP_WAITING") self.skipWaiting();
});

// === Fetch ===
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Next.js build 靜態資源 → Cache First
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            return res;
          })
      )
    );
    return;
  }

  // 2) 導航請求
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const clone = fresh.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          return fresh;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          return (await caches.match("/offline")) || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // 3) API：/auth, /sync → 線上優先
  if (url.pathname.startsWith("/auth") || url.pathname.startsWith("/sync")) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cached = await caches.match(req);
          return (
            cached ||
            new Response(JSON.stringify({ ok: false, offline: true }), {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          );
        }
      })()
    );
    return;
  }

  // 4) 其他靜態資源 → Cache First
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        const clone = fresh.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        return fresh;
      } catch {
        return new Response("", { status: 200 });
      }
    })()
  );
});