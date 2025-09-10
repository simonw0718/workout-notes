// server/static-https.mjs
// 目的：用 HTTPS 端出 out/（Next 靜態匯出），強制使用既有 IP 憑證
// 不影響遠端靜態託管（只用於本機預覽）

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import serveStatic from "serve-static";
import finalhandler from "finalhandler";

// --- 常數與路徑 ---
const ROOT = path.resolve("out");
const DEFAULT_CERT = "certs/192.168.31.241.pem";
const DEFAULT_KEY  = "certs/192.168.31.241-key.pem";

const CERT_PATH = path.resolve(process.env.CERT_PATH || DEFAULT_CERT);
const KEY_PATH  = path.resolve(process.env.KEY_PATH  || DEFAULT_KEY);
const PORT = Number(process.env.PORT || 3443);

// 嘗試從憑證檔名推斷一個預設 host（例如 192.168.31.241），找不到就用 127.0.0.1
function inferHostFromCert(p) {
  const b = path.basename(p).toLowerCase();
  const m = b.match(
    /\b((25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3})\b/
  );
  return m?.[1] || "127.0.0.1";
}
const FALLBACK_HOST = inferHostFromCert(CERT_PATH);

// 可用 HOST / DEV_HOST 覆寫顯示網址
const HOST =
  process.env.HOST ||
  process.env.DEV_HOST ||
  FALLBACK_HOST;

// --- 檢查憑證是否存在 ---
if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
  console.error(
    [
      "[static-https] 找不到憑證或私鑰。",
      `  期望路徑：`,
      `    cert: ${CERT_PATH}`,
      `    key : ${KEY_PATH}`,
      "",
      "請把你目前的憑證放到上述路徑；或以環境變數覆寫：CERT_PATH / KEY_PATH。",
    ].join("\n")
  );
  process.exit(1);
}

// --- 讀取憑證 ---
let cert, key;
try {
  cert = fs.readFileSync(CERT_PATH);
  key  = fs.readFileSync(KEY_PATH);
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
// 綁 0.0.0.0 讓區網可連；log 用 HOST 告訴你打哪個網址
const server = https.createServer({ key, cert }, handler);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[static-https] Serving ${ROOT} over HTTPS`);
  console.log(`[static-https] URL : https://${HOST}:${PORT}`);
  console.log(`[static-https] cert: ${CERT_PATH}`);
  console.log(`[static-https] key : ${KEY_PATH}`);
});