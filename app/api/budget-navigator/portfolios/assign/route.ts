import { NextResponse } from "next/server";
import { assignCampaign, unassignCampaign } from "@/lib/budgetNavigator/portfolios";
import type { Platform } from "@/lib/recommendationActionRules";

export const dynamic = "force-dynamic";

/**
 * POST /api/budget-navigator/portfolios/assign
 * Body: { platform, campaignId, portfolioId } -- portfolioId null/ausente desasigna.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    platform?: string;
    campaignId?: string;
    portfolioId?: number | null;
  };
  const { platform, campaignId, portfolioId } = body;

  if (platform !== "meta" && platform !== "google") {
    return NextResponse.json({ error: "platform debe ser meta o google" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId es requerido" }, { status: 400 });
  }

  if (portfolioId === null || portfolioId === undefined) {
    unassignCampaign(platform as Platform, campaignId);
  } else {
    if (!Number.isFinite(portfolioId)) {
      return NextResponse.json({ error: "portfolioId debe ser un número" }, { status: 400 });
    }
    assignCampaign(portfolioId, platform as Platform, campaignId);
  }
  return NextResponse.json({ ok: true });
}
