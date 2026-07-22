/**
 * Motor de recomendaciones por reglas, compartido entre Meta Ads y Google Ads.
 *
 * Reglas (según especificación):
 *  - high_spend_no_purchases  gasto > $500 sin compras            → prioridad alta
 *  - low_roas                 gasto > $100 y ROAS < 1.5           → prioridad alta
 *  - high_cpa                 CPA > 1.5x el promedio de la cuenta → prioridad media
 *  - low_ctr                  impresiones > 5,000 y CTR < 0.5%    → prioridad media
 *  - high_frequency           frecuencia > 4 y CTR < promedio     → prioridad media
 *  - top_performer            ROAS > 1.5x promedio y gasto > $100 → prioridad baja
 *
 * Los umbrales ya no están hardcodeados: se parametrizan por tipo de
 * campaña vía `CategoryParams` (ver `lib/campaignCategory.ts`).
 */

import type { CampaignCategory, CategoryParams } from "./campaignCategory";

export interface RuleEntity {
  level: string;
  id: string;
  name: string;
  category: CampaignCategory;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // en %
  conversions: number;
  value: number;
  roas: number;
  cpa: number;
  frequency: number;
}

export interface RuleAverages {
  ctr: number;
  cpa: number;
  roas: number;
  cpl: number;
  cpc: number;
}

export type Priority = "high" | "medium" | "low";

export interface Finding {
  rule: string;
  priority: Priority;
  title: string;
  detail: string;
}

const money = (n: number) =>
  "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
const pct = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 2 }) + "%";
const dec = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

/**
 * Evalúa una entidad (campaña / ad set / anuncio) orientada a conversión
 * con valor monetario (categoría "sales"): ROAS, CPA, y sus umbrales
 * vienen de `params` (ver `lib/campaignCategory.ts`) en vez de estar
 * hardcodeados, para poder variar por tipo de campaña.
 */
export function evaluateEntity(
  e: RuleEntity,
  avg: RuleAverages,
  params: CategoryParams
): Finding[] {
  const findings: Finding[] = [];
  const noun = params.conversionNoun;

  const highSpendNoPurchases = e.spend > params.spendNoConvThreshold && e.conversions === 0;
  if (highSpendNoPurchases) {
    findings.push({
      rule: "high_spend_no_purchases",
      priority: "high",
      title: `Gasto alto sin ${noun}`,
      detail: `"${e.name}" gastó ${money(e.spend)} en el periodo sin registrar ${noun}. Revisa la segmentación, el tracking y considera pausarla.`,
    });
  }

  if (!highSpendNoPurchases && e.spend > 100 && e.roas < params.roasMin) {
    findings.push({
      rule: "low_roas",
      priority: "high",
      title: "ROAS bajo",
      detail: `"${e.name}" tiene un ROAS de ${dec(e.roas)} con ${money(e.spend)} de gasto (mínimo esperado: ${dec(params.roasMin)}). Revisa creativos, audiencias y ofertas.`,
    });
  }

  if (e.conversions > 0 && avg.cpa > 0 && e.cpa > params.cpaMultiplier * avg.cpa) {
    findings.push({
      rule: "high_cpa",
      priority: "medium",
      title: "CPA elevado",
      detail: `"${e.name}" tiene un CPA de ${money(e.cpa)}, ${dec(e.cpa / avg.cpa)}x el promedio de la cuenta (${money(avg.cpa)}). Optimiza la puja o depura audiencias.`,
    });
  }

  if (e.impressions > params.ctrImpressionFloor && e.ctr < params.ctrMinPct) {
    findings.push({
      rule: "low_ctr",
      priority: "medium",
      title: "CTR bajo",
      detail: `"${e.name}" tiene un CTR de ${pct(e.ctr)} con ${e.impressions.toLocaleString("es-MX")} impresiones (umbral: ${pct(params.ctrMinPct)}). El creativo no está generando interés.`,
    });
  }

  if (e.frequency > params.frequencyMax && avg.ctr > 0 && e.ctr < avg.ctr) {
    findings.push({
      rule: "high_frequency",
      priority: "medium",
      title: "Frecuencia alta",
      detail: `"${e.name}" tiene una frecuencia de ${dec(e.frequency)} y su CTR (${pct(e.ctr)}) está por debajo del promedio (${pct(avg.ctr)}). La audiencia está saturada: renueva creativos o amplía la audiencia.`,
    });
  }

  if (avg.roas > 0 && e.roas > 1.5 * avg.roas && e.spend > 100) {
    findings.push({
      rule: "top_performer",
      priority: "low",
      title: "Top performer",
      detail: `"${e.name}" tiene un ROAS de ${dec(e.roas)} (${dec(e.roas / avg.roas)}x el promedio de la cuenta) con ${money(e.spend)} de gasto. Considera escalar el presupuesto.`,
    });
  }

  return findings;
}

/**
 * Evalúa entidades de categoría "traffic" o "awareness": no se optimizan
 * por conversión/ROAS, así que se enfoca en CPC/CTR/frecuencia.
 */
export function evaluateLightEntity(
  e: RuleEntity,
  avg: RuleAverages,
  params: CategoryParams
): Finding[] {
  const findings: Finding[] = [];
  const noun = params.conversionNoun;
  const cpc = e.clicks > 0 ? e.spend / e.clicks : 0;

  const highSpendNoClicks = e.spend > params.spendNoConvThreshold && e.clicks === 0;
  if (highSpendNoClicks) {
    findings.push({
      rule: "high_spend_no_clicks",
      priority: "high",
      title: "Gasto alto sin clics",
      detail: `"${e.name}" gastó ${money(e.spend)} en el periodo sin generar clics. Revisa segmentación, creativos y tracking; considera pausarla.`,
    });
  } else if (e.clicks > 0 && avg.cpc > 0 && cpc > params.cpaMultiplier * avg.cpc && e.spend > 100) {
    findings.push({
      rule: "high_cpc",
      priority: "medium",
      title: "CPC elevado",
      detail: `"${e.name}" tiene un CPC de ${money(cpc)}, ${dec(cpc / avg.cpc)}x el promedio de la cuenta (${money(avg.cpc)}). Revisa puja y segmentación.`,
    });
  }

  if (e.impressions > params.ctrImpressionFloor && e.ctr < params.ctrMinPct) {
    findings.push({
      rule: "low_ctr",
      priority: "medium",
      title: "CTR bajo",
      detail: `"${e.name}" tiene un CTR de ${pct(e.ctr)} con ${e.impressions.toLocaleString("es-MX")} impresiones (umbral: ${pct(params.ctrMinPct)}). Genera pocas ${noun}.`,
    });
  }

  if (e.frequency > params.frequencyMax && avg.ctr > 0 && e.ctr < avg.ctr) {
    findings.push({
      rule: "high_frequency",
      priority: "medium",
      title: "Frecuencia alta",
      detail: `"${e.name}" tiene una frecuencia de ${dec(e.frequency)} y su CTR (${pct(e.ctr)}) está por debajo del promedio (${pct(avg.ctr)}). Renueva creativos o amplía la audiencia.`,
    });
  }

  if (e.clicks > 0 && avg.cpc > 0 && cpc < 0.7 * avg.cpc && e.spend > 100) {
    findings.push({
      rule: "top_cpc",
      priority: "low",
      title: "CPC competitivo",
      detail: `"${e.name}" tiene un CPC de ${money(cpc)} (${dec(cpc / avg.cpc)}x el promedio) con ${money(e.spend)} de gasto. Considera escalar presupuesto gradualmente.`,
    });
  }

  return findings;
}
