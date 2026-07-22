import { NextResponse } from "next/server";
import { recalculateBudgetNavigator } from "@/lib/budgetNavigator/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/budget-navigator/recalculate -- corre el motor bajo demanda. */
export async function POST() {
  try {
    const result = await recalculateBudgetNavigator();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
