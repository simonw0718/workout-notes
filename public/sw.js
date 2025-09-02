// public/sw.js
// －－－－－－－－－－－－－－－－－－－－－－－－－－－－－－
// ⚙️ 版本號：改這個字串就能觸發新版 SW（記得重新整理兩次測試）
const VERSION = "v1.1.0";
// －－－－－－－－－－－－－－－－－－－－－－－－－－－－－－

self.addEventListener("install", (event) => {
  // 新 SW 安裝完成後，**不要**立刻接管（不要 self.skipWaiting）
  // 讓它進入 waiting 狀態，方便網頁顯示「有新版本可用」
  console.log(`[SW ${VERSION}] install`);
});

self.addEventListener("activate", (event) => {
  // 一旦被提升為 active，就立刻接管所有 client（分頁/頁籤）
  console.log(`[SW ${VERSION}] activate`);
  event.waitUntil(self.clients.claim());
});

// 透過訊息觸發「立即更新」：由頁面傳 'SKIP_WAITING' 進來
// （你的 RegisterSW 會在使用者按「立即更新」時送出這個訊息）
self.addEventListener("message", (event) => {
  if (!event || !event.data) return;
  if (event.data === "SKIP_WAITING") {
    console.log(`[SW ${VERSION}] received: SKIP_WAITING → skipWaiting()`);
    self.skipWaiting();
  }
});

// 目前不做任何快取，單純放行（之後有需要再加 cache 邏輯）
self.addEventListener("fetch", (_event) => {
  // 可加上 console.log 觀察請求：
  // console.log('[SW] fetch:', _event.request.url);
});
