/**
 * Reglas puras (sin I/O) del "Motor Inteligente" de Budget Navigator:
 * miran el historial día a día de una campaña (a diferencia del motor de
 * recomendaciones existente, que agrega todo el rango de fechas
 * seleccionado) para detectar rachas sostenidas, ritmo de gasto y falta
 * de conversiones.
 */

import type { CampaignCategory } from "../campaignCategory";

export type BudgetRuleId =
  | "bn_sustained_roas"
  | "bn_pace_ahead"
  | "bn_sustained_cpa"
  | "bn_no_conversions"
  | "bn_below_target"
  | "bn_above_target";

export interface BudgetFinding {
  rule: BudgetRuleId;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface DailyMetricRow {
  date: string;
  spend: number;
  /** leads: leads+mensajes; sales: compras/conversiones; traffic: clics */
  conversions: number;
  /** valor monetario de conversión; 0 si no aplica (leads/traffic) */
  value: number;
}

export const LOOKBACK_DAYS = 7;
export const STREAK_DAYS = 3;
export const PACE_HOUR_CUTOFF = 12;
export const PACE_SPEND_PCT = 0.8;
export const CPA_MULTIPLIER = 1.5;

const money = (n: number) => "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
const pct = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 }) + "%";
const dec = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

function roasOf(d: DailyMetricRow): number {
  return d.spend > 0 ? d.value / d.spend : 0;
}
function cpaOf(d: DailyMetricRow): number {
  return d.conversions > 0 ? d.spend / d.conversions : Infinity;
}

/**
 * `days` debe venir ordenado ascendente (más viejo primero) y cubrir
 * como máximo `LOOKBACK_DAYS`. `currentDailyBudget` es el presupuesto
 * diario leído EN VIVO de la plataforma (null si no se pudo leer o el
 * nivel no maneja presupuesto propio).
 */
export function evaluateBudgetHistory(params: {
  name: string;
  category: CampaignCategory;
  days: DailyMetricRow[];
  avgRoas: number;
  avgCpa: number;
  currentDailyBudget: number | null;
  nowHour: number;
}): BudgetFinding[] {
  const { name, category, days, avgRoas, avgCpa, currentDailyBudget, nowHour } = params;
  const findings: BudgetFinding[] = [];
  if (days.length === 0 || category === "awareness") return findings;

  const today = days[days.length - 1];

  // bn_sustained_roas: solo sales, que es la única categoría con valor
  // monetario de conversión real para calcular ROAS.
  if (category === "sales" && avgRoas > 0) {
    const streak = days.slice(-STREAK_DAYS);
    const sustained =
      streak.length === STREAK_DAYS && streak.every((d) => d.spend > 0 && roasOf(d) > avgRoas);
    if (sustained) {
      findings.push({
        rule: "bn_sustained_roas",
        priority: "medium",
        title: "ROAS sostenido por encima del promedio",
        detail: `"${name}" mantiene un ROAS por encima del promedio de cuenta (${dec(avgRoas)}) durante los últimos ${STREAK_DAYS} días. Aumentar presupuesto podría capturar más conversiones sin perder eficiencia.`,
      });
    }
  }

  // bn_pace_ahead: cualquier campaña con presupuesto propio leído en vivo.
  if (currentDailyBudget && currentDailyBudget > 0 && nowHour < PACE_HOUR_CUTOFF) {
    const paceRatio = today.spend / currentDailyBudget;
    const roasOk = category === "sales" ? roasOf(today) > avgRoas : true;
    if (paceRatio > PACE_SPEND_PCT && roasOk) {
      findings.push({
        rule: "bn_pace_ahead",
        priority: "high",
        title: "Ritmo de gasto adelantado",
        detail: `"${name}" ya consumió ${pct(paceRatio * 100)} de su presupuesto diario antes del mediodía. Si el rendimiento se mantiene, podría estar perdiendo oportunidades por falta de presupuesto.`,
      });
    }
  }

  // bn_sustained_cpa: leads (CPL) y traffic (CPC) -- sales ya se evalúa por ROAS.
  if ((category === "leads" || category === "traffic") && avgCpa > 0) {
    const streak = days.slice(-STREAK_DAYS);
    const sustainedHigh =
      streak.length === STREAK_DAYS &&
      streak.every((d) => d.conversions > 0 && cpaOf(d) > CPA_MULTIPLIER * avgCpa);
    if (sustainedHigh) {
      const metricLabel = category === "leads" ? "CPL" : "CPC";
      findings.push({
        rule: "bn_sustained_cpa",
        priority: "high",
        title: `${metricLabel} elevado sostenido`,
        detail: `"${name}" mantiene un ${metricLabel} por encima de ${dec(CPA_MULTIPLIER)}x el promedio de cuenta (${money(avgCpa)}) durante ${STREAK_DAYS} días consecutivos. Reducir presupuesto evita seguir gastando de forma ineficiente.`,
      });
    }
  }

  // bn_no_conversions: cero conversiones en toda la ventana con gasto > 0.
  if (days.length >= LOOKBACK_DAYS) {
    const spendTotal = days.reduce((a, d) => a + d.spend, 0);
    const convTotal = days.reduce((a, d) => a + d.conversions, 0);
    if (spendTotal > 0 && convTotal === 0) {
      findings.push({
        rule: "bn_no_conversions",
        priority: "high",
        title: "Sin conversiones en el periodo mínimo",
        detail: `"${name}" gastó ${money(spendTotal)} en los últimos ${LOOKBACK_DAYS} días sin generar conversiones. Considera reducir su presupuesto y redistribuirlo hacia campañas con mejor desempeño.`,
      });
    }
  }

  return findings;
}
