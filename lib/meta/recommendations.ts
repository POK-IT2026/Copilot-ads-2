import { getDb } from "../db";
import { evaluateEntity, evaluateLightEntity, type Finding, type RuleAverages, type RuleEntity } from "../rules";
import { CATEGORY_PARAMS, classifyMetaObjective } from "../campaignCategory";

export interface MetaAggRow {
  id: string;
  name: string;
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages: number;
  results: number;
  frequency: number;
}

const LEVEL_TABLES: Record<string, { table: string; idCol: string; nameCol: string }> = {
  campaign: { table: "meta_ads_campaign_daily", idCol: "campaign_id", nameCol: "campaign_name" },
  adset: { table: "meta_ads_adset_daily", idCol: "adset_id", nameCol: "adset_name" },
  ad: { table: "meta_ads_ad_daily", idCol: "ad_id", nameCol: "ad_name" },
};

const money = (n: number) =>
  "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
const pct = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 2 }) + "%";
const dec = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

/** Mapa campaign_id -> objective, para resolver la categoría de adsets/ads
 * (que no guardan su propio objective) sin repetir la consulta por nivel. */
export function metaObjectiveByCampaignId(
  accountId: string,
  dateFrom: string,
  dateTo: string
): Map<string, string> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT campaign_id, MAX(objective) AS objective
       FROM meta_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY campaign_id`
    )
    .all(accountId, dateFrom, dateTo) as { campaign_id: string; objective: string | null }[];
  return new Map(rows.map((r) => [String(r.campaign_id), r.objective ?? ""]));
}

export function aggregateLevel(
  level: "campaign" | "adset" | "ad",
  accountId: string,
  dateFrom: string,
  dateTo: string,
  objectiveByCampaignId: Map<string, string>
): RuleEntity[] {
  const db = getDb();
  const { table, idCol, nameCol } = LEVEL_TABLES[level];
  const rows = db
    .prepare(
      `SELECT ${idCol} AS id, MAX(${nameCol}) AS name, MAX(campaign_id) AS campaign_id,
              SUM(spend) AS spend, SUM(impressions) AS impressions,
              SUM(clicks) AS clicks, SUM(leads) AS leads,
              SUM(messages) AS messages, SUM(results) AS results,
              AVG(frequency) AS frequency
       FROM ${table}
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY ${idCol}`
    )
    .all(accountId, dateFrom, dateTo) as MetaAggRow[];

  return rows.map((r) => {
    const results = r.results ?? (r.leads ?? 0) + (r.messages ?? 0);
    const cpl = results > 0 ? r.spend / results : 0;
    const campaignId = String(r.campaign_id ?? r.id);
    return {
      level,
      id: String(r.id),
      name: r.name ?? "",
      category: classifyMetaObjective(objectiveByCampaignId.get(campaignId)),
      spend: r.spend ?? 0,
      impressions: r.impressions ?? 0,
      clicks: r.clicks ?? 0,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
      conversions: results,
      value: 0,
      roas: 0,
      cpa: cpl,
      frequency: r.frequency ?? 0,
    };
  });
}

export function accountAverages(campaigns: RuleEntity[]): RuleAverages {
  const spend = campaigns.reduce((a, c) => a + c.spend, 0);
  const impressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const clicks = campaigns.reduce((a, c) => a + c.clicks, 0);
  const results = campaigns.reduce((a, c) => a + c.conversions, 0);
  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpa: results > 0 ? spend / results : 0,
    cpl: results > 0 ? spend / results : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    roas: 0,
  };
}

function evaluateLeadEntity(e: RuleEntity, avg: RuleAverages): Finding[] {
  const params = CATEGORY_PARAMS.leads;
  const findings: Finding[] = [];
  const cpl = e.cpa;
  const avgCpl = avg.cpl || avg.cpa;

  const highSpendNoResults = e.spend > params.spendNoConvThreshold && e.conversions === 0;
  if (highSpendNoResults) {
    findings.push({
      rule: "high_spend_no_results",
      priority: "high",
      title: "Gasto alto sin leads ni mensajes",
      detail: `"${e.name}" gasto ${money(e.spend)} en el periodo sin registrar leads ni conversaciones. Revisa formulario, WhatsApp/Messenger, tracking y audiencia.`,
    });
  }

  if (e.conversions > 0 && avgCpl > 0 && cpl > params.cpaMultiplier * avgCpl && e.spend > 100) {
    findings.push({
      rule: "high_cpl",
      priority: "high",
      title: "CPL alto",
      detail: `"${e.name}" tiene un CPL de ${money(cpl)}, ${dec(cpl / avgCpl)}x el promedio de la cuenta (${money(avgCpl)}). Revisa creativo, oferta y segmentacion.`,
    });
  }

  if (e.impressions > params.ctrImpressionFloor && e.ctr < params.ctrMinPct) {
    findings.push({
      rule: "low_ctr",
      priority: "medium",
      title: "CTR bajo",
      detail: `"${e.name}" tiene un CTR de ${pct(e.ctr)} con ${e.impressions.toLocaleString("es-MX")} impresiones. El anuncio no esta generando suficiente interes.`,
    });
  }

  if (e.frequency > params.frequencyMax && avg.ctr > 0 && e.ctr < avg.ctr) {
    findings.push({
      rule: "high_frequency",
      priority: "medium",
      title: "Frecuencia alta",
      detail: `"${e.name}" tiene frecuencia ${dec(e.frequency)} y CTR (${pct(e.ctr)}) por debajo del promedio (${pct(avg.ctr)}). Renueva creativos o amplia audiencia.`,
    });
  }

  if (e.conversions > 0 && avgCpl > 0 && cpl < 0.7 * avgCpl && e.spend > 100) {
    findings.push({
      rule: "top_cpl",
      priority: "low",
      title: "CPL competitivo",
      detail: `"${e.name}" tiene un CPL de ${money(cpl)} (${dec(cpl / avgCpl)}x el promedio) con ${e.conversions.toLocaleString("es-MX")} resultados. Considera escalar presupuesto gradualmente.`,
    });
  }

  return findings;
}

/** Despacha al evaluador correcto según la categoría resuelta de la entidad. */
function evaluateByCategory(e: RuleEntity, avg: RuleAverages): Finding[] {
  if (e.category === "leads") return evaluateLeadEntity(e, avg);
  const params = CATEGORY_PARAMS[e.category];
  if (e.category === "sales") return evaluateEntity(e, avg, params);
  return evaluateLightEntity(e, avg, params);
}

export interface AlertItem extends Finding {
  level: string;
  entityId: string;
  entityName: string;
  entity: RuleEntity;
}

export function computeMetaAlerts(
  accountId: string,
  dateFrom: string,
  dateTo: string
): AlertItem[] {
  const objectiveByCampaignId = metaObjectiveByCampaignId(accountId, dateFrom, dateTo);
  const campaigns = aggregateLevel("campaign", accountId, dateFrom, dateTo, objectiveByCampaignId);
  const adsets = aggregateLevel("adset", accountId, dateFrom, dateTo, objectiveByCampaignId);
  const ads = aggregateLevel("ad", accountId, dateFrom, dateTo, objectiveByCampaignId);
  const avg = accountAverages(campaigns);

  const items: AlertItem[] = [];
  for (const entity of [...campaigns, ...adsets, ...ads]) {
    for (const finding of evaluateByCategory(entity, avg)) {
      items.push({
        ...finding,
        level: entity.level,
        entityId: entity.id,
        entityName: entity.name,
        entity,
      });
    }
  }
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.priority] - order[b.priority] || b.entity.spend - a.entity.spend);
  return items;
}

export function generateMetaRecommendations(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  syncRunId: number | null
): number {
  const db = getDb();
  const objectiveByCampaignId = metaObjectiveByCampaignId(accountId, dateFrom, dateTo);
  const campaigns = aggregateLevel("campaign", accountId, dateFrom, dateTo, objectiveByCampaignId);
  const adsets = aggregateLevel("adset", accountId, dateFrom, dateTo, objectiveByCampaignId);
  const ads = aggregateLevel("ad", accountId, dateFrom, dateTo, objectiveByCampaignId);
  const avg = accountAverages(campaigns);

  const insert = db.prepare(
    `INSERT INTO meta_ads_recommendations
       (account_id, sync_run_id, level, entity_id, entity_name, rule, priority, title, detail, kpi_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM meta_ads_recommendations WHERE account_id = ? AND status = 'pending' AND rule NOT LIKE 'bn_%'`
    ).run(accountId);
    for (const entity of [...campaigns, ...adsets, ...ads]) {
      for (const finding of evaluateByCategory(entity, avg)) {
        const snapshot = JSON.stringify({
          dateFrom,
          dateTo,
          spend: entity.spend,
          impressions: entity.impressions,
          clicks: entity.clicks,
          ctr: entity.ctr,
          results: entity.conversions,
          cpl: entity.cpa,
          frequency: entity.frequency,
          account_avg: avg,
        });
        insert.run(
          accountId,
          syncRunId,
          entity.level,
          entity.id,
          entity.name,
          finding.rule,
          finding.priority,
          finding.title,
          finding.detail,
          snapshot
        );
        count++;
      }
    }
  });
  tx();
  return count;
}
