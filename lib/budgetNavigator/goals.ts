/**
 * Metas de KPI por categoría (leads/sales/traffic/awareness), una fila por
 * categoría en `budget_navigator_goals`. Cuando existe una meta, el motor
 * (engine.ts) la usa en vez del promedio de cuenta al puntuar campañas en
 * `allocate.ts` y al evaluar rachas en `rules.ts` -- así el reparto se
 * optimiza hacia la meta, no solo hacia el promedio histórico.
 *
 * `cpaTarget` se reinterpreta como CPL (leads) o CPC (traffic) según la
 * categoría, igual que ya hace `avgCpa` en rules.ts/engine.ts hoy.
 * `kpiCountTarget` (ej. "# leads objetivo") es informativo por ahora, no
 * alimenta el reparto.
 */

import { getDb } from "../db";
import type { CampaignCategory } from "../campaignCategory";

export interface CategoryGoal {
  category: CampaignCategory;
  roasTarget: number | null;
  cpaTarget: number | null;
  kpiCountTarget: number | null;
}

interface GoalRow {
  category: string;
  roas_target: number | null;
  cpa_target: number | null;
  kpi_count_target: number | null;
}

export function getGoals(): Partial<Record<CampaignCategory, CategoryGoal>> {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM budget_navigator_goals`).all() as GoalRow[];
  const goals: Partial<Record<CampaignCategory, CategoryGoal>> = {};
  for (const r of rows) {
    goals[r.category as CampaignCategory] = {
      category: r.category as CampaignCategory,
      roasTarget: r.roas_target,
      cpaTarget: r.cpa_target,
      kpiCountTarget: r.kpi_count_target,
    };
  }
  return goals;
}

export function setGoal(
  category: CampaignCategory,
  input: Partial<Omit<CategoryGoal, "category">>
): void {
  const db = getDb();
  const current = db
    .prepare(`SELECT * FROM budget_navigator_goals WHERE category = ?`)
    .get(category) as GoalRow | undefined;

  const roasTarget = input.roasTarget !== undefined ? input.roasTarget : current?.roas_target ?? null;
  const cpaTarget = input.cpaTarget !== undefined ? input.cpaTarget : current?.cpa_target ?? null;
  const kpiCountTarget =
    input.kpiCountTarget !== undefined ? input.kpiCountTarget : current?.kpi_count_target ?? null;

  db.prepare(
    `INSERT INTO budget_navigator_goals (category, roas_target, cpa_target, kpi_count_target, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (category) DO UPDATE SET
       roas_target = excluded.roas_target,
       cpa_target = excluded.cpa_target,
       kpi_count_target = excluded.kpi_count_target,
       updated_at = excluded.updated_at`
  ).run(category, roasTarget, cpaTarget, kpiCountTarget);
}
