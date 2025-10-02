//lib/export/text.ts
import { getDB, getSessionById } from "@/lib/db";
import { getMeta } from "@/lib/db/meta";
import { listAllExercises, listSetsBySession } from "@/lib/db/history";
import type { Unit, Exercise } from "@/lib/models/types";

const LB_TO_KG = 0.45359237;
const unitOrDefault = (u?: Unit): Unit => u ?? "lb";
const toKg = (w: number, unit?: Unit) =>
  unitOrDefault(unit) === "kg" ? w : Math.round(w * LB_TO_KG * 1000) / 1000;

export async function exportSessionText(sessionId: string): Promise<string> {
  await getDB();

  type MaybeUnit = { unit?: Unit };
  const meta = (await getMeta()) as MaybeUnit;
  const defaultUnit = unitOrDefault(meta.unit);

  const sets = await listSetsBySession(sessionId);
  const exercises = await listAllExercises();

  // 先決定日期/時間來源
  const session = await getSessionById(sessionId);
  let ts: number | null = session?.startedAt ?? null;
  if (!ts && sets.length > 0) {
    ts = Math.min(...sets.map((s) => s.createdAt));
  }
  const dateStr = formatDate(ts ? new Date(ts) : new Date());
  const startStr = session?.startedAt ? formatTime(new Date(session.startedAt)) : "-";
  const endStr = session?.endedAt ? formatTime(new Date(session.endedAt)) : "-";

  const exById = new Map<string, Exercise>();
  exercises.forEach((e) => exById.set(e.id, e));

  if (sets.length === 0) {
    return `[日期] ${dateStr}\n[開始] ${startStr}\n[結束] ${endStr}\n[總結] 0 動作；共 0 組；總量 0 kg`;
  }

  type Group = { name: string; rows: string[]; subtotalKg: number };
  const byEx = new Map<string, Group>();

  for (const s of sets) {
    const ex = exById.get(s.exerciseId);
    const exName = ex?.name ?? "Unknown";
    const unit = defaultUnit;

    if (!byEx.has(s.exerciseId)) {
      byEx.set(s.exerciseId, { name: exName, rows: [], subtotalKg: 0 });
    }

    const g = byEx.get(s.exerciseId)!;
    const rpeTxt = s.rpe != null ? ` RPE${s.rpe}` : "";
    g.rows.push(`${s.weight}${unit}×${s.reps}${rpeTxt}`);
    g.subtotalKg += toKg(s.weight, unit) * s.reps;
  }

  const blocks: string[] = [];
  for (const g of byEx.values()) {
    blocks.push(`${g.name}\n${g.rows.join("、")}\n小計${g.subtotalKg.toFixed(1)} kg`);
  }

  const totalKg = Array.from(byEx.values()).reduce((a, b) => a + b.subtotalKg, 0);

  return `[日期] ${dateStr}
[開始] ${startStr}
[結束] ${endStr}

${blocks.join("\n\n")}

[總結] ${byEx.size} 動作；共 ${sets.length} 組；總量 ${totalKg.toFixed(1)} kg`;
}

function formatDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}