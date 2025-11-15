#!/usr/bin/env python3
import os
from pathlib import Path

# === 你要的目標檔名（順序要跟 ttsmp3 下載順序一樣） ===
TARGET_NAMES = [
    "workout_start",
    "warmup_start",
    "cooldown_start",
    "rest_normal",
    "countdown_10",
    "countdown_3",
    "countdown_2",
    "countdown_1_work",
    "countdown_1_rest",
    "finish_A",
    "finish_B",
    "finish_C",
    "work_start_jumping-jack",
    "work_start_high-knees",
    "work_start_burpee",
    "work_start_skater-jump",
    "work_start_mountain-climber",
    "work_start_squat-jump",
    "work_start_alternating-lunge",
    "work_start_step-up",
    "work_start_squat",
    "work_start_push-up",
    "work_start_plank-shoulder-tap",
    "work_start_tricep-dip",
    "work_start_plank",
    "work_start_russian-twist",
    "work_start_kettlebell-swing",
    "work_start_reverse-crunches",
    "work_start_split-jump",
    "work_start_squat-kicks",
    "work_start_squat-reach",
    "work_start_plank-jack",
    "work_start_butt-kick",
    "work_start_lateral-shuffle",
    "work_start_bear-crawl",
    "work_start_bicycle-crunch",
    "work_start_dead-bug",
]

def main():
    root = Path(".").resolve()
    mp3_files = sorted(
        [p for p in root.iterdir() if p.is_file() and p.suffix.lower() == ".mp3"],
        key=lambda p: p.stat().st_mtime  # 依照下載時間排序（最早 → 最晚）
    )

    print(f"找到 MP3 檔案數量：{len(mp3_files)}")
    print(f"目標檔名數量   ：{len(TARGET_NAMES)}")

    if len(mp3_files) != len(TARGET_NAMES):
        print("\n⚠️ 數量不一致，先不要動手。")
        print("   - 請確認這個資料夾裡只有這一批要改名的 mp3")
        print("   - 或是少下載／多下載了幾個檔案")
        return

    # 先預覽一下對應
    print("\n即將進行的重新命名：")
    for old, newbase in zip(mp3_files, TARGET_NAMES):
        print(f"  {old.name}  →  {newbase}.mp3")

    ans = input("\n確認要開始重新命名嗎？(y/N) ").strip().lower()
    if ans != "y":
        print("已取消，不做任何更動。")
        return

    # 實際改名
    for old, newbase in zip(mp3_files, TARGET_NAMES):
        new_name = root / f"{newbase}.mp3"

        # 如果目標檔名已經存在，就避免覆蓋
        if new_name.exists():
            print(f"⚠️ 略過：{new_name.name} 已存在，避免覆蓋。")
            continue

        print(f"重新命名：{old.name} → {new_name.name}")
        os.rename(old, new_name)

    print("\n✅ 完成！請檢查資料夾中的新檔名。")

if __name__ == "__main__":
    main()