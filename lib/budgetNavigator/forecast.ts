/**
 * Proyección de cierre de mes (pura, sin I/O): con el ritmo de gasto
 * reciente (últimos FORECAST_WINDOW_DAYS días con datos) extrapola el
 * gasto acumulado del mes (MTD) a los días que faltan, y lo compara
 * contra un presupuesto de referencia para alertar desviaciones. Se usa
 * tanto a nivel de campaña (referencia = su propio presupuesto diario en
 * vivo x días del mes) como a nivel de cuenta/global (referencia =
 * monthly_budget) -- el caller decide qué serie de `daily` y qué
 * `referenceMonthlyBudget` pasar.
 *
 * Complementa (no reemplaza) bn_below_target/bn_above_target de
 * allocate.ts: esos responden "¿mi reparto es justo según eficiencia?";
 * bn_forecast_* responde "¿me voy a salir del presupuesto que ya tengo,
 * al ritmo actual?".
 */

import type { CampaignCategory } from "../campaignCategory";
import type { BudgetFinding, DailyMetricRow } from "./rules";

export const FORECAST_WINDOW_DAYS = 7;
export const FORECAST_DEVIATION_PCT = 0.15;
const MIN_DAYS_ELAPSED = 3;

const money = (n: number) => "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
const pct = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 }) + "%";

export interface ForecastInput {
  name: string;
  category: CampaignCategory;
  /** Filas del 1º del mes hasta hoy, orden ascendente. */
  daily: DailyMetricRow[];
  /** Presupuesto de referencia para todo el mes; null si no hay ninguno configurado/leído. */
  referenceMonthlyBudget: number | null;
  now?: Date;
}

export interface ForecastResult {
  daysElapsed: number;
  daysRemaining: number;
  daysInMonth: number;
  spendMtd: number;
  dailyRunRate: number;
  projectedSpend: number;
  conversionsMtd: number;
  projectedConversions: number;
  valueMtd: number;
  projectedValue: number;
  projectedRoas: number;
  projectedCpa: number;
  /** (proyectado - referencia) / referencia; null si no hay referencia. */
  deviationPct: number | null;
  findings: BudgetFinding[];
}

export function projectMonthEnd(params: ForecastInput): ForecastResult {
  const { name, category, daily, referenceMonthlyBudget, now = new Date() } = params;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  const spendMtd = daily.reduce((a, d) => a + d.spend, 0);
  const conversionsMtd = daily.reduce((a, d) => a + d.conversions, 0);
  const valueMtd = daily.reduce((a, d) => a + d.value, 0);

  const window = daily.slice(-FORECAST_WINDOW_DAYS);
  const windowDays = Math.max(1, window.length);
  const dailyRunRate = window.reduce((a, d) => a + d.spend, 0) / windowDays;
  const dailyConvRate = window.reduce((a, d) => a + d.conversions, 0) / windowDays;
  const dailyValueRate = window.reduce((a, d) => a + d.value, 0) / windowDays;

  const projectedSpend = spendMtd + dailyRunRate * daysRemaining;
  const projectedConversions = conversionsMtd + dailyConvRate * daysRemaining;
  const projectedValue = valueMtd + dailyValueRate * daysRemaining;
  const projectedRoas = projectedSpend > 0 ? projectedValue / projectedSpend : 0;
  const projectedCpa = projectedConversions > 0 ? projectedSpend / projectedConversions : Infinity;

  const deviationPct =
    referenceMonthlyBudget && referenceMonthlyBudget > 0
      ? (projectedSpend - referenceMonthlyBudget) / referenceMonthlyBudget
      : null;

  // awareness no se gestiona por presupuesto/eficiencia en el resto del motor
  // (ver rules.ts/allocate.ts) -- se mantiene la misma exclusión aquí.
  const findings: BudgetFinding[] = [];
  if (deviationPct !== null && daysElapsed >= MIN_DAYS_ELAPSED && category !== "awareness") {
    if (deviationPct > FORECAST_DEVIATION_PCT) {
      findings.push({
        rule: "bn_forecast_overspend",
        priority: "high",
        title: "Proyección de cierre por encima del presupuesto",
        detail: `Al ritmo de los últimos ${windowDays} días, "${name}" proyecta cerrar el mes gastando ${money(projectedSpend)}, ${pct(deviationPct * 100)} por encima de su presupuesto de referencia (${money(referenceMonthlyBudget!)}). Considera reducir su presupuesto diario para no salirte del plan.`,
      });
    } else if (deviationPct < -FORECAST_DEVIATION_PCT) {
      findings.push({
        rule: "bn_forecast_underspend",
        priority: "low",
        title: "Proyección de cierre por debajo del presupuesto",
        detail: `Al ritmo de los últimos ${windowDays} días, "${name}" proyecta cerrar el mes gastando solo ${money(projectedSpend)}, ${pct(Math.abs(deviationPct) * 100)} por debajo de su presupuesto de referencia (${money(referenceMonthlyBudget!)}). Hay margen para aumentar su presupuesto diario y aprovecharlo.`,
      });
    }
  }

  return {
    daysElapsed,
    daysRemaining,
    daysInMonth,
    spendMtd,
    dailyRunRate,
    projectedSpend,
    conversionsMtd,
    projectedConversions,
    valueMtd,
    projectedValue,
    projectedRoas,
    projectedCpa,
    deviationPct,
    findings,
  };
}
