import { NextResponse } from "next/server";
import { buildBudgetCurve } from "@/lib/budgetNavigator/budgetCurve";
import type { CampaignAllocationInput } from "@/lib/budgetNavigator/allocate";
import { getBudgetNavigatorState } from "@/lib/budgetNavigator/engine";
import { getGoals } from "@/lib/budgetNavigator/goals";

export const dynamic = "force-dynamic";

/**
 * GET /api/budget-navigator/curve -- curva de retorno esperado (ROAS/
 * conversiones proyectados) contra distintos niveles de presupuesto diario
 * total. Reconstruye los inputs desde el último `campaign_snapshots`
 * persistido (sin releer presupuestos en vivo de Meta/Google), por eso es
 * rápido y puede llamarse tan seguido como el usuario mueva el rango.
 */
export async function GET() {
  const state = getBudgetNavigatorState();
  if (!state) {
    return NextResponse.json(
      { error: "Budget Navigator no se ha calculado todavía" },
      { status: 404 }
    );
  }

  const campaigns: CampaignAllocationInput[] = state.campaignSnapshots.map((c) => ({
    campaignId: c.campaignId,
    name: c.name,
    category: c.category,
    spend: c.spend,
    conversions: c.conversions,
    value: c.value,
    clicks: c.clicks,
    currentDailyBudget: c.currentDailyBudget,
  }));

  const goals = getGoals();
  const curve = buildBudgetCurve(campaigns, state.totalDailyBudget, undefined, {
    roas: goals.sales?.roasTarget ?? null,
    cpl: goals.leads?.cpaTarget ?? null,
    cpc: goals.traffic?.cpaTarget ?? null,
  });

  return NextResponse.json({ curve, currentDailyTotal: state.totalDailyBudget, currency: state.currency });
}
