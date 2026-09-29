/**
 * Portfolios de Budget Navigator: agrupación/vista manual de campañas
 * (v1 -- no cambia el reparto de allocate.ts, que sigue siendo plano y de
 * una sola pasada). Una campaña pertenece a lo sumo un portfolio a la vez
 * (PRIMARY KEY (platform, campaign_id) en budget_navigator_portfolio_campaigns).
 */

import { getDb } from "../db";
import type { Platform } from "../recommendationActionRules";

export interface Portfolio {
  id: number;
  name: string;
  createdAt: string;
}

export interface PortfolioWithCampaigns extends Portfolio {
  campaigns: Array<{ platform: Platform; campaignId: string }>;
}

export function listPortfolios(): PortfolioWithCampaigns[] {
  const db = getDb();
  const portfolios = db
    .prepare(`SELECT id, name, created_at FROM budget_navigator_portfolios ORDER BY created_at ASC`)
    .all() as Array<{ id: number; name: string; created_at: string }>;
  const assignments = db
    .prepare(`SELECT portfolio_id, platform, campaign_id FROM budget_navigator_portfolio_campaigns`)
    .all() as Array<{ portfolio_id: number; platform: Platform; campaign_id: string }>;

  const byPortfolio = new Map<number, Array<{ platform: Platform; campaignId: string }>>();
  for (const a of assignments) {
    const arr = byPortfolio.get(a.portfolio_id) ?? [];
    arr.push({ platform: a.platform, campaignId: a.campaign_id });
    byPortfolio.set(a.portfolio_id, arr);
  }

  return portfolios.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at,
    campaigns: byPortfolio.get(p.id) ?? [],
  }));
}

export function createPortfolio(name: string): Portfolio {
  const db = getDb();
  const result = db.prepare(`INSERT INTO budget_navigator_portfolios (name) VALUES (?)`).run(name);
  const row = db
    .prepare(`SELECT id, name, created_at FROM budget_navigator_portfolios WHERE id = ?`)
    .get(result.lastInsertRowid) as { id: number; name: string; created_at: string };
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function renamePortfolio(id: number, name: string): void {
  const db = getDb();
  db.prepare(`UPDATE budget_navigator_portfolios SET name = ? WHERE id = ?`).run(name, id);
}

export function deletePortfolio(id: number): void {
  const db = getDb();
  db.prepare(`DELETE FROM budget_navigator_portfolios WHERE id = ?`).run(id);
}

export function assignCampaign(portfolioId: number, platform: Platform, campaignId: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO budget_navigator_portfolio_campaigns (portfolio_id, platform, campaign_id)
     VALUES (?, ?, ?)
     ON CONFLICT (platform, campaign_id) DO UPDATE SET portfolio_id = excluded.portfolio_id`
  ).run(portfolioId, platform, campaignId);
}

export function unassignCampaign(platform: Platform, campaignId: string): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM budget_navigator_portfolio_campaigns WHERE platform = ? AND campaign_id = ?`
  ).run(platform, campaignId);
}

/** key = `${platform}:${campaignId}` -- para lookup batch al construir campaignSnapshots. */
export function portfolioIdByCampaign(): Map<string, number> {
  const db = getDb();
  const rows = db
    .prepare(`SELECT portfolio_id, platform, campaign_id FROM budget_navigator_portfolio_campaigns`)
    .all() as Array<{ portfolio_id: number; platform: Platform; campaign_id: string }>;
  return new Map(rows.map((r) => [`${r.platform}:${r.campaign_id}`, r.portfolio_id]));
}
