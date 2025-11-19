/* public/sw.js — Workout Notes shell v4.8.2 */
const VERSION = "v4.8.2";
const CACHE_NAME = `workout-shell-${VERSION}`;
const MEDIA_CACHE_NAME = `workout-media-${VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/start.html",
  "/offline",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/apple-touch-icon.png",
];

const htmlLike = (u) => new Request(u, { headers: { Accept: "text/html,*/*" } });

// ---- helpers
async function putIfOk(cache, key, resp) {
  if (resp && resp.ok) {
    await cache.put(key, resp.clone());
    return true;
  }
  return false;
}

function isApiPath(p) {
  return p.startsWith("/api/");
}

function looksLikeHtmlPath(pathname) {
  if (!pathname || pathname === "/") return true;
  if (pathname.endsWith(".html")) return true;
  const last = pathname.split("/").pop() || "";
  return !last.includes(".");
}

// ---------------- install
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1) 基本 shell 預載
      for (const url of STATIC_ASSETS) {
        try {
          const res = await fetch(url, { cache: "no-cache" });
          const key =
            url === "/" || url === "/start.html" ? htmlLike(url) : url;
          await putIfOk(cache, key, res);
        } catch {
          // 靜默失敗即可，之後改由 runtime cache 補
        }
      }

      // 2) 常用路由（HTML shell）
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

      // 3) build 資產清單（由 precache-assets.json 提供）
      try {
        const precacheRes = await fetch("/precache-assets.json", {
          cache: "no-cache",
        });
        if (precacheRes && precacheRes.ok) {
          const json = await precacheRes.json();
          const list = Array.isArray(json)
            ? json
            : Array.isArray(json.assets)
            ? json.assets
            : [];
          for (const p of list) {
            try {
              const r = await fetch(p, { cache: "no-cache" });
              await putIfOk(cache, p, r);
            } catch {}
          }
        }
      } catch {}

      // 4) （可選）從 app-build-manifest 再補一點常用 chunks
      try {
        const appManifestRes = await fetch("/_next/app-build-manifest.json", {
          cache: "no-cache",
        });
        if (appManifestRes.ok) {
          const am = await appManifestRes.json();
          const pages = am?.pages ? Object.values(am.pages) : [];
          const likelyPrefixes = [
            "/_next/static/chunks/webpack-",
            "/_next/static/chunks/framework-",
            "/_next/static/chunks/polyfills-",
            "/_next/static/chunks/main-app",
            "/_next/static/chunks/app/layout-",
          ];
          const toCache = new Set();
          for (const arr of pages) {
            if (!Array.isArray(arr)) continue;
            for (const p of arr) {
              if (
                typeof p === "string" &&
                p.startsWith("/_next/") &&
                likelyPrefixes.some((pref) => p.includes(pref))
              ) {
                toCache.add(p);
              }
            }
          }
          for (const p of toCache) {
            try {
              const r = await fetch(p, { cache: "no-cache" });
              await putIfOk(cache, p, r);
            } catch {}
          }
        }
      } catch {}
    })()
  );

  // 不自動 skipWaiting：讓更新在「下次重開」再生效（靜默更新）
});

// ---------------- activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              (k.startsWith("workout-shell-") && k !== CACHE_NAME) ||
              (k.startsWith("workout-media-") && k !== MEDIA_CACHE_NAME)
          )
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
      try {
        const all = await self.clients.matchAll({
          includeUncontrolled: true,
        });
        for (const c of all) c.postMessage("READY");
      } catch {}
    })()
  );
});

async function respondAppShellOrOffline() {
  const cache = await caches.open(CACHE_NAME);
  const hitRoot = await cache.match(htmlLike("/"));
  if (hitRoot) return hitRoot;
  const hitStart = await cache.match(htmlLike("/start.html"));
  if (hitStart) return hitStart;
  const off = await cache.match("/offline");
  if (off)
    return new Response(await off.blob(), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  return new Response("<h1>Offline</h1>", {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function emptyFallbackFor(req) {
  const dest = req.destination || "";
  if (dest === "style")
    return new Response("", {
      status: 200,
      headers: { "content-type": "text/css" },
    });
  if (dest === "script") {
    try {
      console.warn(
        "[SW] missing script while offline:",
        new URL(req.url).pathname
      );
    } catch {}
    return new Response(";/* offline noop */", {
      status: 200,
      headers: { "content-type": "application/javascript" },
    });
  }
  if (dest === "image") return new Response("", { status: 204 });
  return new Response("Offline static not cached", { status: 504 });
}

// HIIT 影片 / 語音：第一次播放才下載，之後走 cache-first
async function handleMediaRequest(req) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const net = await fetch(req);
    if (net && net.ok) {
      await cache.put(req, net.clone());
    }
    return net;
  } catch {
    // 離線且沒 cache：回 504，交給前端處理（顯示提示）
    return new Response("Media not cached for offline use", {
      status: 504,
    });
  }
}

// ---------------- fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";

  // ① 導覽（HTML）→ network-first + shell fallback
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const net = await fetch(req);
          if (net && net.ok && looksLikeHtmlPath(url.pathname)) {
            await cache.put(htmlLike(url.pathname), net.clone());
          }
          return net;
        } catch {
          const hitByPath = await cache.match(htmlLike(url.pathname));
          if (hitByPath) return hitByPath;
          const hitRoot = await cache.match(htmlLike("/"));
          if (hitRoot) return hitRoot;
          const hitStart = await cache.match(htmlLike("/start.html"));
          if (hitStart) return hitStart;
          return respondAppShellOrOffline();
        }
      })()
    );
    return;
  }

  // ② HIIT 媒體 & 語音 → cache-first（runtime cache）
  const isMedia =
    req.method === "GET" &&
    (url.pathname.startsWith("/hiit/media/") ||
      url.pathname.startsWith("/voices/"));
  if (isMedia) {
    event.respondWith(handleMediaRequest(req));
    return;
  }

  // ③ Next / 靜態 → cache-first（背景更新）
  const isStatic =
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    STATIC_ASSETS.includes(url.pathname);
  if (isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(req);
        if (hit) {
          // 背景更新，靜默即可
          event.waitUntil(
            (async () => {
              try {
                const fresh = await fetch(req);
                if (fresh && fresh.ok) await cache.put(req, fresh.clone());
              } catch {}
            })()
          );
          return hit;
        }
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) await cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return emptyFallbackFor(req);
        }
      })()
    );
    return;
  }

  // ④ /api/*：network-first → cache fallback
  if (isApiPath(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const net = await fetch(req);
          if (net && net.ok) await cache.put(req, net.clone());
          return net;
        } catch {
          const hit = await cache.match(req);
          if (hit) return hit;
          return new Response(JSON.stringify({ offline: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      })()
    );
    return;
  }

  // ⑤ 其它：network-first → cache → 504
  event.respondWith(
    (async () => {
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
    })()
  );
});

// ---------------- message
self.addEventListener("message", (e) => {
  if (e?.data === "SKIP_WAITING") {
    // 保留後門：如果未來你想手動觸發立即更新，可以從前端 postMessage
    self.skipWaiting();
    return;
  }

  if (e?.data && e.data.type === "WARM_CACHE" && Array.isArray(e.data.urls)) {
    e.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        for (const u of e.data.urls) {
          try {
            const uObj = new URL(u, self.location.origin);
            const isHtml = looksLikeHtmlPath(uObj.pathname);
            const req = isHtml
              ? htmlLike(uObj.pathname)
              : new Request(uObj.href, { cache: "no-cache" });
            if (await cache.match(req)) continue;
            const res = await fetch(req);
            await putIfOk(cache, req, res);
          } catch {}
        }
      })()
    );
  }
});