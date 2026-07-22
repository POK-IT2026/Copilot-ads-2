import { NextResponse } from "next/server";
import { fetchGoogleTracks, fetchMetaTracks } from "@/lib/budgetNavigator/engine";
import { simulateBudgetChange, SIMULATE_WINDOW_DAYS } from "@/lib/budgetNavigator/simulate";
import { getGoogleAccounts, getMetaAccounts } from "@/lib/env";
import { googleAdsConnected } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

/**
 * POST /api/budget-navigator/simulate
 * Body: { platform: "meta" | "google", campaignId, deltaPct }
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    platform?: "meta" | "google";
    campaignId?: string;
    deltaPct?: number;
  };
  const { platform, campaignId, deltaPct } = body;

  if (platform !== "meta" && platform !== "google") {
    return NextResponse.json({ error: "platform debe ser meta o google" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId es requerido" }, { status: 400 });
  }
  if (!Number.isFinite(deltaPct)) {
    return NextResponse.json({ error: "deltaPct debe ser un número" }, { status: 400 });
  }

  try {
    const accountId = platform === "meta" ? getMetaAccounts()[0] : getGoogleAccounts()[0];
    if (!accountId || (platform === "google" && !googleAdsConnected())) {
      return NextResponse.json({ error: `No hay cuenta de ${platform} configurada` }, { status: 400 });
    }
    const tracks = platform === "meta" ? fetchMetaTracks(accountId) : fetchGoogleTracks(accountId);
    const track = tracks.find((t) => t.campaignId === campaignId);
    if (!track) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    const result = simulateBudgetChange({
      name: track.name,
      days: track.daily.slice(-SIMULATE_WINDOW_DAYS),
      deltaPct: deltaPct as number,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
