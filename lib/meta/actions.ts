/**
 * Acciones de escritura sobre Meta Ads: pausar/reactivar y ajustar
 * presupuesto. Siempre lee el estado en vivo desde la Graph API antes de
 * calcular el nuevo valor -- nunca confía en datos cacheados en SQLite
 * para decisiones que mueven gasto real.
 *
 * Requiere que META_ACCESS_TOKEN tenga el permiso `ads_management`
 * (`ads_read` no alcanza para estas llamadas).
 */

import { metaGet, metaPost } from "./api";

export const BUDGET_ADJUST_PCT = 0.2;

// Monedas sin decimales de Meta: daily_budget se expresa en la unidad
// entera de la moneda (no hay que multiplicar/dividir por 100).
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

let cachedCurrency: { accountId: string; currency: string } | null = null;

export async function getMetaAccountCurrency(accountId: string): Promise<string> {
  if (cachedCurrency && cachedCurrency.accountId === accountId) {
    return cachedCurrency.currency;
  }
  const body = await metaGet(`/${accountId}`, { fields: "currency" });
  const currency = String(body.currency ?? "USD");
  cachedCurrency = { accountId, currency };
  return currency;
}

function toMinorUnits(pesos: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? Math.round(pesos) : Math.round(pesos * 100);
}

function fromMinorUnits(minorUnits: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? minorUnits : minorUnits / 100;
}

export interface MetaEntityLive {
  name: string;
  status: string;
  /** Presupuesto diario en unidades de la moneda de la cuenta (pesos, no centavos); null si el objeto no controla presupuesto propio (p. ej. adset bajo CBO de campaña). */
  dailyBudget: number | null;
}

export async function getMetaEntityLive(
  entityId: string,
  currency: string
): Promise<MetaEntityLive> {
  const body = await metaGet(`/${entityId}`, {
    fields: "name,effective_status,daily_budget",
  });
  const rawBudget = body.daily_budget;
  return {
    name: String(body.name ?? ""),
    status: String(body.effective_status ?? ""),
    dailyBudget:
      rawBudget === undefined || rawBudget === null
        ? null
        : fromMinorUnits(Number(rawBudget), currency),
  };
}

export async function pauseMetaEntity(entityId: string, pause: boolean): Promise<void> {
  await metaPost(`/${entityId}`, { status: pause ? "PAUSED" : "ACTIVE" });
}

export interface BudgetAdjustResult {
  oldBudget: number;
  newBudget: number;
  currency: string;
}

export async function adjustMetaBudget(
  entityId: string,
  accountId: string,
  deltaPct: number
): Promise<BudgetAdjustResult> {
  const currency = await getMetaAccountCurrency(accountId);
  const live = await getMetaEntityLive(entityId, currency);
  if (live.dailyBudget === null) {
    throw new Error(
      "Este elemento no maneja presupuesto propio (probablemente usa presupuesto a nivel de campaña / CBO). Ajusta el presupuesto en la campaña."
    );
  }
  const newBudget = Math.max(1, live.dailyBudget * (1 + deltaPct));
  await metaPost(`/${entityId}`, {
    daily_budget: String(toMinorUnits(newBudget, currency)),
  });
  return { oldBudget: live.dailyBudget, newBudget, currency };
}
