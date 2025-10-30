# Workout Notes — Patch Notes (2025-10-30 • r2)

本文件說明本輪修改的**功能變更**、**檔案位置**與**啟動方式**。涵蓋前端（Next.js）、本機資料（IndexedDB）、同步 API（FastAPI/SQLite）、以及手機同網段測試指令。

---

## 1) 首頁（`/`）

### 1.1 狀態與操作列
- 狀態列顯示「訓練中 / 休息中」。
- 休息中：**開始訓練**、**繼續上次訓練**、**設定**。
- 訓練中：**結束**。
- 桌面版右上角 **「歷史」** 樣式與「設定」一致（同款圓角外框按鈕）。

### 1.2 分類與清單
- Tabs：**最近使用 / 上肢 / 下肢 / 核心 / 其他**。
- 休息中清單唯讀；訓練中可點進動作頁。

### 1.3 「最近使用」來源
- 優先呼叫伺服器：`GET /exercises/recent?deviceId&token&limitSessions=N`。
- 若 API 失敗或無資料，降級為**本機備援**：
  - 取最近 N 場 session 的 sets，依**最後出現時間**排序去重。
  - 主要用到：`listAllSessions()`、`listSetsBySessionSafe(sessionId)`、`listAllExercises()`。

### 1.4 接續訓練
- 先打 `POST /sessions/continue`（接續最近一筆；`status=in_progress`、清空 `endedAt`、更新 `updatedAt`）。
- 失敗則落回本機 `resumeLatestSession()`。

---

## 2) 設定頁（`/settings`）

### 2.1 Sticky Header（與歷史頁一致）
- 左：**← 回首頁**（圓角外框按鈕）
- 右：**偵錯**、**資料搬運**（保留）

### 2.2 新增動作（名稱輸入邏輯）
- 名稱 = **雙選單** + **可自訂**：
  - 左：`啞鈴 / 槓鈴 / 器械 / 繩索 / 徒手 / 其他`（*不顯示於最終名稱*）
  - 右：常見動作（如：胸推、肩推、划船、深蹲、腿推、硬舉、側平舉、前平舉、飛鳥、二頭彎舉、三頭下壓、卷腹、抬腿 …）
  - 若填**自訂名稱**，則覆蓋雙選單組合。
- 其他欄位：
  - **分類**：`upper` / `lower` / `core` / `other`
  - **預設單位（點擊切換）**：`kg` / `lb` / `sec` / `min`
  - **預設重量/時間**（依單位顯示）、**預設次數**（可空）
- 送出：`createExercise()`。

### 2.3 已儲存動作
- 支援**搜尋**與**排序**（最近更新 / 名稱）。
- **編輯抽屜**：點條目或「編輯」開啟 `ExerciseEditorDrawer`。
- **快速刪除**（不需進抽屜）：
  - 每列右側新增「刪除」，**先淡出動畫**再移除。
- **批次刪除**：
  - 每列左側 checkbox、上方工具列含「全選/取消全選」「刪除勾選」。

---

## 3) 歷史頁（`/history`）

- Header 與設定頁一致（Sticky、圓角外框按鈕）  
  左：**← 回首頁**；右：**Analytics**。
- 批次工具：**全選 / 取消全選**、**刪除勾選（含所有組）**、**清空全部歷史**。
- 右側明細：顯示場次起迄、每組細節；可連至**本次訓練摘要**。

---

## 4) 動作頁（`/exercise`）— 休息倒數提醒（**NEW**）

### 4.1 iOS 無法振動 → 改為「**彈出提醒 + 畫面閃爍**」
- 倒數歸零後：
  - 顯示 **Toast**（置中白底黑字，約 **3 秒自動消失**）。
  - **時間框閃爍**（1 秒內快閃），不依賴瀏覽器振動 API。

### 4.2 設定
- 快捷：**2:00 / 1:00 / 0:30**；支援**自訂秒數**（回車或離焦套用，不自動開始）。
- 控制：**開始 / 停止 / 重置** 正常工作（重構後修復）。

> 主要改動：`app/exercise/page.tsx`  
> - 新增 `toastVisible` 與 `flash` 狀態、CSS 動畫 class。  
> - 倒數到 0 時觸發 **Toast + Flash**，自動收合。  
> - 修正計時器 state 與控制流程，避免殘留 interval 造成異常。

---

## 5) 同步 API（FastAPI）

### 5.1 新增端點
- `POST /auth/register-device`：註冊或回傳既有 `userId/deviceId/token`。
- `POST /sessions/continue`：接續此裝置最近一筆 session（同時 `status=in_progress`、清空 `endedAt`、更新 `updatedAt`）。
- `GET /exercises/recent?deviceId&token&limitSessions=N`：回傳最近 N 場中出現過的動作（去重依最近出現排序）。

### 5.2 Schema / Model 強化
- `sessions.status`：`"in_progress" | "ended"`（可接續）。
- `exercises.category`：`upper/lower/core/other`（預設 `other`）。
- `defaultUnit`/`sets.unit`：放寬 `kg/lb/sec/min` 或 `NULL`；皆有 **CHECK** 約束。

---

## 6) 資料庫遷移（SQLite）

**檔案**：`scripts/migrations/20251028_add_category_unit_status.sql`

- `exercises`：`ADD COLUMN category TEXT NOT NULL DEFAULT 'other'`
- 清理 `defaultUnit` 非法值為 `NULL`
- `sets`：清理 `unit` 非法值為 `NULL`
- `sessions`：`ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress'`

**執行**：
```bash
sqlite3 sync.db < scripts/migrations/20251028_add_category_unit_status.sql