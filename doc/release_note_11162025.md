# Release Note 11162025 — Entry Page Redesign, Icons Integration & Code Cleanup

## 1. 新增首頁 Entry Page（Workout / HIIT 雙入口）
本次版本正式導入新的首頁 **Entry Page**，提供兩大入口：
- Workout 模式
- HIIT 模式

### 新增項目
- 新增 `/app/page.tsx` 作為最外層入口頁。
- 使用黑底白圖示、卡片式 UI。
- 圖示改用 object-contain 呈現不變形。

---

## 2. 新增並整合圖示（PNG + SVG）
加入最新設計的 Workout / HIIT ICON，並完成整合。

### 新增資產
```
public/entry/workout.png
public/entry/workout.svg
public/entry/hiit.png
public/entry/hiit.svg
```

### 圖片改善
- SVG 在首頁有縮放異常 → 改為使用 PNG。
- 修正圖片比例，全部統一為 `1024 × 1024`。

---

## 3. 移除舊首頁 `/home/page.tsx`
原本 home 入口頁已不再使用並被移除，避免路由混淆。
舊版仍可能暫存於 precache-assets.json，但不影響正常運作。

---

## 4. Workout 主頁遷移至 `/app/workout/page.tsx`
原本位於 `/app/page.tsx` 的 Workout 主畫面已完整搬移到：
```
/app/workout/page.tsx
```

並進行以下調整：
- 維持 Deck UI、動作選擇、Session 控制邏輯。
- 底部「前往 HIIT」改為「HOME」。

---

## 5. HIIT 主頁 `/app/(hiit)/hiit/page.tsx` 更新
### 修改項目
- 刪除右上角舊的「← Workout」
- 新增 HOME 返回入口（位置與 Workout 一致）
- Modal 佈局更穩定（固定容器、提升一致性）

---

## 6. 修正 Entry Page 圖示變形問題（重要）
原本 `<Image>` 給了錯誤比例：
```
width=1024
height=768   // ❌ 會強制壓成 4:3 導致變形
```

已改為：
```
width=1024
height=1024
className="object-contain"
```

完全解決：
- 圖片變形
- 顯示問號「?」
- 高度被壓縮

---

## 7. 最新路由結構
```
/
 ├── workout/
 │     └── page.tsx
 └── hiit/
       └── page.tsx
```

---

## 8. Git 推薦提交訊息
```
git add .
git commit -m "Entry redesign: icons added, PNG integration, workout/hiit routing cleanup, removed old home page"
git push
```

---

## 9. Backlog（未來建議）
- Entry Page 動畫與 hover 效果加強
- Icon SVG 版本優化、壓縮
- 卡片加入副標
- 加入主題切換（亮/暗）
