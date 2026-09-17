/**
 * Curva "qué pasaría si": corre allocateBudget con distintos niveles de
 * presupuesto diario total y agrega el retorno esperado, asumiendo
 * eficiencia constante por campaña (misma limitación documentada en
 * simulate.ts -- no modela rendimientos decrecientes al escalar más allá
 * del inventario/audiencia eficiente).
 *
 * A diferencia de simulate.ts (que proyecta UNA campaña con UN delta), este
 * módulo corre el motor de reparto real (allocateBudget/efficiencyScore)
 * para TODAS las campañas elegibles a la vez, en varios niveles de
 * presupuesto total -- por eso vive separado, no es una extensión de
 * simulate.ts.
 */

import { allocateBudget, type CampaignAllocationInput } from "./allocate";

export const CURVE_STEPS = [-0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0];

export interface CurvePoint {
  deltaPct: number;
  dailyTotal: number;
  projectedSpend: number;
  projectedConversions: number;
  projectedValue: number;
  projectedRoas: number;
}

export function buildBudgetCurve(
  campaigns: CampaignAllocationInput[],
  currentDailyTotal: number,
  steps: number[] = CURVE_STEPS,
  goalOverrides?: Parameters<typeof allocateBudget>[2]
): CurvePoint[] {
  return steps.map((deltaPct) => {
    const dailyTotal = Math.max(0, currentDailyTotal * (1 + deltaPct));
    const allocations = dailyTotal > 0 ? allocateBudget(campaigns, dailyTotal, goalOverrides) : [];
    const allocationByCampaign = new Map(allocations.map((a) => [a.campaignId, a]));

    let projectedSpend = 0;
    let projectedConversions = 0;
    let projectedValue = 0;
    for (const c of campaigns) {
      const target = allocationByCampaign.get(c.campaignId)?.targetDailyBudget ?? 0;
      // Tasas históricas por unidad de gasto (ROAS / conversiones-por-peso) --
      // dimensionalmente consistentes sin necesitar la duración de la ventana:
      // target ($/día) * tasa (valor o conversiones por $) = proyección diaria.
      const valueRate = c.spend > 0 ? c.value / c.spend : 0;
      const convRate = c.spend > 0 ? c.conversions / c.spend : 0;
      projectedSpend += target;
      projectedValue += target * valueRate;
      projectedConversions += target * convRate;
    }

    return {
      deltaPct,
      dailyTotal,
      projectedSpend,
      projectedConversions,
      projectedValue,
      projectedRoas: projectedSpend > 0 ? projectedValue / projectedSpend : 0,
    };
  });
}
