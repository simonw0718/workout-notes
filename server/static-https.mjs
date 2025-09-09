// server/static-https.mjs
// 目的：用 HTTPS 端出 out/（Next 靜態匯出），強制使用既有 IP 憑證
// 憑證位置固定：certs/192.168.31.241.pem、certs/192.168.31.241-key.pem

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import serveStatic from "serve-static";
import finalhandler from "finalhandler";

// --- 常數與路徑 ---
const ROOT = path.resolve("out");
const CERT_PATH = path.resolve("certs/192.168.31.241.pem");
const KEY_PATH  = path.resolve("certs/192.168.31.241-key.pem");
const PORT = Number(process.env.PORT || 3443);

// --- 檢查憑證是否存在 ---
if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
  console.error(
    [
      "[static-https] 找不到憑證或私鑰。",
      `  期望路徑：`,
      `    cert: ${CERT_PATH}`,
      `    key : ${KEY_PATH}`,
      "",
      "請把你目前的憑證放到上述路徑；或改這支檔案指向正確位置。",
      "（若要改自訂路徑，也可用環境變數指定：CERT_PATH / KEY_PATH）",
    ].join("\n"),
  );
  process.exit(1);
}

// 允許用環境變數覆寫（可選）
const certFile = process.env.CERT_PATH ? path.resolve(process.env.CERT_PATH) : CERT_PATH;
const keyFile  = process.env.KEY_PATH  ? path.resolve(process.env.KEY_PATH)  : KEY_PATH;

// --- 讀取憑證 ---
let cert, key;
try {
  cert = fs.readFileSync(certFile);
  key  = fs.readFileSync(keyFile);
} catch (e) {
  console.error("[static-https] 讀取憑證失敗：", e);
  process.exit(1);
}

// --- 靜態檔服務 + SPA fallback ---
const serve = serveStatic(ROOT, { index: ["index.html"], fallthrough: true });

function handler(req, res) {
  serve(req, res, () => {
    // 沒命中的話，對於 HTML 請求回 index.html（單頁應用路由）
    const accept = String(req.headers["accept"] || "");
    if (accept.includes("text/html")) {
      const indexFile = path.join(ROOT, "index.html");
      if (fs.existsSync(indexFile)) {
        fs.createReadStream(indexFile).pipe(res);
        return;
      }
    }
    finalhandler(req, res)();
  });
}

// --- 啟動 HTTPS 伺服器 ---
const server = https.createServer({ key, cert }, handler);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[static-https] Serving ${ROOT} over HTTPS at https://127.0.0.1:${PORT}`);
  console.log(`[static-https] cert: ${certFile}`);
  console.log(`[static-https] key : ${keyFile}`);
});