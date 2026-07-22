/**
 * Orquesta Budget Navigator: lee historial diario de campañas activas
 * (Meta + Google), resuelve categoría, calcula promedios de cuenta por
 * categoría, corre las 4 reglas del motor inteligente y el reparto del
 * presupuesto maestro, inserta los findings en las tablas de
 * recomendaciones existentes, y persiste el snapshot en
 * `budget_navigator_state`.
 *
 * Solo corre bajo demanda (botón "Recalcular ahora" o auto-recálculo si
 * el último snapshot tiene más de 1 hora) -- nunca en segundo plano.
 */

import { getDb } from "../db";
import { getGoogleAccounts, getMetaAccounts } from "../env";
import { googleAdsConnected } from "../google/oauth";
import { classifyGoogleChannelType, classifyMetaObjective, type CampaignCategory } from "../campaignCategory";
import { googleChannelTypeByCampaignId } from "../google/recommendations";
import { metaObjectiveByCampaignId } from "../meta/recommendations";
import { getGoogleCampaignLive } from "../google/actions";
import { getMetaAccountCurrency, getMetaEntityLive } from "../meta/actions";
import { evaluateBudgetHistory, LOOKBACK_DAYS, type BudgetFinding, type DailyMetricRow } from "./rules";
import { allocateBudget, type CampaignAllocationInput } from "./allocate";

const BASELINE_DAYS = 30;
const MAX_CAMPAIGNS_PER_PLATFORM = 25;
const STALE_MS = 60 * 60 * 1000; // 1 hora

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

export interface CampaignTrack {
  platform: "meta" | "google";
  campaignId: string;
  name: string;
  category: CampaignCategory;
  active: boolean;
  daily: DailyMetricRow[]; // orden ascendente, ventana de BASELINE_DAYS
}

// ---------- Meta ----------

interface MetaRawRow {
  campaign_id: string;
  campaign_name: string;
  status: string;
  date: string;
  spend: number;
  clicks: number;
  results: number;
  purchases: number;
  purchase_value: number;
}

export function fetchMetaTracks(accountId: string): CampaignTrack[] {
  const db = getDb();
  const dateFrom = daysAgo(BASELINE_DAYS - 1);
  const dateTo = isoDate(new Date());
  const rows = db
    .prepare(
      `SELECT campaign_id, campaign_name, status, date, spend, clicks, results, purchases, purchase_value
       FROM meta_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       ORDER BY campaign_id, date`
    )
    .all(accountId, dateFrom, dateTo) as MetaRawRow[];

  const objectiveByCampaignId = metaObjectiveByCampaignId(accountId, dateFrom, dateTo);
  const byCampaign = new Map<string, MetaRawRow[]>();
  for (const r of rows) {
    const arr = byCampaign.get(r.campaign_id) ?? [];
    arr.push(r);
    byCampaign.set(r.campaign_id, arr);
  }

  const tracks: CampaignTrack[] = [];
  for (const [campaignId, campaignRows] of byCampaign) {
    const category = classifyMetaObjective(objectiveByCampaignId.get(campaignId));
    const last = campaignRows[campaignRows.length - 1];
    const daily: DailyMetricRow[] = campaignRows.map((r) => ({
      date: r.date,
      spend: r.spend ?? 0,
      conversions:
        category === "sales" ? r.purchases ?? 0 : category === "traffic" ? r.clicks ?? 0 : r.results ?? 0,
      value: category === "sales" ? r.purchase_value ?? 0 : 0,
    }));
    tracks.push({
      platform: "meta",
      campaignId,
      name: last.campaign_name ?? "",
      category,
      active: (last.status ?? "").toUpperCase() === "ACTIVE",
      daily,
    });
  }
  return tracks;
}

// ---------- Google ----------

interface GoogleRawRow {
  campaign_id: string;
  campaign_name: string;
  status: string;
  date: string;
  cost: number;
  clicks: number;
  conversions: number;
  conversions_value: number;
}

export function fetchGoogleTracks(accountId: string): CampaignTrack[] {
  const db = getDb();
  const dateFrom = daysAgo(BASELINE_DAYS - 1);
  const dateTo = isoDate(new Date());
  const rows = db
    .prepare(
      `SELECT campaign_id, campaign_name, status, date, cost, clicks, conversions, conversions_value
       FROM google_ads_campaign_daily
       WHERE account_id = ? AND date BETWEEN ? AND ?
       ORDER BY campaign_id, date`
    )
    .all(accountId, dateFrom, dateTo) as GoogleRawRow[];

  const channelByCampaignId = googleChannelTypeByCampaignId(accountId, dateFrom, dateTo);
  const byCampaign = new Map<string, GoogleRawRow[]>();
  for (const r of rows) {
    const arr = byCampaign.get(r.campaign_id) ?? [];
    arr.push(r);
    byCampaign.set(r.campaign_id, arr);
  }

  const tracks: CampaignTrack[] = [];
  for (const [campaignId, campaignRows] of byCampaign) {
    const category = classifyGoogleChannelType(channelByCampaignId.get(campaignId));
    const last = campaignRows[campaignRows.length - 1];
    const daily: DailyMetricRow[] = campaignRows.map((r) => ({
      date: r.date,
      spend: r.cost ?? 0,
      conversions: category === "traffic" ? r.clicks ?? 0 : r.conversions ?? 0,
      value: category === "sales" ? r.conversions_value ?? 0 : 0,
    }));
    tracks.push({
      platform: "google",
      campaignId,
      name: last.campaign_name ?? "",
      category,
      active: (last.status ?? "").toUpperCase() === "ENABLED",
      daily,
    });
  }
  return tracks;
}

// ---------- Promedios de cuenta por categoría (ventana de baseline) ----------

function categoryBaseline(tracks: CampaignTrack[]) {
  const totals: Record<string, { spend: number; value: number; conversions: number }> = {};
  for (const t of tracks) {
    const b = (totals[t.category] ??= { spend: 0, value: 0, conversions: 0 });
    for (const d of t.daily) {
      b.spend += d.spend;
      b.value += d.value;
      b.conversions += d.conversions;
    }
  }
  const salesRoas = (totals.sales?.spend ?? 0) > 0 ? totals.sales.value / totals.sales.spend : 0;
  const leadsCpa =
    (totals.leads?.conversions ?? 0) > 0 ? totals.leads.spend / totals.leads.conversions : 0;
  const trafficCpc =
    (totals.traffic?.conversions ?? 0) > 0 ? totals.traffic.spend / totals.traffic.conversions : 0;
  return { salesRoas, leadsCpa, trafficCpc };
}

// ---------- Recomendaciones (reusa las tablas existentes) ----------

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function persistFindings(
  platform: "meta" | "google",
  accountId: string,
  items: Array<{ campaignId: string; name: string; findings: BudgetFinding[] }>
) {
  const table = platform === "google" ? "google_ads_recommendations" : "meta_ads_recommendations";
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO ${table} (account_id, level, entity_id, entity_name, rule, priority, title, detail, kpi_snapshot)
     VALUES (?, 'campaign', ?, ?, ?, ?, ?, ?, '{}')`
  );
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM ${table} WHERE account_id = ? AND status = 'pending' AND rule LIKE 'bn_%'`).run(
      accountId
    );
    for (const item of items) {
      for (const f of item.findings) {
        insert.run(accountId, item.campaignId, item.name, f.rule, f.priority, f.title, f.detail);
      }
    }
  });
  tx();
}

export interface RecalculateResult {
  computedAt: string;
  monthlyBudget: number;
  currency: string;
  totalDailyBudget: number;
  totalSpendMtd: number;
  campaignSnapshots: Array<{
    platform: "meta" | "google";
    campaignId: string;
    name: string;
    category: CampaignCategory;
    currentDailyBudget: number | null;
    targetDailyBudget: number;
    findingCount: number;
  }>;
}

export async function recalculateBudgetNavigator(): Promise<RecalculateResult> {
  const db = getDb();
  const stateRow = db.prepare(`SELECT * FROM budget_navigator_state WHERE id = 1`).get() as
    | { monthly_budget: number; currency: string }
    | undefined;
  const monthlyBudget = stateRow?.monthly_budget ?? 0;

  const metaAccountId = getMetaAccounts()[0];
  const googleAccountId = googleAdsConnected() ? getGoogleAccounts()[0] : undefined;

  let currency = stateRow?.currency ?? "MXN";
  if (metaAccountId) {
    try {
      currency = await getMetaAccountCurrency(metaAccountId);
    } catch {
      /* se mantiene la moneda guardada si falla */
    }
  }

  const metaTracks = metaAccountId ? fetchMetaTracks(metaAccountId) : [];
  const googleTracks = googleAccountId ? fetchGoogleTracks(googleAccountId) : [];
  const allTracks = [...metaTracks, ...googleTracks];
  const baseline = categoryBaseline(allTracks);

  const now = new Date();
  const nowHour = now.getHours();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalDailyBudget = monthlyBudget > 0 ? monthlyBudget / daysInMonth : 0;

  // Solo se procesan campañas activas, acotado por gasto reciente para no
  // disparar demasiadas llamadas en vivo a la API en cuentas grandes.
  const activeSorted = allTracks
    .filter((t) => t.active && t.daily.length > 0)
    .sort((a, b) => {
      const spendA = a.daily.reduce((s, d) => s + d.spend, 0);
      const spendB = b.daily.reduce((s, d) => s + d.spend, 0);
      return spendB - spendA;
    })
    .slice(0, MAX_CAMPAIGNS_PER_PLATFORM * 2);

  const allocationInputs: CampaignAllocationInput[] = [];
  const ruleFindingsByCampaign = new Map<string, BudgetFinding[]>();
  const liveBudgetByCampaign = new Map<string, number | null>();

  for (const track of activeSorted) {
    let currentDailyBudget: number | null = null;
    try {
      if (track.platform === "meta") {
        const live = await getMetaEntityLive(track.campaignId, currency);
        currentDailyBudget = live.dailyBudget;
      } else if (googleAccountId) {
        const live = await getGoogleCampaignLive(googleAccountId, track.campaignId);
        currentDailyBudget = live.amountMicros > 0 ? live.amountMicros / 1_000_000 : null;
      }
    } catch {
      currentDailyBudget = null; // no bloquea el resto del recálculo
    }
    liveBudgetByCampaign.set(track.campaignId, currentDailyBudget);

    const days = track.daily.slice(-LOOKBACK_DAYS);
    const avgCpa = track.category === "leads" ? baseline.leadsCpa : baseline.trafficCpc;
    const findings = evaluateBudgetHistory({
      name: track.name,
      category: track.category,
      days,
      avgRoas: baseline.salesRoas,
      avgCpa,
      currentDailyBudget,
      nowHour,
    });
    ruleFindingsByCampaign.set(track.campaignId, findings);

    const totals = track.daily.reduce(
      (acc, d) => ({
        spend: acc.spend + d.spend,
        conversions: acc.conversions + d.conversions,
        value: acc.value + d.value,
        clicks: acc.clicks + (track.category === "traffic" ? d.conversions : 0),
      }),
      { spend: 0, conversions: 0, value: 0, clicks: 0 }
    );
    allocationInputs.push({
      campaignId: track.campaignId,
      name: track.name,
      category: track.category,
      spend: totals.spend,
      conversions: totals.conversions,
      value: totals.value,
      clicks: totals.clicks,
      currentDailyBudget,
    });
  }

  const allocations = totalDailyBudget > 0 ? allocateBudget(allocationInputs, totalDailyBudget) : [];
  const allocationByCampaign = new Map(allocations.map((a) => [a.campaignId, a]));

  const metaItems: Array<{ campaignId: string; name: string; findings: BudgetFinding[] }> = [];
  const googleItems: Array<{ campaignId: string; name: string; findings: BudgetFinding[] }> = [];
  const campaignSnapshots: RecalculateResult["campaignSnapshots"] = [];

  for (const track of activeSorted) {
    const ruleFindings = ruleFindingsByCampaign.get(track.campaignId) ?? [];
    const allocation = allocationByCampaign.get(track.campaignId);
    const findings = [...ruleFindings, ...(allocation?.findings ?? [])].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
    if (findings.length > 0) {
      (track.platform === "meta" ? metaItems : googleItems).push({
        campaignId: track.campaignId,
        name: track.name,
        findings,
      });
    }
    campaignSnapshots.push({
      platform: track.platform,
      campaignId: track.campaignId,
      name: track.name,
      category: track.category,
      currentDailyBudget: liveBudgetByCampaign.get(track.campaignId) ?? null,
      targetDailyBudget: allocation?.targetDailyBudget ?? 0,
      findingCount: findings.length,
    });
  }

  if (metaAccountId) persistFindings("meta", metaAccountId, metaItems);
  if (googleAccountId) persistFindings("google", googleAccountId, googleItems);

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const spendRow = metaAccountId
    ? (db
        .prepare(
          `SELECT COALESCE(SUM(spend),0) s FROM meta_ads_campaign_daily WHERE account_id = ? AND date >= ?`
        )
        .get(metaAccountId, monthStart) as { s: number })
    : { s: 0 };
  const costRow = googleAccountId
    ? (db
        .prepare(
          `SELECT COALESCE(SUM(cost),0) s FROM google_ads_campaign_daily WHERE account_id = ? AND date >= ?`
        )
        .get(googleAccountId, monthStart) as { s: number })
    : { s: 0 };
  const totalSpendMtd = (spendRow.s ?? 0) + (costRow.s ?? 0);

  const computedAt = now.toISOString();
  db.prepare(
    `INSERT INTO budget_navigator_state (id, monthly_budget, currency, computed_at, total_daily_budget, total_spend_mtd, campaign_snapshots)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       currency = excluded.currency, computed_at = excluded.computed_at,
       total_daily_budget = excluded.total_daily_budget, total_spend_mtd = excluded.total_spend_mtd,
       campaign_snapshots = excluded.campaign_snapshots`
  ).run(monthlyBudget, currency, computedAt, totalDailyBudget, totalSpendMtd, JSON.stringify(campaignSnapshots));

  return {
    computedAt,
    monthlyBudget,
    currency,
    totalDailyBudget,
    totalSpendMtd,
    campaignSnapshots,
  };
}

export interface BudgetNavigatorState extends RecalculateResult {
  isStale: boolean;
}

export function getBudgetNavigatorState(): BudgetNavigatorState | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM budget_navigator_state WHERE id = 1`).get() as
    | {
        monthly_budget: number;
        currency: string;
        computed_at: string | null;
        total_daily_budget: number;
        total_spend_mtd: number;
        campaign_snapshots: string;
      }
    | undefined;
  if (!row) return null;
  const computedAtMs = row.computed_at ? new Date(row.computed_at).getTime() : 0;
  return {
    computedAt: row.computed_at ?? "",
    monthlyBudget: row.monthly_budget,
    currency: row.currency,
    totalDailyBudget: row.total_daily_budget,
    totalSpendMtd: row.total_spend_mtd,
    campaignSnapshots: JSON.parse(row.campaign_snapshots || "[]"),
    isStale: !row.computed_at || Date.now() - computedAtMs > STALE_MS,
  };
}

export function setMasterBudget(monthlyBudget: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO budget_navigator_state (id, monthly_budget) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET monthly_budget = excluded.monthly_budget`
  ).run(monthlyBudget);
}
