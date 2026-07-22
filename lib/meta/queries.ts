import { getDb } from "../db";
import { accountAverages, aggregateLevel } from "./recommendations";
import type { RuleEntity } from "../rules";
import { classifyMetaObjective } from "../campaignCategory";

export interface MetaKpis {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages: number;
  results: number;
  ctr: number;
  cpc: number;
  cpl: number;
}

export function getMetaKpis(
  accountId: string,
  dateFrom: string,
  dateTo: string
): MetaKpis {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(spend),0) spend,
              COALESCE(SUM(impressions),0) impressions,
              COALESCE(SUM(clicks),0) clicks,
              COALESCE(SUM(leads),0) leads,
              COALESCE(SUM(messages),0) messages,
              COALESCE(SUM(results),0) results
       FROM meta_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?`
    )
    .get(accountId, dateFrom, dateTo) as {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    messages: number;
    results: number;
  };

  return {
    ...row,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
    cpl: row.results > 0 ? row.spend / row.results : 0,
  };
}

export interface DailyPoint {
  date: string;
  spend: number;
  results: number;
  leads: number;
}

export function getMetaDailySeries(
  accountId: string,
  dateFrom: string,
  dateTo: string
): DailyPoint[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT date, SUM(spend) spend, SUM(results) results, SUM(leads) leads
       FROM meta_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY date ORDER BY date`
    )
    .all(accountId, dateFrom, dateTo) as DailyPoint[];
}

interface EntityExtras {
  status: string;
  objective?: string;
  campaign_name?: string;
  adset_name?: string;
  thumbnail_url?: string | null;
  leads: number;
  messages: number;
  results: number;
  cpl: number | null;
}

export type MetaEntityRow = RuleEntity & EntityExtras & { cpc: number; cpm: number };

function withDerived(rows: Record<string, unknown>[], level: string): MetaEntityRow[] {
  return rows.map((r) => {
    const spend = Number(r.spend) || 0;
    const impressions = Number(r.impressions) || 0;
    const clicks = Number(r.clicks) || 0;
    const leads = Number(r.leads) || 0;
    const messages = Number(r.messages) || 0;
    const results = Number(r.results) || leads + messages;
    const cpl = results > 0 ? spend / results : null;

    const objective = r.objective ? String(r.objective) : undefined;
    return {
      level,
      id: String(r.id),
      name: String(r.name ?? ""),
      status: String(r.status ?? ""),
      category: classifyMetaObjective(objective),
      objective,
      campaign_name: r.campaign_name ? String(r.campaign_name) : undefined,
      adset_name: r.adset_name ? String(r.adset_name) : undefined,
      thumbnail_url: r.thumbnail_url ? String(r.thumbnail_url) : null,
      spend,
      impressions,
      clicks,
      leads,
      messages,
      results,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      conversions: results,
      value: 0,
      roas: 0,
      cpa: cpl ?? 0,
      cpl,
      frequency: Number(r.frequency) || 0,
    };
  });
}

export function listMetaCampaigns(
  accountId: string,
  dateFrom: string,
  dateTo: string
): MetaEntityRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT campaign_id id, MAX(campaign_name) name, MAX(status) status,
              MAX(objective) objective,
              SUM(spend) spend, SUM(impressions) impressions, SUM(clicks) clicks,
              SUM(leads) leads, SUM(messages) messages, SUM(results) results,
              AVG(frequency) frequency
       FROM meta_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY campaign_id ORDER BY SUM(spend) DESC`
    )
    .all(accountId, dateFrom, dateTo) as Record<string, unknown>[];
  return withDerived(rows, "campaign");
}

export function listMetaAdsets(
  accountId: string,
  dateFrom: string,
  dateTo: string
): MetaEntityRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT adset_id id, MAX(adset_name) name, MAX(status) status,
              MAX(campaign_name) campaign_name,
              SUM(spend) spend, SUM(impressions) impressions, SUM(clicks) clicks,
              SUM(leads) leads, SUM(messages) messages, SUM(results) results,
              AVG(frequency) frequency
       FROM meta_ads_adset_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY adset_id ORDER BY SUM(spend) DESC`
    )
    .all(accountId, dateFrom, dateTo) as Record<string, unknown>[];
  return withDerived(rows, "adset");
}

export function listMetaAds(
  accountId: string,
  dateFrom: string,
  dateTo: string
): MetaEntityRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ad_id id, MAX(ad_name) name, MAX(status) status,
              MAX(adset_name) adset_name, MAX(campaign_name) campaign_name,
              MAX(thumbnail_url) thumbnail_url,
              SUM(spend) spend, SUM(impressions) impressions, SUM(clicks) clicks,
              SUM(leads) leads, SUM(messages) messages, SUM(results) results,
              AVG(frequency) frequency
       FROM meta_ads_ad_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY ad_id ORDER BY SUM(spend) DESC`
    )
    .all(accountId, dateFrom, dateTo) as Record<string, unknown>[];
  return withDerived(rows, "ad");
}

export type CreativeBucket = "winner" | "neutral" | "loser" | "no_data";

export interface ClassifiedCreative {
  bucket: CreativeBucket;
  ad: MetaEntityRow;
}

export function classifyCreatives(
  accountId: string,
  dateFrom: string,
  dateTo: string
): ClassifiedCreative[] {
  const ads = listMetaAds(accountId, dateFrom, dateTo);
  // La categoría por objetivo no importa aquí (solo se usan los promedios
  // agregados de cuenta), así que se evita la consulta extra de objetivo.
  const avg = accountAverages(aggregateLevel("campaign", accountId, dateFrom, dateTo, new Map()));

  return ads.map((ad) => {
    let bucket: CreativeBucket = "neutral";
    if (ad.impressions < 100) {
      bucket = "no_data";
    } else if (ad.results > 0 && avg.cpl > 0 && ad.cpl !== null && ad.cpl <= avg.cpl * 0.8) {
      bucket = "winner";
    } else if (
      (ad.spend > 100 && ad.results === 0) ||
      (ad.results > 0 && avg.cpl > 0 && ad.cpl !== null && ad.cpl >= avg.cpl * 1.25 && ad.spend > 50)
    ) {
      bucket = "loser";
    }
    return { bucket, ad };
  });
}

export interface TopPerformers {
  byCpl: MetaEntityRow[];
  byResults: MetaEntityRow[];
  byCtr: MetaEntityRow[];
}

export function getTopPerformers(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  limit = 10
): TopPerformers {
  const ads = listMetaAds(accountId, dateFrom, dateTo);
  return {
    byCpl: [...ads]
      .filter((a) => a.results > 0 && a.spend >= 20 && a.cpl !== null)
      .sort((a, b) => (a.cpl ?? Number.POSITIVE_INFINITY) - (b.cpl ?? Number.POSITIVE_INFINITY))
      .slice(0, limit),
    byResults: [...ads]
      .filter((a) => a.results > 0)
      .sort((a, b) => b.results - a.results)
      .slice(0, limit),
    byCtr: [...ads]
      .filter((a) => a.impressions >= 1000)
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, limit),
  };
}

export interface RecommendationRow {
  id: number;
  account_id: string;
  level: string;
  entity_id: string;
  entity_name: string;
  rule: string;
  priority: string;
  title: string;
  detail: string;
  kpi_snapshot: string;
  status: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function getMetaRecommendations(accountId: string): RecommendationRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM meta_ads_recommendations
       WHERE account_id = ?
       ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id DESC`
    )
    .all(accountId) as RecommendationRow[];
}

export interface SyncRunRow {
  id: number;
  account_id: string;
  date_from: string;
  date_to: string;
  status: string;
  error: string | null;
  campaigns_rows: number;
  adsets_rows: number;
  ads_rows: number;
  recommendations_count: number;
  started_at: string;
  finished_at: string | null;
}

export function getLastMetaSync(accountId: string): SyncRunRow | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM meta_ads_sync_runs WHERE account_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(accountId) as SyncRunRow | undefined;
}
