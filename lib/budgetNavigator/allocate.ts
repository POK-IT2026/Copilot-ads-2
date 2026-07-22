/**
 * Reparto proporcional del presupuesto maestro entre campañas activas,
 * según su eficiencia relativa al promedio de cuenta de su propia
 * categoría, y comparación contra el presupuesto actual (leído en vivo
 * por el caller -- este módulo no hace I/O).
 */

import { fmtMoney } from "../format";
import type { CampaignCategory } from "../campaignCategory";
import type { BudgetFinding } from "./rules";

export const TARGET_MARGIN_PCT = 0.1;
const MIN_SCORE = 0.1;
const MAX_SCORE = 3;

export interface CampaignAllocationInput {
  campaignId: string;
  name: string;
  category: CampaignCategory;
  spend: number;
  conversions: number;
  value: number;
  clicks: number;
  /** Presupuesto diario leído en vivo de la plataforma; null si no aplica/no se pudo leer. */
  currentDailyBudget: number | null;
}

export interface AllocationResult {
  campaignId: string;
  name: string;
  category: CampaignCategory;
  score: number;
  targetDailyBudget: number;
  currentDailyBudget: number | null;
  findings: BudgetFinding[];
}

function categoryAverages(campaigns: CampaignAllocationInput[]) {
  const byCategory: Record<string, { spend: number; value: number; conversions: number; clicks: number }> = {};
  for (const c of campaigns) {
    const bucket = (byCategory[c.category] ??= { spend: 0, value: 0, conversions: 0, clicks: 0 });
    bucket.spend += c.spend;
    bucket.value += c.value;
    bucket.conversions += c.conversions;
    bucket.clicks += c.clicks;
  }
  return {
    roas: (byCategory.sales?.spend ?? 0) > 0 ? byCategory.sales.value / byCategory.sales.spend : 0,
    cpl:
      (byCategory.leads?.conversions ?? 0) > 0 ? byCategory.leads.spend / byCategory.leads.conversions : 0,
    cpc:
      (byCategory.traffic?.clicks ?? 0) > 0 ? byCategory.traffic.spend / byCategory.traffic.clicks : 0,
  };
}

function efficiencyScore(
  c: CampaignAllocationInput,
  avg: { roas: number; cpl: number; cpc: number }
): number {
  let score = 1;
  if (c.category === "sales" && avg.roas > 0) {
    const roas = c.spend > 0 ? c.value / c.spend : 0;
    score = roas > 0 ? roas / avg.roas : MIN_SCORE;
  } else if (c.category === "leads" && avg.cpl > 0) {
    const cpl = c.conversions > 0 ? c.spend / c.conversions : Infinity;
    score = Number.isFinite(cpl) && cpl > 0 ? avg.cpl / cpl : MIN_SCORE;
  } else if (c.category === "traffic" && avg.cpc > 0) {
    const cpc = c.clicks > 0 ? c.spend / c.clicks : Infinity;
    score = Number.isFinite(cpc) && cpc > 0 ? avg.cpc / cpc : MIN_SCORE;
  }
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
}

/**
 * `dailyTotal` es el presupuesto diario total (presupuesto mensual /
 * días del mes). Solo participan del reparto campañas con categoría
 * distinta de "awareness" y con presupuesto actual leído en vivo.
 */
export function allocateBudget(
  campaigns: CampaignAllocationInput[],
  dailyTotal: number
): AllocationResult[] {
  const eligible = campaigns.filter((c) => c.category !== "awareness" && c.currentDailyBudget !== null);
  if (eligible.length === 0) return [];

  const avg = categoryAverages(eligible);
  const scored = eligible.map((c) => ({ ...c, score: efficiencyScore(c, avg) }));
  const totalScore = scored.reduce((a, c) => a + c.score, 0);

  return scored.map((c) => {
    const targetDailyBudget = totalScore > 0 ? dailyTotal * (c.score / totalScore) : 0;
    const current = c.currentDailyBudget ?? 0;
    const findings: BudgetFinding[] = [];

    if (current > 0) {
      const diffPct = (targetDailyBudget - current) / current;
      if (diffPct > TARGET_MARGIN_PCT) {
        findings.push({
          rule: "bn_below_target",
          priority: "low",
          title: "Oportunidad de crecimiento según presupuesto maestro",
          detail: `"${c.name}" tiene un presupuesto diario de ${fmtMoney(current)}; según su eficiencia relativa dentro del presupuesto maestro, su reparto justo sería de ~${fmtMoney(targetDailyBudget)}. Aumentarlo aprovecharía mejor el presupuesto total disponible.`,
        });
      } else if (diffPct < -TARGET_MARGIN_PCT) {
        findings.push({
          rule: "bn_above_target",
          priority: "low",
          title: "Por encima de su reparto justo",
          detail: `"${c.name}" tiene un presupuesto diario de ${fmtMoney(current)}, por encima de su reparto justo (~${fmtMoney(targetDailyBudget)}) dentro del presupuesto maestro. Considera reducirlo y reasignar hacia campañas con mejor desempeño.`,
        });
      }
    }

    return {
      campaignId: c.campaignId,
      name: c.name,
      category: c.category,
      score: c.score,
      targetDailyBudget,
      currentDailyBudget: c.currentDailyBudget,
      findings,
    };
  });
}
