import { getDb } from "../db";
import { metaGetAll } from "./api";
import { generateMetaRecommendations } from "./recommendations";

const INSIGHT_METRIC_FIELDS =
  "spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions,action_values,date_start";

const PURCHASE_TYPES = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
];

const LEAD_TYPES = [
  "onsite_conversion.lead_grouped",
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "offsite_conversion.lead",
  "omni_lead",
];

const MESSAGE_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started",
  "messaging_conversation_started",
  "onsite_conversion.total_messaging_connection",
];

interface ActionEntry {
  action_type: string;
  value: string;
}

function pickAction(list: unknown, types: string[]): number {
  if (!Array.isArray(list)) return 0;
  for (const type of types) {
    const hit = (list as ActionEntry[]).find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

function parseMetrics(row: Record<string, unknown>) {
  const spend = Number(row.spend) || 0;
  const purchases = pickAction(row.actions, PURCHASE_TYPES);
  const purchaseValue = pickAction(row.action_values, PURCHASE_TYPES);
  const leads = pickAction(row.actions, LEAD_TYPES);
  const messages = pickAction(row.actions, MESSAGE_TYPES);
  const results = leads + messages;

  return {
    date: String(row.date_start ?? ""),
    spend,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    reach: Number(row.reach) || 0,
    frequency: Number(row.frequency) || 0,
    ctr: Number(row.ctr) || 0,
    cpc: Number(row.cpc) || 0,
    cpm: Number(row.cpm) || 0,
    purchases,
    purchase_value: purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : 0,
    cpa: purchases > 0 ? spend / purchases : 0,
    leads,
    messages,
    results,
    cpl: results > 0 ? spend / results : 0,
  };
}

export interface MetaSyncResult {
  syncRunId: number;
  campaigns: number;
  adsets: number;
  ads: number;
  recommendations: number;
}

export interface MetaSyncOptions {
  generateRecommendations?: boolean;
}

export async function syncMetaAccount(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  options: MetaSyncOptions = {}
): Promise<MetaSyncResult> {
  const db = getDb();
  const run = db
    .prepare(
      `INSERT INTO meta_ads_sync_runs (account_id, date_from, date_to, status)
       VALUES (?, ?, ?, 'running')`
    )
    .run(accountId, dateFrom, dateTo);
  const runId = Number(run.lastInsertRowid);

  try {
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });

    const campaignMeta = new Map<string, Record<string, unknown>>();
    for (const c of await metaGetAll(`/${accountId}/campaigns`, {
      fields: "id,name,effective_status,objective",
    })) {
      campaignMeta.set(String(c.id), c);
    }

    const adsetMeta = new Map<string, Record<string, unknown>>();
    for (const a of await metaGetAll(`/${accountId}/adsets`, {
      fields: "id,name,effective_status",
    })) {
      adsetMeta.set(String(a.id), a);
    }

    const adMeta = new Map<string, Record<string, unknown>>();
    for (const a of await metaGetAll(`/${accountId}/ads`, {
      fields: "id,name,effective_status,creative{id,thumbnail_url}",
    })) {
      adMeta.set(String(a.id), a);
    }

    const campaignRows = await metaGetAll(`/${accountId}/insights`, {
      level: "campaign",
      time_increment: "1",
      time_range: timeRange,
      fields: `campaign_id,campaign_name,objective,${INSIGHT_METRIC_FIELDS}`,
    });
    const adsetRows = await metaGetAll(`/${accountId}/insights`, {
      level: "adset",
      time_increment: "1",
      time_range: timeRange,
      fields: `campaign_id,campaign_name,adset_id,adset_name,${INSIGHT_METRIC_FIELDS}`,
    });
    const adRows = await metaGetAll(`/${accountId}/insights`, {
      level: "ad",
      time_increment: "1",
      time_range: timeRange,
      fields: `campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,${INSIGHT_METRIC_FIELDS}`,
    });

    const upsertCampaign = db.prepare(
      `INSERT INTO meta_ads_campaign_daily
         (account_id, campaign_id, campaign_name, objective, status, date,
          spend, impressions, clicks, reach, frequency, ctr, cpc, cpm,
          purchases, purchase_value, roas, cpa, leads, messages, results, cpl, synced_at)
       VALUES (@account_id, @campaign_id, @campaign_name, @objective, @status, @date,
               @spend, @impressions, @clicks, @reach, @frequency, @ctr, @cpc, @cpm,
               @purchases, @purchase_value, @roas, @cpa, @leads, @messages, @results, @cpl, datetime('now'))
       ON CONFLICT (account_id, campaign_id, date) DO UPDATE SET
         campaign_name=excluded.campaign_name, objective=excluded.objective,
         status=excluded.status, spend=excluded.spend, impressions=excluded.impressions,
         clicks=excluded.clicks, reach=excluded.reach, frequency=excluded.frequency,
         ctr=excluded.ctr, cpc=excluded.cpc, cpm=excluded.cpm,
         purchases=excluded.purchases, purchase_value=excluded.purchase_value,
         roas=excluded.roas, cpa=excluded.cpa, leads=excluded.leads,
         messages=excluded.messages, results=excluded.results, cpl=excluded.cpl,
         synced_at=excluded.synced_at`
    );

    const upsertAdset = db.prepare(
      `INSERT INTO meta_ads_adset_daily
         (account_id, adset_id, adset_name, campaign_id, campaign_name, status, date,
          spend, impressions, clicks, reach, frequency, ctr, cpc, cpm,
          purchases, purchase_value, roas, cpa, leads, messages, results, cpl, synced_at)
       VALUES (@account_id, @adset_id, @adset_name, @campaign_id, @campaign_name, @status, @date,
               @spend, @impressions, @clicks, @reach, @frequency, @ctr, @cpc, @cpm,
               @purchases, @purchase_value, @roas, @cpa, @leads, @messages, @results, @cpl, datetime('now'))
       ON CONFLICT (account_id, adset_id, date) DO UPDATE SET
         adset_name=excluded.adset_name, campaign_id=excluded.campaign_id,
         campaign_name=excluded.campaign_name, status=excluded.status,
         spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks,
         reach=excluded.reach, frequency=excluded.frequency, ctr=excluded.ctr,
         cpc=excluded.cpc, cpm=excluded.cpm, purchases=excluded.purchases,
         purchase_value=excluded.purchase_value, roas=excluded.roas, cpa=excluded.cpa,
         leads=excluded.leads, messages=excluded.messages, results=excluded.results,
         cpl=excluded.cpl, synced_at=excluded.synced_at`
    );

    const upsertAd = db.prepare(
      `INSERT INTO meta_ads_ad_daily
         (account_id, ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name,
          status, creative_id, thumbnail_url, date,
          spend, impressions, clicks, reach, frequency, ctr, cpc, cpm,
          purchases, purchase_value, roas, cpa, leads, messages, results, cpl, synced_at)
       VALUES (@account_id, @ad_id, @ad_name, @adset_id, @adset_name, @campaign_id, @campaign_name,
               @status, @creative_id, @thumbnail_url, @date,
               @spend, @impressions, @clicks, @reach, @frequency, @ctr, @cpc, @cpm,
               @purchases, @purchase_value, @roas, @cpa, @leads, @messages, @results, @cpl, datetime('now'))
       ON CONFLICT (account_id, ad_id, date) DO UPDATE SET
         ad_name=excluded.ad_name, adset_id=excluded.adset_id, adset_name=excluded.adset_name,
         campaign_id=excluded.campaign_id, campaign_name=excluded.campaign_name,
         status=excluded.status, creative_id=excluded.creative_id,
         thumbnail_url=excluded.thumbnail_url, spend=excluded.spend,
         impressions=excluded.impressions, clicks=excluded.clicks, reach=excluded.reach,
         frequency=excluded.frequency, ctr=excluded.ctr, cpc=excluded.cpc, cpm=excluded.cpm,
         purchases=excluded.purchases, purchase_value=excluded.purchase_value,
         roas=excluded.roas, cpa=excluded.cpa, leads=excluded.leads,
         messages=excluded.messages, results=excluded.results, cpl=excluded.cpl,
         synced_at=excluded.synced_at`
    );

    const tx = db.transaction(() => {
      for (const row of campaignRows) {
        const meta = campaignMeta.get(String(row.campaign_id));
        upsertCampaign.run({
          account_id: accountId,
          campaign_id: String(row.campaign_id ?? ""),
          campaign_name: String(row.campaign_name ?? ""),
          objective: String(row.objective ?? meta?.objective ?? ""),
          status: String(meta?.effective_status ?? ""),
          ...parseMetrics(row),
        });
      }

      for (const row of adsetRows) {
        const meta = adsetMeta.get(String(row.adset_id));
        upsertAdset.run({
          account_id: accountId,
          adset_id: String(row.adset_id ?? ""),
          adset_name: String(row.adset_name ?? ""),
          campaign_id: String(row.campaign_id ?? ""),
          campaign_name: String(row.campaign_name ?? ""),
          status: String(meta?.effective_status ?? ""),
          ...parseMetrics(row),
        });
      }

      for (const row of adRows) {
        const meta = adMeta.get(String(row.ad_id));
        const creative = (meta?.creative ?? {}) as Record<string, unknown>;
        upsertAd.run({
          account_id: accountId,
          ad_id: String(row.ad_id ?? ""),
          ad_name: String(row.ad_name ?? ""),
          adset_id: String(row.adset_id ?? ""),
          adset_name: String(row.adset_name ?? ""),
          campaign_id: String(row.campaign_id ?? ""),
          campaign_name: String(row.campaign_name ?? ""),
          status: String(meta?.effective_status ?? ""),
          creative_id: creative.id ? String(creative.id) : null,
          thumbnail_url: creative.thumbnail_url ? String(creative.thumbnail_url) : null,
          ...parseMetrics(row),
        });
      }
    });
    tx();

    const recommendations =
      options.generateRecommendations === false
        ? 0
        : generateMetaRecommendations(accountId, dateFrom, dateTo, runId);

    db.prepare(
      `UPDATE meta_ads_sync_runs
       SET status='success', campaigns_rows=?, adsets_rows=?, ads_rows=?,
           recommendations_count=?, finished_at=datetime('now')
       WHERE id=?`
    ).run(campaignRows.length, adsetRows.length, adRows.length, recommendations, runId);

    return {
      syncRunId: runId,
      campaigns: campaignRows.length,
      adsets: adsetRows.length,
      ads: adRows.length,
      recommendations,
    };
  } catch (err) {
    db.prepare(
      `UPDATE meta_ads_sync_runs SET status='error', error=?, finished_at=datetime('now') WHERE id=?`
    ).run(err instanceof Error ? err.message : String(err), runId);
    throw err;
  }
}
