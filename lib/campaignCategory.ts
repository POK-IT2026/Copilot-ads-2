/**
 * Clasificación de campañas por objetivo (Meta) / tipo de canal (Google)
 * y los parámetros de reglas que le corresponden a cada categoría. Sin
 * dependencias de I/O -- se puede importar desde cualquier lado.
 */

export type CampaignCategory = "leads" | "sales" | "traffic" | "awareness";

export const CATEGORY_LABELS: Record<CampaignCategory, string> = {
  leads: "Leads",
  sales: "Ventas",
  traffic: "Tráfico",
  awareness: "Awareness",
};

/** Objetivos de Meta cambiaron de nomenclatura (OUTCOME_* vs legado); se
 * clasifica por substring insensible a mayúsculas para cubrir ambas. */
export function classifyMetaObjective(objective: string | null | undefined): CampaignCategory {
  const o = (objective ?? "").toUpperCase();
  if (o.includes("LEAD") || o.includes("MESSAGE")) return "leads";
  if (o.includes("SALE") || o.includes("CONVERSION") || o.includes("CATALOG")) return "sales";
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICK")) return "traffic";
  if (o.includes("AWARENESS") || o.includes("REACH") || o.includes("BRAND")) return "awareness";
  // Default preserva el comportamiento actual (motor pensado para leads).
  return "leads";
}

export function classifyGoogleChannelType(channelType: string | null | undefined): CampaignCategory {
  const c = (channelType ?? "").toUpperCase();
  if (c.includes("DISPLAY") || c.includes("VIDEO") || c.includes("DEMAND_GEN")) return "awareness";
  // Default preserva el comportamiento actual (motor pensado en conversiones/ROAS).
  return "sales";
}

export interface CategoryParams {
  /** Cómo se nombra la conversión en el texto de las recomendaciones. */
  conversionNoun: string;
  /** KPI que más importa para esta categoría (solo informativo/UI). */
  primaryKpi: string;
  /** Umbral de gasto para "gasto alto sin conversión". */
  spendNoConvThreshold: number;
  /** Multiplicador sobre el promedio de cuenta para marcar CPA/CPC alto. */
  cpaMultiplier: number;
  /** ROAS mínimo esperado (solo aplica a la categoría sales). */
  roasMin: number;
  /** CTR mínimo esperado, en %. */
  ctrMinPct: number;
  /** Impresiones mínimas antes de evaluar CTR bajo. */
  ctrImpressionFloor: number;
  /** Frecuencia máxima antes de considerar fatiga de audiencia (Meta). */
  frequencyMax: number;
}

// leads y sales usan exactamente los números que ya existían hardcodeados
// en evaluateLeadEntity / evaluateEntity -- cero cambio de comportamiento.
export const CATEGORY_PARAMS: Record<CampaignCategory, CategoryParams> = {
  leads: {
    conversionNoun: "leads",
    primaryKpi: "CPL",
    spendNoConvThreshold: 300,
    cpaMultiplier: 1.5,
    roasMin: 0,
    ctrMinPct: 0.5,
    ctrImpressionFloor: 5000,
    frequencyMax: 4,
  },
  sales: {
    conversionNoun: "compras",
    primaryKpi: "ROAS",
    spendNoConvThreshold: 500,
    cpaMultiplier: 1.5,
    roasMin: 1.5,
    ctrMinPct: 0.5,
    ctrImpressionFloor: 5000,
    frequencyMax: 4,
  },
  traffic: {
    conversionNoun: "clics",
    primaryKpi: "CPC",
    spendNoConvThreshold: 500,
    cpaMultiplier: 1.5,
    roasMin: 0,
    ctrMinPct: 0.5,
    ctrImpressionFloor: 5000,
    frequencyMax: 4,
  },
  awareness: {
    conversionNoun: "interacciones",
    primaryKpi: "CPM",
    spendNoConvThreshold: 800,
    cpaMultiplier: 1.8,
    roasMin: 0,
    ctrMinPct: 0.2,
    ctrImpressionFloor: 5000,
    frequencyMax: 6,
  },
};
