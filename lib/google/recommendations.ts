import { getDb } from "../db";
import {
  evaluateEntity,
  evaluateLightEntity,
  type RuleAverages,
  type RuleEntity,
} from "../rules";
import { CATEGORY_PARAMS, classifyGoogleChannelType } from "../campaignCategory";

const LEVEL_TABLES: Record<
  string,
  { table: string; idCol: string; nameCol: string }
> = {
  campaign: { table: "google_ads_campaign_daily", idCol: "campaign_id", nameCol: "campaign_name" },
  ad_group: { table: "google_ads_adgroup_daily", idCol: "ad_group_id", nameCol: "ad_group_name" },
  ad: { table: "google_ads_ad_daily", idCol: "ad_id", nameCol: "ad_name" },
};

/** Mapa campaign_id -> channel_type, para resolver la categoría de ad
 * groups/anuncios (que no guardan su propio channel_type). */
export function googleChannelTypeByCampaignId(
  accountId: string,
  dateFrom: string,
  dateTo: string
): Map<string, string> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT campaign_id, MAX(channel_type) AS channel_type
       FROM google_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY campaign_id`
    )
    .all(accountId, dateFrom, dateTo) as { campaign_id: string; channel_type: string | null }[];
  return new Map(rows.map((r) => [String(r.campaign_id), r.channel_type ?? ""]));
}

export function aggregateGoogleLevel(
  level: "campaign" | "ad_group" | "ad",
  accountId: string,
  dateFrom: string,
  dateTo: string,
  channelTypeByCampaignId: Map<string, string>
): RuleEntity[] {
  const db = getDb();
  const { table, idCol, nameCol } = LEVEL_TABLES[level];
  const rows = db
    .prepare(
      `SELECT ${idCol} AS id, MAX(${nameCol}) AS name, MAX(campaign_id) AS campaign_id,
              SUM(cost) AS cost, SUM(impressions) AS impressions,
              SUM(clicks) AS clicks, SUM(conversions) AS conversions,
              SUM(conversions_value) AS conversions_value
       FROM ${table}
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY ${idCol}`
    )
    .all(accountId, dateFrom, dateTo) as Array<{
    id: string;
    name: string;
    campaign_id: string;
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversions_value: number;
  }>;

  return rows.map((r) => ({
    level,
    id: String(r.id),
    name: r.name ?? "",
    category: classifyGoogleChannelType(channelTypeByCampaignId.get(String(r.campaign_id ?? r.id))),
    spend: r.cost ?? 0,
    impressions: r.impressions ?? 0,
    clicks: r.clicks ?? 0,
    ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
    conversions: r.conversions ?? 0,
    value: r.conversions_value ?? 0,
    roas: r.cost > 0 ? r.conversions_value / r.cost : 0,
    cpa: r.conversions > 0 ? r.cost / r.conversions : 0,
    frequency: 0, // Google Ads no expone frecuencia en estos reportes
  }));
}

export function googleAccountAverages(campaigns: RuleEntity[]): RuleAverages {
  const spend = campaigns.reduce((a, c) => a + c.spend, 0);
  const impressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const clicks = campaigns.reduce((a, c) => a + c.clicks, 0);
  const conversions = campaigns.reduce((a, c) => a + c.conversions, 0);
  const value = campaigns.reduce((a, c) => a + c.value, 0);
  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? value / spend : 0,
    cpl: conversions > 0 ? spend / conversions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
  };
}

/** Despacha al evaluador correcto según la categoría resuelta de la entidad. */
export function evaluateByCategory(e: RuleEntity, avg: RuleAverages) {
  const params = CATEGORY_PARAMS[e.category];
  if (e.category === "awareness") return evaluateLightEntity(e, avg, params);
  return evaluateEntity(e, avg, params);
}

/** Genera y persiste recomendaciones de Google Ads (mismas reglas que Meta). */
export function generateGoogleRecommendations(
  accountId: string,
  dateFrom: string,
  dateTo: string
): number {
  const db = getDb();
  const channelTypeByCampaignId = googleChannelTypeByCampaignId(accountId, dateFrom, dateTo);
  const campaigns = aggregateGoogleLevel("campaign", accountId, dateFrom, dateTo, channelTypeByCampaignId);
  const adGroups = aggregateGoogleLevel("ad_group", accountId, dateFrom, dateTo, channelTypeByCampaignId);
  const avg = googleAccountAverages(campaigns);

  const insert = db.prepare(
    `INSERT INTO google_ads_recommendations
       (account_id, level, entity_id, entity_name, rule, priority, title, detail, kpi_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM google_ads_recommendations WHERE account_id = ? AND status = 'pending' AND rule NOT LIKE 'bn_%'`
    ).run(accountId);
    for (const entity of [...campaigns, ...adGroups]) {
      for (const finding of evaluateByCategory(entity, avg)) {
        const snapshot = JSON.stringify({
          dateFrom,
          dateTo,
          cost: entity.spend,
          impressions: entity.impressions,
          clicks: entity.clicks,
          ctr: entity.ctr,
          conversions: entity.conversions,
          conversions_value: entity.value,
          roas: entity.roas,
          cpa: entity.cpa,
          account_avg: avg,
        });
        insert.run(
          accountId,
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
