# Release Note 11302025 — HIIT Audio System Overhaul

## 1. 全面改用 MP3 語音系統
本版將原本依賴瀏覽器 Web Speech API 的語音播報，全面改為 **mp3 檔案播放**，包含：
- 動作開始（work_start\_*）
- 休息（rest_normal）
- 暖身（warmup_start）
- 收操（cooldown_start）
- 完成語音（finish_A/B/C）
- 倒數語音（10、3、2、1）

這讓語音行為完全可控、不受瀏覽器或裝置差異影響，並修正：
- iPhone 首次播放無聲
- 背景切回後語音常常卡住
- 倒數（10、3、2、1）間歇性不說話
- REST / WORK 切換時 TTS 易卡住
- 多段排隊造成延遲、跳段、重複播放

---

## 2. 新增獨立語音模組：`/lib/hiit/voice.ts`
新模組負責所有 mp3 語音播放：

### 新增功能
- `playVoice(name)`：播放指定 mp3
- `playRandomVariant(prefix, fallback)`：自動偵測 `_A` `_B` `_C` 等檔案版本
- `playWorkoutStart()`：播放 workout_start_A/B/C 隨機版本
- `playFinishRandom()`：播放 finish_A/B/C
- `playWorkStart(slug)`：播放動作語音（支援 A/B 隨機）

### 檔案位置
所有語音統一放置於：

```
public/voices/*.mp3
```

---

## 3. 新增「動作語音 A / B 兩版」支援
所有動作語音現在支援 **多版本隨機播放**。

### 命名格式
```
work_start_<slug>_A.mp3
work_start_<slug>_B.mp3
```

例如：

```
work_start_jump-jack_A.mp3
work_start_jump-jack_B.mp3
```

系統會：
- 自動偵測存在的版本（A、B、C…）
- 隨機播放其中一個
- 未來如加入 `_C` `_D` `_E`，系統會自動吃到無需改 code

---

## 4. 新增半自動批次語音生成腳本（Tampermonkey）
新增完整 **ttsmp3.com 半自動語音生成腳本**：

### 功能
- 自動依序輸出動作的 A / B 語音
- 自動填入句子 → 自動按 Read → 自動觸發 Download
- 支援新版 ttsmp3 DOM 結構
- 一次可自動產生 200+ 句語音
- 自動命名輸出檔名（如：work_start_squat_A.mp3）

此腳本已整合所有行為流程，讓大量語音輸出變得快速可控。

---

## 5. 大幅修正 iPhone / iOS 播放問題
以下問題已全部修正：

### 修正內容
- AudioContext 會在 iOS 首次互動後正確建立
- 語音切段、切 App、切 Safari Tab 都不再卡住
- 不會發生語音第一次沒聲音、第二次才出聲
- 不會同時觸發多段語音而造成覆蓋或靜音
- 不會播放到一半突然停止

---

## 6. 修正倒數語音不穩、常常不講
- 10 秒、3、2、1 秒語音改為 mp3，完全穩定
- 不會因 Web Speech API 排隊塞死
- 不會因 fragment 更新造成跳過

---

## 7. 修正多個語音重複觸發的問題
`spokenSegmentRef` 在 React StrictMode 會 double render，
導致語音重播問題，本版已全部修正。

---

## 8. 視覺小幅調整
- 「開始訓練」按鈕微增強
- 倒數動畫更平滑
- HUD 顯示資訊優化

---

## 9. 語音總覽（正式版）
### 基本語音
```
workout_start_A/B/C...
finish_A/B/C...
rest_normal.mp3
warmup_start.mp3
cooldown_start.mp3
```

### 動作語音（支援兩版）
命名格式：

```
work_start_<slug>_A.mp3
work_start_<slug>_B.mp3
```

---

## 10. Git 推薦指令（此次版本）

```
git add .
git commit -m "HIIT audio system overhaul: mp3 engine, A/B variants, countdown, rest voice, mobile audio fix, scripts"
git push
```

---

## 11. 未來可考慮項目（Backlog）
- 新增 C / D / E / F 版本動作語音
- 新增「提示下一動作」專屬語音
- 新增「三秒倒數」更多語氣版
- 音量控制（volume control）
- 語音快取（IndexedDB）
- 更多動作語音版本（激勵語、自訂語音庫）
