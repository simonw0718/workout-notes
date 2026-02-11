import os
import re
import subprocess

BASE_FOLDER = os.path.dirname(os.path.abspath(__file__))

action_list = [
    'Brace marches',
    'Heel touch',
    'Bear hold',
    'Swimmer',
    'Bird dog',
    'Single leg bridges',
    'Hamstring stretch',
    'Lumbar rotation stretch',
    'Piriformis stretch',
    'Tall knee hip flexor stretch',
    'Child pose stretch',
    'Upper back extension',
    'Seated spine rotation stretch',
    'Upper trap stretch',
    'Glute bridges',
    'Serratus pushes',
    'Push up plus progression',
    'Serratus punches',
    'Band pull apart',
    'Band Y raise',
    'Serratus wall slides',
    'Cat cow',
    '90/90 hip switches',
    'Hamstring reach',
    'Thread the needle',
    'Rocking hip flexor',
    'Glute figure-4',
    'Knees to chest'
]

def safe_filename(name: str) -> str:
    name = name.replace("/", "-")
    name = re.sub(r'[<>:"\\|?*]', '', name)
    return name.strip()

def get_birth_time(path):
    cmd = ["stat", "-f", "%B", path]  # macOS birth time (Unix timestamp)
    result = subprocess.run(cmd, capture_output=True, text=True)
    return int(result.stdout.strip())

# 取得所有 mp3
mp3_files = [f for f in os.listdir(BASE_FOLDER) if f.lower().endswith(".mp3")]

# 依「真正建立時間」排序
mp3_files.sort(key=lambda f: get_birth_time(os.path.join(BASE_FOLDER, f)))

print("📂 依下載時間排序後：")
for f in mp3_files:
    print(f)

# 兩段式改名，避免互撞
temp_names = []
for i, old_name in enumerate(mp3_files):
    temp_name = f"__temp__{i}__.mp3"
    os.rename(
        os.path.join(BASE_FOLDER, old_name),
        os.path.join(BASE_FOLDER, temp_name)
    )
    temp_names.append(temp_name)

for i, temp_name in enumerate(temp_names):
    if i >= len(action_list):
        break

    new_name = safe_filename(action_list[i]) + ".mp3"
    temp_path = os.path.join(BASE_FOLDER, temp_name)
    new_path = os.path.join(BASE_FOLDER, new_name)

    if os.path.exists(new_path):
        os.remove(new_path)

    os.rename(temp_path, new_path)
    print(f"✅ {temp_name} -> {new_name}")

print("\n🎉 依『真正下載順序』重命名完成")