import { NextResponse } from "next/server";
import { aiAvailable, generateAiAnalysis } from "@/lib/ai";
import { getMetaKpis, listMetaCampaigns } from "@/lib/meta/queries";
import { computeMetaAlerts } from "@/lib/meta/recommendations";
import { getGoogleKpis, listGoogleCampaigns } from "@/lib/google/queries";
import {
  aggregateGoogleLevel,
  evaluateByCategory,
  googleAccountAverages,
  googleChannelTypeByCampaignId,
} from "@/lib/google/recommendations";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/ai-analysis — análisis opcional con Claude.
 * Body: { platform: "meta" | "google", accountId, dateFrom, dateTo }
 */
export async function POST(request: Request) {
  if (!aiAvailable()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no está configurada — el análisis con IA es opcional" },
      { status: 400 }
    );
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      platform?: "meta" | "google";
      accountId?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    const { platform, accountId, dateFrom, dateTo } = body;
    if (!platform || !accountId || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "platform, accountId, dateFrom y dateTo son requeridos" },
        { status: 400 }
      );
    }

    let kpis: Record<string, number>;
    let campaigns: Array<Record<string, unknown>>;
    let findings: Array<Record<string, unknown>>;

    if (platform === "meta") {
      kpis = { ...getMetaKpis(accountId, dateFrom, dateTo) };
      campaigns = listMetaCampaigns(accountId, dateFrom, dateTo).slice(0, 15) as unknown as Array<
        Record<string, unknown>
      >;
      findings = computeMetaAlerts(accountId, dateFrom, dateTo)
        .slice(0, 15)
        .map((a) => ({
          rule: a.rule,
          priority: a.priority,
          level: a.level,
          entity: a.entityName,
          detail: a.detail,
        }));
    } else {
      kpis = { ...getGoogleKpis(accountId, dateFrom, dateTo) };
      campaigns = listGoogleCampaigns(accountId, dateFrom, dateTo).slice(0, 15) as unknown as Array<
        Record<string, unknown>
      >;
      const channelTypeByCampaignId = googleChannelTypeByCampaignId(accountId, dateFrom, dateTo);
      const entities = aggregateGoogleLevel(
        "campaign",
        accountId,
        dateFrom,
        dateTo,
        channelTypeByCampaignId
      );
      const avg = googleAccountAverages(entities);
      findings = entities
        .flatMap((e) =>
          evaluateByCategory(e, avg).map((f) => ({
            rule: f.rule,
            priority: f.priority,
            level: e.level,
            entity: e.name,
            detail: f.detail,
          }))
        )
        .slice(0, 15);
    }

    const analysis = await generateAiAnalysis({
      platform,
      accountId,
      dateFrom,
      dateTo,
      kpis,
      campaigns,
      findings,
    });
    return NextResponse.json({ analysis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
