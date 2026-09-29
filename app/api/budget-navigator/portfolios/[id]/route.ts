import { NextResponse } from "next/server";
import { deletePortfolio, renamePortfolio } from "@/lib/budgetNavigator/portfolios";

export const dynamic = "force-dynamic";

/** PATCH /api/budget-navigator/portfolios/{id} -- Body: { name } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name es requerido" }, { status: 400 });
  }
  renamePortfolio(Number(id), name);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/budget-navigator/portfolios/{id} */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deletePortfolio(Number(id));
  return NextResponse.json({ ok: true });
}
