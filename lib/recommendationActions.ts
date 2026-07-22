/**
 * Capa compartida entre las rutas /preview y /apply de recomendaciones:
 * qué acciones son válidas para qué regla/nivel, y cómo resolverlas contra
 * Meta o Google Ads. `preview*` nunca muta nada; `apply*` siempre muta y
 * devuelve el resultado para auditoría.
 */

import { getDb } from "./db";
import { fmtMoney } from "./format";
import {
  BUDGET_ADJUST_PCT as META_PCT,
  adjustMetaBudget,
  getMetaAccountCurrency,
  getMetaEntityLive,
  pauseMetaEntity,
} from "./meta/actions";
import {
  BUDGET_ADJUST_PCT as GOOGLE_PCT,
  adjustGoogleCampaignBudget,
  getGoogleAdGroupStatus,
  getGoogleCampaignLive,
  pauseGoogleEntity,
} from "./google/actions";
import { availableActionsFor, type ActionKey, type Platform } from "./recommendationActionRules";

export { availableActionsFor };
export type { ActionKey, Platform };

export interface RecEntity {
  account_id: string;
  level: string;
  entity_id: string;
  entity_name: string;
}

export interface RecommendationRow extends RecEntity {
  id: number;
  rule: string;
  status: string;
  note: string | null;
}

export function getRecommendationRow(
  platform: Platform,
  id: number
): RecommendationRow | undefined {
  const table = platform === "google" ? "google_ads_recommendations" : "meta_ads_recommendations";
  const db = getDb();
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
    | RecommendationRow
    | undefined;
}

export interface ActionOutcome {
  entityName: string;
  currentLabel: string;
  newLabel: string;
  summary: string;
  warning?: string;
}

export async function previewAction(
  platform: Platform,
  rec: RecEntity,
  action: ActionKey
): Promise<ActionOutcome> {
  if (platform === "meta") return previewMeta(rec, action);
  return previewGoogle(rec, action);
}

export async function applyAction(
  platform: Platform,
  rec: RecEntity,
  action: ActionKey
): Promise<ActionOutcome> {
  if (platform === "meta") return applyMeta(rec, action);
  return applyGoogle(rec, action);
}

// ---------------- Meta ----------------

async function previewMeta(rec: RecEntity, action: ActionKey): Promise<ActionOutcome> {
  const currency = await getMetaAccountCurrency(rec.account_id);
  const live = await getMetaEntityLive(rec.entity_id, currency);

  if (action === "pause") {
    const pausing = live.status !== "PAUSED";
    return {
      entityName: rec.entity_name,
      currentLabel: live.status,
      newLabel: pausing ? "PAUSED" : "ACTIVE",
      summary: pausing ? `Se pausará "${rec.entity_name}".` : `Se reactivará "${rec.entity_name}".`,
    };
  }

  if (live.dailyBudget === null) {
    throw new Error(
      "Este elemento no maneja presupuesto propio (probablemente usa presupuesto a nivel de campaña / CBO)."
    );
  }
  const pct = action === "budget_up" ? META_PCT : -META_PCT;
  const newBudget = Math.max(1, live.dailyBudget * (1 + pct));
  return {
    entityName: rec.entity_name,
    currentLabel: fmtMoney(live.dailyBudget),
    newLabel: fmtMoney(newBudget),
    summary: `Presupuesto diario: ${fmtMoney(live.dailyBudget)} → ${fmtMoney(newBudget)}`,
  };
}

async function applyMeta(rec: RecEntity, action: ActionKey): Promise<ActionOutcome> {
  if (action === "pause") {
    const currency = await getMetaAccountCurrency(rec.account_id);
    const live = await getMetaEntityLive(rec.entity_id, currency);
    const pausing = live.status !== "PAUSED";
    await pauseMetaEntity(rec.entity_id, pausing);
    return {
      entityName: rec.entity_name,
      currentLabel: live.status,
      newLabel: pausing ? "PAUSED" : "ACTIVE",
      summary: pausing ? `Se pausó "${rec.entity_name}".` : `Se reactivó "${rec.entity_name}".`,
    };
  }

  const pct = action === "budget_up" ? META_PCT : -META_PCT;
  const result = await adjustMetaBudget(rec.entity_id, rec.account_id, pct);
  return {
    entityName: rec.entity_name,
    currentLabel: fmtMoney(result.oldBudget),
    newLabel: fmtMoney(result.newBudget),
    summary: `Presupuesto diario: ${fmtMoney(result.oldBudget)} → ${fmtMoney(result.newBudget)}`,
  };
}

// ---------------- Google ----------------

async function previewGoogle(rec: RecEntity, action: ActionKey): Promise<ActionOutcome> {
  if (action === "pause") {
    if (rec.level === "campaign") {
      const live = await getGoogleCampaignLive(rec.account_id, rec.entity_id);
      const pausing = live.status !== "PAUSED";
      return {
        entityName: rec.entity_name,
        currentLabel: live.status,
        newLabel: pausing ? "PAUSED" : "ENABLED",
        summary: pausing ? `Se pausará "${rec.entity_name}".` : `Se reactivará "${rec.entity_name}".`,
      };
    }
    const status = await getGoogleAdGroupStatus(rec.account_id, rec.entity_id);
    const pausing = status !== "PAUSED";
    return {
      entityName: rec.entity_name,
      currentLabel: status,
      newLabel: pausing ? "PAUSED" : "ENABLED",
      summary: pausing ? `Se pausará "${rec.entity_name}".` : `Se reactivará "${rec.entity_name}".`,
    };
  }

  const live = await getGoogleCampaignLive(rec.account_id, rec.entity_id);
  if (!live.budgetResourceName || live.amountMicros <= 0) {
    throw new Error("No se pudo leer el presupuesto actual de esta campaña en Google Ads.");
  }
  const pct = action === "budget_up" ? GOOGLE_PCT : -GOOGLE_PCT;
  const newAmountMicros = Math.max(1_000_000, Math.round(live.amountMicros * (1 + pct)));
  return {
    entityName: rec.entity_name,
    currentLabel: fmtMoney(live.amountMicros / 1_000_000),
    newLabel: fmtMoney(newAmountMicros / 1_000_000),
    summary: `Presupuesto diario: ${fmtMoney(live.amountMicros / 1_000_000)} → ${fmtMoney(newAmountMicros / 1_000_000)}`,
    warning: live.shared ? "Este presupuesto es compartido con otras campañas." : undefined,
  };
}

async function applyGoogle(rec: RecEntity, action: ActionKey): Promise<ActionOutcome> {
  if (action === "pause") {
    const level = rec.level === "campaign" ? "campaign" : "ad_group";
    const status =
      level === "campaign"
        ? (await getGoogleCampaignLive(rec.account_id, rec.entity_id)).status
        : await getGoogleAdGroupStatus(rec.account_id, rec.entity_id);
    const pausing = status !== "PAUSED";
    await pauseGoogleEntity(rec.account_id, level, rec.entity_id, pausing);
    return {
      entityName: rec.entity_name,
      currentLabel: status,
      newLabel: pausing ? "PAUSED" : "ENABLED",
      summary: pausing ? `Se pausó "${rec.entity_name}".` : `Se reactivó "${rec.entity_name}".`,
    };
  }

  const pct = action === "budget_up" ? GOOGLE_PCT : -GOOGLE_PCT;
  const result = await adjustGoogleCampaignBudget(rec.account_id, rec.entity_id, pct);
  return {
    entityName: rec.entity_name,
    currentLabel: fmtMoney(result.oldAmountMicros / 1_000_000),
    newLabel: fmtMoney(result.newAmountMicros / 1_000_000),
    summary: `Presupuesto diario: ${fmtMoney(result.oldAmountMicros / 1_000_000)} → ${fmtMoney(result.newAmountMicros / 1_000_000)}`,
    warning: result.shared ? "Este presupuesto es compartido con otras campañas." : undefined,
  };
}
