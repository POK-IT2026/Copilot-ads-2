import { getDb } from "../db";
import { gaqlSearch } from "./api";
import { generateGoogleRecommendations } from "./recommendations";

interface GaqlRow {
  campaign?: Record<string, unknown>;
  adGroup?: Record<string, unknown>;
  adGroupAd?: { ad?: Record<string, unknown>; status?: string };
  adGroupCriterion?: {
    criterionId?: string;
    keyword?: { text?: string; matchType?: string };
  };
  segments?: { date?: string };
  metrics?: Record<string, unknown>;
}

function parseMetrics(m: Record<string, unknown> | undefined) {
  const cost = (Number(m?.costMicros) || 0) / 1_000_000;
  const impressions = Number(m?.impressions) || 0;
  const clicks = Number(m?.clicks) || 0;
  const conversions = Number(m?.conversions) || 0;
  const conversionsValue = Number(m?.conversionsValue) || 0;
  return {
    cost,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    avg_cpc: (Number(m?.averageCpc) || 0) / 1_000_000,
    conversions,
    conversions_value: conversionsValue,
    roas: cost > 0 ? conversionsValue / cost : 0,
    cpa: conversions > 0 ? cost / conversions : 0,
  };
}

const METRIC_FIELDS =
  "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.average_cpc, metrics.conversions, metrics.conversions_value";

export interface GoogleSyncResult {
  campaigns: number;
  adGroups: number;
  ads: number;
  keywords: number;
  recommendations: number;
}

export async function syncGoogleAccount(
  customerId: string,
  dateFrom: string,
  dateTo: string
): Promise<GoogleSyncResult> {
  const db = getDb();
  const range = `segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`;

  const campaignRows = (await gaqlSearch(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
            segments.date, ${METRIC_FIELDS}
     FROM campaign WHERE ${range} AND metrics.impressions > 0`
  )) as GaqlRow[];

  const adGroupRows = (await gaqlSearch(
    customerId,
    `SELECT ad_group.id, ad_group.name, ad_group.status,
            campaign.id, campaign.name, segments.date, ${METRIC_FIELDS}
     FROM ad_group WHERE ${range} AND metrics.impressions > 0`
  )) as GaqlRow[];

  const adRows = (await gaqlSearch(
    customerId,
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status,
            ad_group.id, ad_group.name, campaign.id, campaign.name,
            segments.date, ${METRIC_FIELDS}
     FROM ad_group_ad WHERE ${range} AND metrics.impressions > 0`
  )) as GaqlRow[];

  const keywordRows = (await gaqlSearch(
    customerId,
    `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group.id, ad_group.name, campaign.id, campaign.name,
            segments.date, ${METRIC_FIELDS}
     FROM keyword_view WHERE ${range} AND metrics.impressions > 0`
  )) as GaqlRow[];

  const upsertCampaign = db.prepare(
    `INSERT INTO google_ads_campaign_daily
       (account_id, campaign_id, campaign_name, status, channel_type, date,
        cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa, synced_at)
     VALUES (@account_id, @campaign_id, @campaign_name, @status, @channel_type, @date,
             @cost, @impressions, @clicks, @ctr, @avg_cpc, @conversions, @conversions_value, @roas, @cpa, datetime('now'))
     ON CONFLICT (account_id, campaign_id, date) DO UPDATE SET
       campaign_name=excluded.campaign_name, status=excluded.status,
       channel_type=excluded.channel_type, cost=excluded.cost,
       impressions=excluded.impressions, clicks=excluded.clicks, ctr=excluded.ctr,
       avg_cpc=excluded.avg_cpc, conversions=excluded.conversions,
       conversions_value=excluded.conversions_value, roas=excluded.roas,
       cpa=excluded.cpa, synced_at=excluded.synced_at`
  );
  const upsertAdGroup = db.prepare(
    `INSERT INTO google_ads_adgroup_daily
       (account_id, ad_group_id, ad_group_name, campaign_id, campaign_name, status, date,
        cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa, synced_at)
     VALUES (@account_id, @ad_group_id, @ad_group_name, @campaign_id, @campaign_name, @status, @date,
             @cost, @impressions, @clicks, @ctr, @avg_cpc, @conversions, @conversions_value, @roas, @cpa, datetime('now'))
     ON CONFLICT (account_id, ad_group_id, date) DO UPDATE SET
       ad_group_name=excluded.ad_group_name, campaign_id=excluded.campaign_id,
       campaign_name=excluded.campaign_name, status=excluded.status, cost=excluded.cost,
       impressions=excluded.impressions, clicks=excluded.clicks, ctr=excluded.ctr,
       avg_cpc=excluded.avg_cpc, conversions=excluded.conversions,
       conversions_value=excluded.conversions_value, roas=excluded.roas,
       cpa=excluded.cpa, synced_at=excluded.synced_at`
  );
  const upsertAd = db.prepare(
    `INSERT INTO google_ads_ad_daily
       (account_id, ad_id, ad_name, ad_type, ad_group_id, ad_group_name,
        campaign_id, campaign_name, status, date,
        cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa, synced_at)
     VALUES (@account_id, @ad_id, @ad_name, @ad_type, @ad_group_id, @ad_group_name,
             @campaign_id, @campaign_name, @status, @date,
             @cost, @impressions, @clicks, @ctr, @avg_cpc, @conversions, @conversions_value, @roas, @cpa, datetime('now'))
     ON CONFLICT (account_id, ad_id, date) DO UPDATE SET
       ad_name=excluded.ad_name, ad_type=excluded.ad_type, ad_group_id=excluded.ad_group_id,
       ad_group_name=excluded.ad_group_name, campaign_id=excluded.campaign_id,
       campaign_name=excluded.campaign_name, status=excluded.status, cost=excluded.cost,
       impressions=excluded.impressions, clicks=excluded.clicks, ctr=excluded.ctr,
       avg_cpc=excluded.avg_cpc, conversions=excluded.conversions,
       conversions_value=excluded.conversions_value, roas=excluded.roas,
       cpa=excluded.cpa, synced_at=excluded.synced_at`
  );
  const upsertKeyword = db.prepare(
    `INSERT INTO google_ads_keyword_daily
       (account_id, criterion_id, keyword_text, match_type, ad_group_id, ad_group_name,
        campaign_id, campaign_name, date,
        cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa, synced_at)
     VALUES (@account_id, @criterion_id, @keyword_text, @match_type, @ad_group_id, @ad_group_name,
             @campaign_id, @campaign_name, @date,
             @cost, @impressions, @clicks, @ctr, @avg_cpc, @conversions, @conversions_value, @roas, @cpa, datetime('now'))
     ON CONFLICT (account_id, ad_group_id, criterion_id, date) DO UPDATE SET
       keyword_text=excluded.keyword_text, match_type=excluded.match_type,
       ad_group_name=excluded.ad_group_name, campaign_id=excluded.campaign_id,
       campaign_name=excluded.campaign_name, cost=excluded.cost,
       impressions=excluded.impressions, clicks=excluded.clicks, ctr=excluded.ctr,
       avg_cpc=excluded.avg_cpc, conversions=excluded.conversions,
       conversions_value=excluded.conversions_value, roas=excluded.roas,
       cpa=excluded.cpa, synced_at=excluded.synced_at`
  );

  const tx = db.transaction(() => {
    for (const row of campaignRows) {
      upsertCampaign.run({
        account_id: customerId,
        campaign_id: String(row.campaign?.id ?? ""),
        campaign_name: String(row.campaign?.name ?? ""),
        status: String(row.campaign?.status ?? ""),
        channel_type: String(row.campaign?.advertisingChannelType ?? ""),
        date: String(row.segments?.date ?? ""),
        ...parseMetrics(row.metrics),
      });
    }
    for (const row of adGroupRows) {
      upsertAdGroup.run({
        account_id: customerId,
        ad_group_id: String(row.adGroup?.id ?? ""),
        ad_group_name: String(row.adGroup?.name ?? ""),
        campaign_id: String(row.campaign?.id ?? ""),
        campaign_name: String(row.campaign?.name ?? ""),
        status: String(row.adGroup?.status ?? ""),
        date: String(row.segments?.date ?? ""),
        ...parseMetrics(row.metrics),
      });
    }
    for (const row of adRows) {
      const ad = row.adGroupAd?.ad ?? {};
      upsertAd.run({
        account_id: customerId,
        ad_id: String(ad.id ?? ""),
        ad_name: String(ad.name ?? `Anuncio ${ad.id ?? ""}`),
        ad_type: String(ad.type ?? ""),
        ad_group_id: String(row.adGroup?.id ?? ""),
        ad_group_name: String(row.adGroup?.name ?? ""),
        campaign_id: String(row.campaign?.id ?? ""),
        campaign_name: String(row.campaign?.name ?? ""),
        status: String(row.adGroupAd?.status ?? ""),
        date: String(row.segments?.date ?? ""),
        ...parseMetrics(row.metrics),
      });
    }
    for (const row of keywordRows) {
      upsertKeyword.run({
        account_id: customerId,
        criterion_id: String(row.adGroupCriterion?.criterionId ?? ""),
        keyword_text: String(row.adGroupCriterion?.keyword?.text ?? ""),
        match_type: String(row.adGroupCriterion?.keyword?.matchType ?? ""),
        ad_group_id: String(row.adGroup?.id ?? ""),
        ad_group_name: String(row.adGroup?.name ?? ""),
        campaign_id: String(row.campaign?.id ?? ""),
        campaign_name: String(row.campaign?.name ?? ""),
        date: String(row.segments?.date ?? ""),
        ...parseMetrics(row.metrics),
      });
    }
  });
  tx();

  const recommendations = generateGoogleRecommendations(customerId, dateFrom, dateTo);

  return {
    campaigns: campaignRows.length,
    adGroups: adGroupRows.length,
    ads: adRows.length,
    keywords: keywordRows.length,
    recommendations,
  };
}
