import { NextResponse } from "next/server";
import { getGoals, setGoal } from "@/lib/budgetNavigator/goals";
import type { CampaignCategory } from "@/lib/campaignCategory";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set<CampaignCategory>(["leads", "sales", "traffic", "awareness"]);

/** GET /api/budget-navigator/goals -- metas actuales por categoría. */
export async function GET() {
  return NextResponse.json({ goals: getGoals() });
}

/**
 * POST /api/budget-navigator/goals -- upsert de una categoría.
 * Body: { category, roasTarget?, cpaTarget?, kpiCountTarget? } (null limpia el campo).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    category?: string;
    roasTarget?: number | null;
    cpaTarget?: number | null;
    kpiCountTarget?: number | null;
  };
  const { category, roasTarget, cpaTarget, kpiCountTarget } = body;

  if (!category || !VALID_CATEGORIES.has(category as CampaignCategory)) {
    return NextResponse.json(
      { error: "category debe ser leads, sales, traffic o awareness" },
      { status: 400 }
    );
  }
  for (const [label, v] of [
    ["roasTarget", roasTarget],
    ["cpaTarget", cpaTarget],
    ["kpiCountTarget", kpiCountTarget],
  ] as const) {
    if (v !== undefined && v !== null && (!Number.isFinite(v) || v < 0)) {
      return NextResponse.json({ error: `${label} debe ser un número mayor o igual a 0` }, { status: 400 });
    }
  }

  setGoal(category as CampaignCategory, { roasTarget, cpaTarget, kpiCountTarget });
  return NextResponse.json({ ok: true });
}
