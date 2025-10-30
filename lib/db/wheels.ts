// lib/db/wheels.ts
// 目的：管理「滾輪選項」(器材清單 + 常見動作清單)；IndexedDB 單獨 store，避免動到既有 schema

import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "workout-notes-wheels";
const DB_VER = 1;
const STORE = "wheelOptions";

type WheelsDoc = {
  id: "wheels";
  equip: string[];   // 左側（器材）顯示清單
  moves: string[];   // 右側（動作）顯示清單
  updatedAt: number; // ms
};

let _db: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!_db) {
    _db = openDB(DB_NAME, DB_VER, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return _db!;
}

const DEFAULT_EQUIP = ["啞鈴", "槓鈴", "器械", "繩索", "徒手", "其他"];
const DEFAULT_MOVES = [
  "胸推", "肩推", "划船", "深蹲", "腿推", "硬舉",
  "側平舉", "前平舉", "飛鳥", "二頭彎舉", "三頭下壓",
  "卷腹", "抬腿",
];

export async function loadWheels(): Promise<WheelsDoc> {
  const db = await getDB();
  const doc = (await db.get(STORE, "wheels")) as WheelsDoc | undefined;
  if (doc) return doc;
  // 首次給預設
  const seed: WheelsDoc = {
    id: "wheels",
    equip: DEFAULT_EQUIP.slice(),
    moves: DEFAULT_MOVES.slice(),
    updatedAt: Date.now(),
  };
  await db.put(STORE, seed);
  return seed;
}

export async function saveWheels(input: { equip: string[]; moves: string[] }) {
  const db = await getDB();
  const doc: WheelsDoc = {
    id: "wheels",
    equip: dedupAndTrim(input.equip),
    moves: dedupAndTrim(input.moves),
    updatedAt: Date.now(),
  };
  await db.put(STORE, doc);
  return doc;
}

function dedupAndTrim(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const s = (raw ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}