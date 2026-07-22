import { getDb } from "../db";
import type { RecommendationRow } from "../meta/queries";

export interface GoogleKpis {
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  avg_cpc: number;
  roas: number;
  cpa: number;
}

export function getGoogleKpis(
  accountId: string,
  dateFrom: string,
  dateTo: string
): GoogleKpis {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cost),0) cost, COALESCE(SUM(impressions),0) impressions,
              COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(conversions),0) conversions,
              COALESCE(SUM(conversions_value),0) conversions_value
       FROM google_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?`
    )
    .get(accountId, dateFrom, dateTo) as {
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversions_value: number;
  };
  return {
    ...row,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    avg_cpc: row.clicks > 0 ? row.cost / row.clicks : 0,
    roas: row.cost > 0 ? row.conversions_value / row.cost : 0,
    cpa: row.conversions > 0 ? row.cost / row.conversions : 0,
  };
}

export interface GoogleDailyPoint {
  date: string;
  spend: number;
  conversions: number;
}

export function getGoogleDailySeries(
  accountId: string,
  dateFrom: string,
  dateTo: string
): GoogleDailyPoint[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT date, SUM(cost) spend, SUM(conversions) conversions
       FROM google_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       GROUP BY date ORDER BY date`
    )
    .all(accountId, dateFrom, dateTo) as GoogleDailyPoint[];
}

export interface GoogleEntityRow {
  id: string;
  name: string;
  status: string;
  extra: string;
  campaign_name: string;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_cpc: number;
  conversions: number;
  conversions_value: number;
  roas: number;
  cpa: number;
  ad_group_id?: string;
}

function derive(rows: Record<string, unknown>[]): GoogleEntityRow[] {
  return rows.map((r) => {
    const cost = Number(r.cost) || 0;
    const impressions = Number(r.impressions) || 0;
    const clicks = Number(r.clicks) || 0;
    const conversions = Number(r.conversions) || 0;
    const value = Number(r.conversions_value) || 0;
    return {
      id: String(r.id),
      name: String(r.name ?? ""),
      status: String(r.status ?? ""),
      extra: String(r.extra ?? ""),
      campaign_name: String(r.campaign_name ?? ""),
      cost,
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      avg_cpc: clicks > 0 ? cost / clicks : 0,
      conversions,
      conversions_value: value,
      roas: cost > 0 ? value / cost : 0,
      cpa: conversions > 0 ? cost / conversions : 0,
      ...(r.ad_group_id !== undefined ? { ad_group_id: String(r.ad_group_id) } : {}),
    };
  });
}

export function listGoogleCampaigns(
  accountId: string,
  dateFrom: string,
  dateTo: string
): GoogleEntityRow[] {
  const db = getDb();
  return derive(
    db
      .prepare(
        `SELECT campaign_id id, MAX(campaign_name) name, MAX(status) status,
                MAX(channel_type) extra, '' campaign_name,
                SUM(cost) cost, SUM(impressions) impressions, SUM(clicks) clicks,
                SUM(conversions) conversions, SUM(conversions_value) conversions_value
         FROM google_ads_campaign_daily
         WHERE account_id = ? AND date BETWEEN ? AND ?
         GROUP BY campaign_id ORDER BY SUM(cost) DESC`
      )
      .all(accountId, dateFrom, dateTo) as Record<string, unknown>[]
  );
}

export function listGoogleAdGroups(
  accountId: string,
  dateFrom: string,
  dateTo: string
): GoogleEntityRow[] {
  const db = getDb();
  return derive(
    db
      .prepare(
        `SELECT ad_group_id id, MAX(ad_group_name) name, MAX(status) status,
                '' extra, MAX(campaign_name) campaign_name,
                SUM(cost) cost, SUM(impressions) impressions, SUM(clicks) clicks,
                SUM(conversions) conversions, SUM(conversions_value) conversions_value
         FROM google_ads_adgroup_daily
         WHERE account_id = ? AND date BETWEEN ? AND ?
         GROUP BY ad_group_id ORDER BY SUM(cost) DESC`
      )
      .all(accountId, dateFrom, dateTo) as Record<string, unknown>[]
  );
}

export function listGoogleAds(
  accountId: string,
  dateFrom: string,
  dateTo: string
): GoogleEntityRow[] {
  const db = getDb();
  return derive(
    db
      .prepare(
        `SELECT ad_id id, MAX(ad_name) name, MAX(status) status,
                MAX(ad_type) extra, MAX(campaign_name) campaign_name,
                SUM(cost) cost, SUM(impressions) impressions, SUM(clicks) clicks,
                SUM(conversions) conversions, SUM(conversions_value) conversions_value
         FROM google_ads_ad_daily
         WHERE account_id = ? AND date BETWEEN ? AND ?
         GROUP BY ad_id ORDER BY SUM(cost) DESC`
      )
      .all(accountId, dateFrom, dateTo) as Record<string, unknown>[]
  );
}

export function listGoogleKeywords(
  accountId: string,
  dateFrom: string,
  dateTo: string
): GoogleEntityRow[] {
  const db = getDb();
  return derive(
    db
      .prepare(
        `SELECT criterion_id id, MAX(keyword_text) name, MAX(match_type) status,
                MAX(ad_group_name) extra, MAX(campaign_name) campaign_name,
                MAX(ad_group_id) ad_group_id,
                SUM(cost) cost, SUM(impressions) impressions, SUM(clicks) clicks,
                SUM(conversions) conversions, SUM(conversions_value) conversions_value
         FROM google_ads_keyword_daily
         WHERE account_id = ? AND date BETWEEN ? AND ?
         GROUP BY ad_group_id, criterion_id ORDER BY SUM(cost) DESC`
      )
      .all(accountId, dateFrom, dateTo) as Record<string, unknown>[]
  );
}

export interface GoogleTopPerformers {
  byCpl: GoogleEntityRow[];
  byConversions: GoogleEntityRow[];
  byCtr: GoogleEntityRow[];
  keywordsByCpl: GoogleEntityRow[];
}

export function getGoogleTopPerformers(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  limit = 10
): GoogleTopPerformers {
  const campaigns = listGoogleCampaigns(accountId, dateFrom, dateTo);
  const keywords = listGoogleKeywords(accountId, dateFrom, dateTo);

  return {
    byCpl: [...campaigns]
      .filter((row) => row.conversions > 0 && row.cost >= 20)
      .sort((a, b) => a.cpa - b.cpa)
      .slice(0, limit),
    byConversions: [...campaigns]
      .filter((row) => row.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, limit),
    byCtr: [...campaigns]
      .filter((row) => row.impressions >= 100)
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, limit),
    keywordsByCpl: [...keywords]
      .filter((row) => row.conversions > 0 && row.cost >= 5)
      .sort((a, b) => a.cpa - b.cpa)
      .slice(0, limit),
  };
}

export function getGoogleRecommendations(accountId: string): RecommendationRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM google_ads_recommendations
       WHERE account_id = ?
       ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id DESC`
    )
    .all(accountId) as RecommendationRow[];
}
