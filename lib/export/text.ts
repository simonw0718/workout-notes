import { getDB } from "@/lib/db";
import { getMeta } from "@/lib/db/meta";
import { listAllExercises, listSetsBySession } from "@/lib/db/history";
import type { Unit, Exercise } from "@/lib/models/types";

const LB_TO_KG = 0.45359237;
const unitOrDefault = (u?: Unit): Unit => u ?? "lb";
const toKg = (w: number, unit?: Unit) =>
  unitOrDefault(unit) === "kg" ? w : Math.round(w * LB_TO_KG * 1000) / 1000;

export async function exportSessionText(sessionId: string): Promise<string> {
  await getDB();

  // Meta 目前沒有定義 unit；若存在就用，否則預設 lb
  type MaybeUnit = { unit?: Unit };
  const meta = (await getMeta()) as MaybeUnit;
  const defaultUnit = unitOrDefault(meta.unit);

  const sets = await listSetsBySession(sessionId);
  const exercises = await listAllExercises();

  const exById = new Map<string, Exercise>();
  exercises.forEach((e) => exById.set(e.id, e));

  if (sets.length === 0) {
    return `[日期] ${formatDate()}\n[總結] 0 動作；共 0 組；總量 0 kg`;
  }

  type Group = { name: string; rows: string[]; subtotalKg: number };
  const byEx = new Map<string, Group>();

  for (const s of sets) {
    const ex = exById.get(s.exerciseId);
    const exName = ex?.name ?? "Unknown";
    const unit = defaultUnit; // 全程用偏好單位（或預設）

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

  return `[日期] ${formatDate()}

${blocks.join("\n\n")}

[總結] ${byEx.size} 動作；共 ${sets.length} 組；總量 ${totalKg.toFixed(1)} kg`;
}

function formatDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}