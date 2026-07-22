/**
 * Simulador "qué pasaría si": proyección lineal simple a partir del
 * historial reciente de la campaña. Asume eficiencia constante (por
 * eso el ROAS proyectado sale igual al actual) -- se documenta como
 * estimación, no como modelo predictivo, tanto aquí como en la UI.
 */

import type { DailyMetricRow } from "./rules";

export const SIMULATE_WINDOW_DAYS = 14;

export interface SimulationResult {
  campaignName: string;
  deltaPct: number;
  windowDays: number;
  currentDailySpend: number;
  currentConversions: number;
  currentValue: number;
  currentRoas: number;
  projectedDailySpend: number;
  projectedConversions: number;
  projectedValue: number;
  projectedRoas: number;
  dailyTrend: Array<{ date: string; spend: number; roas: number }>;
}

export function simulateBudgetChange(params: {
  name: string;
  days: DailyMetricRow[];
  deltaPct: number;
}): SimulationResult {
  const { name, days, deltaPct } = params;
  const n = Math.max(1, days.length);
  const totalSpend = days.reduce((a, d) => a + d.spend, 0);
  const totalConversions = days.reduce((a, d) => a + d.conversions, 0);
  const totalValue = days.reduce((a, d) => a + d.value, 0);
  const currentDailySpend = totalSpend / n;
  const currentRoas = totalSpend > 0 ? totalValue / totalSpend : 0;
  const scale = 1 + deltaPct;

  return {
    campaignName: name,
    deltaPct,
    windowDays: days.length,
    currentDailySpend,
    currentConversions: totalConversions,
    currentValue: totalValue,
    currentRoas,
    projectedDailySpend: currentDailySpend * scale,
    projectedConversions: totalConversions * scale,
    projectedValue: totalValue * scale,
    // Constante bajo el supuesto de eficiencia lineal -- en la realidad el
    // ROAS puede caer al escalar más allá del inventario/audiencia eficiente;
    // este simulador no modela rendimientos decrecientes.
    projectedRoas: currentRoas,
    dailyTrend: days.map((d) => ({
      date: d.date,
      spend: d.spend,
      roas: d.spend > 0 ? d.value / d.spend : 0,
    })),
  };
}
