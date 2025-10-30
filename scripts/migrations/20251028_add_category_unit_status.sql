-- File: scripts/migrations/20251028_add_category_unit_status.sql
-- 目的:
--  1) exercises 新增 category（upper/lower/core/other）和 defaultUnit 檢查
--  2) sets 的 unit 放寬為 NULL 或 kg/lb/sec/min（加上清理）
--  3) sessions 新增 status(in_progress/ended)
-- 執行方式(SQLite):
--   sqlite3 sync.db < scripts/migrations/20251028_add_category_unit_status.sql

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- 1) exercises：新增 category 欄位（預設 other，CHECK）
ALTER TABLE exercises ADD COLUMN category TEXT NOT NULL DEFAULT 'other';

-- defaultUnit 檢查（SQLite 舊表 ALTER 無法加嚴格 CHECK；先把非法值清成 NULL）
UPDATE exercises SET defaultUnit=NULL
WHERE defaultUnit IS NOT NULL
  AND defaultUnit NOT IN ('kg','lb','sec','min');

-- 2) sets：清理 unit 非法值
UPDATE sets SET unit=NULL
WHERE unit IS NOT NULL
  AND unit NOT IN ('kg','lb','sec','min');

-- 3) sessions：新增 status 欄位（預設 in_progress）
ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';

COMMIT;
PRAGMA foreign_keys=ON;
