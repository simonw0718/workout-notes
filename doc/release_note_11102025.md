# Workout Notes — Patch Notes (2025-11-10 • r3)

本文件說明本輪更新的**功能變更**、**結構調整**與**修正項目**。  
此版本重點在於「單位系統擴充（支援秒 / 分）」與「設定頁互動重構」，並同步修復首頁手機版顯示與 IndexedDB 型別錯誤等問題。

---

## 1) 單位系統擴充（sec / min）

### 1.1 型別層（`lib/models/types.ts`）
- **新增** `RepsUnit` 型別：`"rep" | "sec"`，代表次數或時間。
- **`Exercise` 型別** 新增欄位：
  - `defaultRepsUnit?: RepsUnit | null`（預設 `"rep"`）。
  - `defaultUnit` 現支援 `"kg" | "lb" | "sec" | "min"`。
- **修正**：
  - `isWeightUnit()` / `isTimeUnit()` 現可正確辨識 `sec`、`min`。
  - 型別擴充後仍與既有 JSON 結構完全相容。

### 1.2 IndexedDB（`lib/db/index.ts`）
- `createExercise()`、`updateExercise()` 皆新增支援 `defaultRepsUnit` 欄位。
- IndexedDB schema 無須重建，直接支援新屬性。
- 修復先前版本導致「重量欄位無法輸入」的錯誤。
- 新邏輯：
  - 若 `defaultUnit` 為 `sec` 或 `min` → 顯示為「預設時間」。
  - 若為 `kg` 或 `lb` → 顯示為「預設重量」。

### 1.3 同步型別（`lib/sync/types.ts`）
- 新增對 `defaultRepsUnit` 的支援，以便未來與伺服端同步。
- 維持向下相容，不影響現有 FastAPI 模型。

---

## 2) 設定頁重構（`app/settings/page.tsx`）

### 2.1 新增功能
- 預設單位支援 `kg / lb / sec / min`，點擊按鈕可循環切換。
- 「預設重量 / 預設時間」會依單位自動顯示。
- 「預設次數」維持可空值，右側固定顯示單位「次」。

### 2.2 修正項目
- 修復 `defaultRepsUnit` 型別未定義造成的 TypeScript 錯誤 (`TS2561`)。
- 修復「預設重量」欄位無法更新的問題。
- 改進 `onCreate()` 內部驗證與 reset 流程：
  - 輸入驗證更寬鬆（允許空白或 0）。
  - 建立後自動清空數值但保留滾輪選項。
- `numOrUndef()` 現支援小數與負號解析。

### 2.3 UI 改良
- 單位切換按鈕改為圓角白框設計。
- 預設次數欄位右側標籤「單位：次」固定位置。
- 行動裝置上表單間距與字級優化，不再出現跳動。

---

## 3) 首頁修正（`app/home/page.tsx`）

### 3.1 手機版工具列恢復顯示
- 修復手機版首頁中「設定 / 開始訓練 / 繼續上次」按鈕被隱藏的問題。
- 調整顯示條件：
  - **桌面端 (`sm:flex`)** → 維持原樣。
  - **行動端 (`sm:hidden`)** → 顯示獨立工具列版本。
- 「休息中」顯示三鍵、「訓練中」顯示「結束訓練」。
- 補齊所有狀態間的切換邏輯。

### 3.2 導向與 session 修正
- 修復 `goExercise()` 在 session 為 `undefined` 時導致錯誤的情況。
- 確保未開始訓練時禁止進入動作頁。

---

## 4) Server / Migration（預備更新）

> 本輪更新主要為前端擴充，不需立即修改伺服端資料庫。  
> 若未來欲支援「次數單位（sec/rep）」同步，建議於以下處更新：

| 檔案 | 需新增內容 |
|------|-------------|
| `server/models.py` | `defaultRepsUnit TEXT DEFAULT 'rep'` |
| `server/schemas.py` | `default_reps_unit` 欄位 |
| `server/crud.py` | 同步 `upsert_exercises()` 以接收新欄位 |
| `scripts/migrations/` | 新增 `20251110_add_reps_unit.sql` |

---

## 5) 其他最佳化與微調

### 5.1 型別與安全性
- 所有 DB 與 Model 函式改為顯式定義回傳型別。
- `Exercise` 與 `SetRecord` 的 `updatedAt` 均確保為 number 型。

### 5.2 視覺與使用性
- 改進暗色模式下邊框對比。
- 優化行動裝置輸入欄位對齊與點擊區域。

### 5.3 體驗一致性
- `WheelOptionsDrawer` 與 `ExerciseEditorDrawer` 維持 UI 一致。
- 抽屜關閉後即時反映變更，無需重新整理。