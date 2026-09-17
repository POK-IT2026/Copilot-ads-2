import { NextResponse } from "next/server";
import { createPortfolio, listPortfolios } from "@/lib/budgetNavigator/portfolios";

export const dynamic = "force-dynamic";

/** GET /api/budget-navigator/portfolios -- lista con sus campañas asignadas. */
export async function GET() {
  return NextResponse.json({ portfolios: listPortfolios() });
}

/** POST /api/budget-navigator/portfolios -- Body: { name } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name es requerido" }, { status: 400 });
  }
  const portfolio = createPortfolio(name);
  return NextResponse.json({ portfolio });
}
