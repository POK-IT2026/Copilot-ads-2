import { NextResponse } from "next/server";
import { setMasterBudget } from "@/lib/budgetNavigator/engine";

export const dynamic = "force-dynamic";

/** POST /api/budget-navigator/master-budget -- Body: { monthlyBudget } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { monthlyBudget?: number };
  const { monthlyBudget } = body;
  if (!Number.isFinite(monthlyBudget) || (monthlyBudget as number) < 0) {
    return NextResponse.json(
      { error: "monthlyBudget debe ser un número mayor o igual a 0" },
      { status: 400 }
    );
  }
  setMasterBudget(monthlyBudget as number);
  return NextResponse.json({ ok: true });
}
