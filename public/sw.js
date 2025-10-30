/* public/sw.js — Workout Notes shell v4.7.1 */
const VERSION    = "v4.7.1";
const CACHE_NAME = `workout-shell-${VERSION}`;

const STATIC_ASSETS = [
  "/", "/start.html", "/offline",
  "/manifest.webmanifest", "/favicon.ico",
  "/icons/icon-192.png", "/icons/icon-512.png",
  "/icons/maskable-512.png", "/apple-touch-icon.png",
];

const htmlLike = (u) => new Request(u, { headers: { Accept: "text/html,*/*" } });

// ---- helpers
async function putIfOk(cache, key, resp) {
  if (resp && resp.ok) { await cache.put(key, resp.clone()); return true; }
  return false;
}
function isApiPath(p) { return p.startsWith("/api/"); }
function looksLikeHtmlPath(pathname) {
  if (!pathname || pathname === "/") return true;
  if (pathname.endsWith(".html")) return true;
  const last = pathname.split("/").pop() || "";
  return !last.includes(".");
}

// ---------------- install
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const url of STATIC_ASSETS) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        const key = (url === "/" || url === "/start.html") ? htmlLike(url) : url;
        await putIfOk(cache, key, res);
      } catch {}
    }

    // 額外把常用路由放進 cache（含 /settings/presets-transfer）
    const extraHtmlRoutes = [
      "/exercise",
      "/history",
      "/settings",
      "/settings/presets-transfer",
      "/summary",
    ];
    for (const route of extraHtmlRoutes) {
      try {
        const res = await fetch(route, { cache: "no-cache" });
        await putIfOk(cache, htmlLike(route), res);
      } catch {}
    }

    // build 資產清單
    try {
      const precacheRes = await fetch("/precache-assets.json", { cache: "no-cache" });
      if (precacheRes && precacheRes.ok) {
        const json = await precacheRes.json();
        const list = Array.isArray(json) ? json : (Array.isArray(json.assets) ? json.assets : []);
        for (const p of list) {
          try {
            const r = await fetch(p, { cache: "no-cache" });
            await putIfOk(cache, p, r);
          } catch {}
        }
      }
    } catch {}

    // likely chunks
    const likelyChunks = [
      "/_next/static/chunks/webpack-",
      "/_next/static/chunks/framework-",
      "/_next/static/chunks/polyfills-",
      "/_next/static/chunks/main-app.js",
      "/_next/static/chunks/app/layout-",
      "/_next/static/chunks/app/exercise/",
      "/_next/static/chunks/app/history/",
      "/_next/static/chunks/app/history%5BsessionId%5D/",
      "/_next/static/chunks/app/settings/",
      "/_next/static/chunks/app/settings/presets-transfer/",
      "/_next/static/chunks/app/summary/",
    ];
    try {
      const [bm, am] = await Promise.all([
        fetch("/_next/build-manifest.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/_next/app-build-manifest.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const pages = am?.pages ? Object.values(am.pages) : [];
      const all = new Set();
      for (const arr of pages) {
        for (const p of arr) {
          if (typeof p === "string" && p.startsWith("/_next/") && likelyChunks.some(pref => p.includes(pref))) {
            all.add(p);
          }
        }
      }
      const cache = await caches.open(CACHE_NAME);
      for (const p of all) {
        try {
          if (await cache.match(p)) continue;
          const r = await fetch(p, { cache: "no-cache" });
          await putIfOk(cache, p, r);
        } catch {}
      }
    } catch {}
  })());
  self.skipWaiting();
});

// ---------------- activate
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k !== CACHE_NAME && k.startsWith("workout-shell-"))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
    try {
      const all = await self.clients.matchAll({ includeUncontrolled: true });
      for (const c of all) c.postMessage("READY");
    } catch {}
  })());
});

async function respondAppShellOrOffline() {
  const cache = await caches.open(CACHE_NAME);
  const hitRoot  = await cache.match(htmlLike("/"));
  if (hitRoot) return hitRoot;
  const hitStart = await cache.match(htmlLike("/start.html"));
  if (hitStart) return hitStart;
  const off   = await cache.match("/offline");
  if (off) return new Response(await off.blob(), {
    status: 200, headers: { "content-type": "text/html; charset=utf-8" }
  });
  return new Response("<h1>Offline</h1>", {
    status: 503, headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function emptyFallbackFor(req) {
  const dest = req.destination || "";
  if (dest === "style")  return new Response("", { status: 200, headers: { "content-type": "text/css" } });
  if (dest === "script") {
    try { console.warn("[SW] missing script while offline:", new URL(req.url).pathname); } catch {}
    return new Response(";/* offline noop */", { status: 200, headers: { "content-type": "application/javascript" } });
  }
  if (dest === "image")  return new Response("", { status: 204 });
  return new Response("Offline static not cached", { status: 504 });
}

// ---------------- fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";

  // ① 導覽（HTML）→ **改為 network-first**
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      // 先試網路（可拿到新 route / 新 chunk）
      try {
        const net = await fetch(req);
        if (net && net.ok && looksLikeHtmlPath(url.pathname)) {
          await cache.put(htmlLike(url.pathname), net.clone());
        }
        return net;
      } catch {
        // 線上失敗 → 才退回快取
        const hitByPath = await cache.match(htmlLike(url.pathname));
        if (hitByPath) return hitByPath;
        const hitRoot = await cache.match(htmlLike("/"));
        if (hitRoot) return hitRoot;
        const hitStart = await cache.match(htmlLike("/start.html"));
        if (hitStart) return hitStart;
        return respondAppShellOrOffline();
      }
    })());
    return;
  }

  // ② Next / 靜態：cache-first（背景更新）
  const isStatic =
       url.pathname.startsWith("/_next/")
    || url.pathname.startsWith("/icons/")
    || STATIC_ASSETS.includes(url.pathname);
  if (isStatic) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit   = await cache.match(req);
      if (hit) {
        event.waitUntil((async () => {
          try {
            const fresh = await fetch(req);
            if (fresh && fresh.ok) await cache.put(req, fresh.clone());
          } catch {}
        })());
        return hit;
      }
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return emptyFallbackFor(req);
      }
    })());
    return;
  }

  // ③ /api/*：network-first → cache fallback
  if (isApiPath(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const net = await fetch(req);
        if (net && net.ok) await cache.put(req, net.clone());
        return net;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        return new Response(JSON.stringify({ offline: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
    })());
    return;
  }

  // ④ 其它：network-first → cache → 504
  event.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (req.method === "GET" && net && net.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, net.clone());
      }
      return net;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req);
      if (hit) return hit;
      return new Response("Offline and not cached", { status: 504 });
    }
  })());
});

// ---------------- message
self.addEventListener("message", (e) => {
  if (e?.data === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (e?.data && e.data.type === "WARM_CACHE" && Array.isArray(e.data.urls)) {
    e.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const u of e.data.urls) {
        try {
          const uObj = new URL(u, self.location.origin);
          const isHtml = looksLikeHtmlPath(uObj.pathname);
          const req = isHtml ? htmlLike(uObj.pathname) : new Request(uObj.href, { cache: "no-cache" });
          if (await cache.match(req)) continue;
          const res = await fetch(req);
          await putIfOk(cache, req, res);
        } catch {}
      }
    })());
  }
});