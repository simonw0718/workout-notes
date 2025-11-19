// scripts/gen-precache.mjs
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, ".next");
const OUT = path.join(ROOT, "public", "precache-assets.json");

// 讀 JSON 小工具
async function readJSON(fp) {
  try {
    return JSON.parse(await fs.readFile(fp, "utf8"));
  } catch {
    return null;
  }
}

// 轉成以 "/_next/" 開頭的相對路徑
function normalize(p) {
  if (!p || typeof p !== "string") return null;

  // 已是絕對路徑
  if (p.startsWith("/_next/")) return p;
  if (p.startsWith("_next/")) return `/${p}`;

  // 常見相對路徑：static/...、chunks/...、app/...
  if (
    p.startsWith("static/") ||
    p.startsWith("chunks/") ||
    p.startsWith("app/")
  ) {
    return `/_next/${p}`;
  }

  // 其它：有些欄位會是 "/_next/xxx" 本來就帶斜線
  if (p.startsWith("/")) return p;

  return null;
}

// 從 manifest 物件擷取所有候選
function collectFrom(obj) {
  const out = new Set();
  if (!obj || typeof obj !== "object") return out;

  // build-manifest.json
  //   pages: { "/": ["static/chunks/..", ...], ... }
  //   lowPriorityFiles: ["static/chunks/..", ...]
  //   polyfillFiles: ["static/chunks/..", ...]
  if (obj.pages && typeof obj.pages === "object") {
    for (const arr of Object.values(obj.pages)) {
      if (Array.isArray(arr)) {
        for (const p of arr) out.add(p);
      }
    }
  }

  if (Array.isArray(obj.lowPriorityFiles)) {
    for (const p of obj.lowPriorityFiles) out.add(p);
  }

  if (Array.isArray(obj.polyfillFiles)) {
    for (const p of obj.polyfillFiles) out.add(p);
  }

  // app-build-manifest.json 也會有 pages 欄位，這裡一起處理
  if (obj.app && typeof obj.app === "object") {
    // 某些版本會把 app 的 chunk 放在 app.* 裡，不處理也沒關係
  }

  return out;
}

(async () => {
  const manifestFiles = [
    path.join(NEXT_DIR, "build-manifest.json"),
    path.join(NEXT_DIR, "app-build-manifest.json"),
  ];

  const assets = new Set();

  for (const f of manifestFiles) {
    const json = await readJSON(f);
    if (!json) continue;

    for (const p of collectFrom(json)) {
      const n = normalize(p);
      if (n) assets.add(n);
    }
  }

  // 寫出（排序只是為了可讀性）
  const list = Array.from(assets).sort();
  await fs.writeFile(OUT, JSON.stringify(list, null, 2), "utf8");
  console.log(`[gen-precache] wrote ${list.length} assets to ${OUT}`);
})();