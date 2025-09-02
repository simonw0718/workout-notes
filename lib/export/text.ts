// lib/export/text.ts
// 匯出符合模板的純文字摘要（總重量以 kg 計）

import { getDB, listAllExercises, listSetsBySession } from "@/lib/db";
import type { Unit } from "@/lib/models/types";

const LB_TO_KG = 0.45359237;
const unitOrDefault = (u?: Unit): Unit => u ?? "lb";
const toKg = (w: number, unit?: Unit) =>
  unitOrDefault(unit) === "kg" ? w : Math.round(w * LB_TO_KG * 1000) / 1000;

function formatDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function exportSessionText(sessionId: string): Promise<string> {
  await getDB();

  const sets = await listSetsBySession(sessionId);
  const exercises = await listAllExercises();
  const nameById = new Map(exercises.map((e) => [e.id, e.name]));

  if (sets.length === 0) {
    return `[日期] ${formatDate()}
[總結] 0 動作，共 0 組；總量 0 kg`;
  }

  type Group = { name: string; rows: string[]; subtotalKg: number };
  const byEx = new Map<string, Group>();

  for (const s of sets) {
    const exName = nameById.get(s.exerciseId) ?? "Unknown";
    const unit = unitOrDefault(s.unit);
    if (!byEx.has(s.exerciseId)) {
      byEx.set(s.exerciseId, { name: exName, rows: [], subtotalKg: 0 });
    }
    const g = byEx.get(s.exerciseId)!;
    const rpeTxt = s.rpe != null ? ` RPE${s.rpe}` : ""; // ← 新增
    g.rows.push(`${s.weight}${unit}×${s.reps}${rpeTxt}`); // ← 改這
    g.subtotalKg += toKg(s.weight, unit) * s.reps;
  }

  const totalSets = sets.length;
  const totalExercises = byEx.size;
  const totalWeightKg = Array.from(byEx.values()).reduce(
    (sum, g) => sum + g.subtotalKg,
    0,
  );

  const ordered = Array.from(byEx.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const lines: string[] = [];
  lines.push(`[日期] ${formatDate()}`);
  lines.push(
    `[總結] ${totalExercises} 動作，共 ${totalSets} 組；總量 ${Math.round(totalWeightKg * 10) / 10} kg`,
  );
  lines.push("");

  for (const g of ordered) {
    lines.push(g.name);
    for (const r of g.rows) lines.push(`- ${r}`);
    lines.push("");
  }

  if (lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
