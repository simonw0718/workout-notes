# Workout Notes 專案收尾紀錄

## 一、目前狀態
- 專案架構：Next.js 15 + Tailwind + PWA
- 發佈方式：**Cloudflare Pages 靜態託管**
- 資料存取：僅本地 IndexedDB（無雲端同步）
- Service Worker：
  - `public/sw.js`，目前版本 `v4.6.1`
  - cache name：`workout-shell-vX.Y.Z`
  - 設定為 network-first + cache fallback
- Headers 設定（`public/_headers`）：
  - `sw.js` → no-store + Service-Worker-Allowed
  - `/*.html`, `/`, `/start.html` → no-store
  - `_next/*`, icons → immutable 長快取
  - `precache-assets.json` → no-cache
  - `manifest.webmanifest` → no-store

---

## 二、更新流程

### 1. bump SW 版本
修改 `public/sw.js`：
```js
const VERSION = "v4.6.2";
const CACHE_NAME = `workout-shell-${VERSION}`;
```

### 2. 本地建置與預覽
```bash
pnpm install
pnpm run build:static   # 產生 out/ + precache-assets.json
pnpm run preview:export # 本地 https://192.168.31.241:3443 測試
```

### 3. 提交與推送
```bash
git add -A
git commit -m "chore: bump sw v4.6.2"
git push origin main
```

### 4. Cloudflare Pages
- Build command: `pnpm build:static`
- Output dir: `out`
- Git submodules: **Off**
- Deploy 完成後，檢查 `/sw.js?ts=...` headers 是否正確

---

## 三、常見問題處理

### 1. Pages build 出現 `ERR_PNPM_OUTDATED_LOCKFILE`
```bash
pnpm install
pnpm dedupe
git add pnpm-lock.yaml
git commit -m "chore: update lockfile"
git push
```

### 2. `my-new-repo` submodule 錯誤
**解法：**
- 確認沒有 `.gitmodules` 與 `.git/modules/my-new-repo/`
- 移除 gitlink：
  ```bash
  git rm -f my-new-repo
  git commit -m "chore: remove orphaned submodule"
  git push
  ```
- Cloudflare Pages 設定 → Submodules Off

### 3. `next export` 已移除
解法：用 `output: "export"`，`package.json` 改：
```json
"build:static": "rm -rf .next out && next build && node scripts/gen-precache.mjs && cp -f public/_redirects out/_redirects 2>/dev/null || true && cp -f public/_headers out/_headers 2>/dev/null || true"
```

### 4. SW 沒更新
- 確認 `sw.js` 已 bump 版本
- 確認 `_headers` 對 sw.js 設定了 `no-store`
- 手機端重開頁面，或到 `/diagnostics` → 「清除 SW 與所有 Cache」

---

## 四、注意事項
- 每次發版必須 **同步 bump `sw.js` 的版本**。
- `pnpm-lock.yaml` 必須和 `package.json` 一致。
- `public/_headers` 不能缺，避免舊檔被快取。
- 測試流程建議：**先本地 HTTPS 測試，再推到 Pages**。
- 手機端測試：打開首頁底部版本列，應顯示正確版本號。

---

## 五、快速推版指令
```bash
# 1. 改 public/sw.js 版本號
# 2. 本地建置與測試
pnpm run build:static
pnpm run preview:export

# 3. 提交
git add -A
git commit -m "chore: bump sw vX.Y.Z"
git push origin main
```
