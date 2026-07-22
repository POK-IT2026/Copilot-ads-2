/**
 * Acciones de escritura sobre Google Ads: pausar/reactivar, ajustar el
 * presupuesto de una campaña y cambiar la puja (CPC bid) de una keyword.
 * Siempre lee el estado en vivo vía GAQL antes de calcular el nuevo
 * valor -- nunca confía en datos cacheados en SQLite para decisiones que
 * mueven gasto real.
 */

import { gaqlSearch, googleAdsMutate } from "./api";

export const BUDGET_ADJUST_PCT = 0.2;

function cleanCustomerId(customerId: string): string {
  return customerId.replace(/-/g, "").trim();
}

function esc(id: string): string {
  if (!/^[0-9]+$/.test(id)) throw new Error(`Id inválido: ${id}`);
  return id;
}

export interface GoogleCampaignLive {
  status: string;
  budgetResourceName: string;
  amountMicros: number;
  shared: boolean;
}

export async function getGoogleCampaignLive(
  customerId: string,
  campaignId: string
): Promise<GoogleCampaignLive> {
  const rows = (await gaqlSearch(
    customerId,
    `SELECT campaign.status, campaign.campaign_budget,
            campaign_budget.amount_micros, campaign_budget.explicitly_shared
     FROM campaign WHERE campaign.id = ${esc(campaignId)}`
  )) as Array<{
    campaign?: { status?: string; campaignBudget?: string };
    campaignBudget?: { amountMicros?: string | number; explicitlyShared?: boolean };
  }>;
  const row = rows[0];
  if (!row) throw new Error(`Campaña ${campaignId} no encontrada en Google Ads`);
  return {
    status: String(row.campaign?.status ?? ""),
    budgetResourceName: String(row.campaign?.campaignBudget ?? ""),
    amountMicros: Number(row.campaignBudget?.amountMicros) || 0,
    shared: Boolean(row.campaignBudget?.explicitlyShared),
  };
}

export async function getGoogleAdGroupStatus(
  customerId: string,
  adGroupId: string
): Promise<string> {
  const rows = (await gaqlSearch(
    customerId,
    `SELECT ad_group.status FROM ad_group WHERE ad_group.id = ${esc(adGroupId)}`
  )) as Array<{ adGroup?: { status?: string } }>;
  const row = rows[0];
  if (!row) throw new Error(`Ad group ${adGroupId} no encontrado en Google Ads`);
  return String(row.adGroup?.status ?? "");
}

export async function pauseGoogleEntity(
  customerId: string,
  level: "campaign" | "ad_group",
  entityId: string,
  pause: boolean
): Promise<void> {
  const cid = cleanCustomerId(customerId);
  const resourcePlural = level === "campaign" ? "campaigns" : "adGroups";
  const resourceName = `customers/${cid}/${resourcePlural}/${esc(entityId)}`;
  await googleAdsMutate(customerId, resourcePlural, [
    {
      update: { resourceName, status: pause ? "PAUSED" : "ENABLED" },
      updateMask: "status",
    },
  ]);
}

export interface BudgetAdjustResult {
  oldAmountMicros: number;
  newAmountMicros: number;
  shared: boolean;
}

export async function adjustGoogleCampaignBudget(
  customerId: string,
  campaignId: string,
  deltaPct: number
): Promise<BudgetAdjustResult> {
  const live = await getGoogleCampaignLive(customerId, campaignId);
  if (!live.budgetResourceName || live.amountMicros <= 0) {
    throw new Error("No se pudo leer el presupuesto actual de esta campaña en Google Ads.");
  }
  const newAmountMicros = Math.max(1_000_000, Math.round(live.amountMicros * (1 + deltaPct)));
  await googleAdsMutate(customerId, "campaignBudgets", [
    {
      update: { resourceName: live.budgetResourceName, amountMicros: String(newAmountMicros) },
      updateMask: "amount_micros",
    },
  ]);
  return { oldAmountMicros: live.amountMicros, newAmountMicros, shared: live.shared };
}

export async function getGoogleKeywordBidLive(
  customerId: string,
  adGroupId: string,
  criterionId: string
): Promise<number> {
  const rows = (await gaqlSearch(
    customerId,
    `SELECT ad_group_criterion.effective_cpc_bid_micros
     FROM ad_group_criterion
     WHERE ad_group.id = ${esc(adGroupId)} AND ad_group_criterion.criterion_id = ${esc(criterionId)}`
  )) as Array<{ adGroupCriterion?: { effectiveCpcBidMicros?: string | number } }>;
  const row = rows[0];
  if (!row) throw new Error("Keyword no encontrada en Google Ads");
  return Number(row.adGroupCriterion?.effectiveCpcBidMicros) || 0;
}

export async function setGoogleKeywordBid(
  customerId: string,
  adGroupId: string,
  criterionId: string,
  cpcBidMicros: number
): Promise<void> {
  const cid = cleanCustomerId(customerId);
  const resourceName = `customers/${cid}/adGroupCriteria/${esc(adGroupId)}~${esc(criterionId)}`;
  await googleAdsMutate(customerId, "adGroupCriteria", [
    {
      update: { resourceName, cpcBidMicros: String(Math.round(cpcBidMicros)) },
      updateMask: "cpc_bid_micros",
    },
  ]);
}
