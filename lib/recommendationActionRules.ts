/**
 * Reglas puras (sin I/O) de qué acción está disponible para qué
 * recomendación. Módulo sin dependencias de servidor para poder
 * importarse también desde componentes cliente (p. ej. para decidir qué
 * botones mostrar sin ida y vuelta al servidor).
 */

export type Platform = "meta" | "google";
export type ActionKey = "pause" | "budget_up" | "budget_down";

export const ACTION_LABELS: Record<ActionKey, string> = {
  pause: "Pausar",
  budget_up: "Aumentar presupuesto 20%",
  budget_down: "Reducir presupuesto 20%",
};

const PAUSE_RULES = new Set([
  "high_spend_no_purchases",
  "high_spend_no_results",
  "high_spend_no_clicks",
  "low_roas",
  "high_cpa",
  "high_cpl",
  "high_cpc",
  "bn_no_conversions",
]);
const BUDGET_DOWN_RULES = new Set([
  "low_roas",
  "high_cpa",
  "high_cpl",
  "bn_sustained_cpa",
  "bn_above_target",
  "bn_no_conversions",
]);
const BUDGET_UP_RULES = new Set([
  "top_performer",
  "top_cpl",
  "top_cpc",
  "bn_sustained_roas",
  "bn_pace_ahead",
  "bn_below_target",
]);

/** Los anuncios (Meta) y ad groups (Google) no tienen presupuesto propio. */
function budgetLevelAllowed(platform: Platform, level: string): boolean {
  return platform === "google" ? level === "campaign" : level === "campaign" || level === "adset";
}

export function availableActionsFor(
  platform: Platform,
  level: string,
  rule: string
): ActionKey[] {
  const actions: ActionKey[] = [];
  if (PAUSE_RULES.has(rule)) actions.push("pause");
  if (budgetLevelAllowed(platform, level)) {
    if (BUDGET_DOWN_RULES.has(rule)) actions.push("budget_down");
    if (BUDGET_UP_RULES.has(rule)) actions.push("budget_up");
  }
  return actions;
}
