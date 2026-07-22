import { NextResponse } from "next/server";
import {
  availableActionsFor,
  getRecommendationRow,
  previewAction,
  type ActionKey,
  type Platform,
} from "@/lib/recommendationActions";

export const dynamic = "force-dynamic";

/**
 * POST /api/recommendations/{id}/preview
 * Body: { platform: "meta" | "google", action: "pause" | "budget_up" | "budget_down" }
 * Consulta el estado en vivo de la plataforma y devuelve el cambio
 * propuesto, sin aplicar nada todavía.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    platform?: Platform;
    action?: ActionKey;
  };
  const { platform, action } = body;

  if (platform !== "meta" && platform !== "google") {
    return NextResponse.json({ error: "platform debe ser meta o google" }, { status: 400 });
  }
  if (action !== "pause" && action !== "budget_up" && action !== "budget_down") {
    return NextResponse.json({ error: "action inválido" }, { status: 400 });
  }

  const rec = getRecommendationRow(platform, Number(id));
  if (!rec) {
    return NextResponse.json({ error: "Recomendación no encontrada" }, { status: 404 });
  }
  if (rec.status !== "pending") {
    return NextResponse.json(
      { error: "Esta recomendación ya no está pendiente" },
      { status: 400 }
    );
  }
  const allowed = availableActionsFor(platform, rec.level, rec.rule);
  if (!allowed.includes(action)) {
    return NextResponse.json(
      { error: "Esa acción no aplica a esta recomendación" },
      { status: 400 }
    );
  }

  try {
    const outcome = await previewAction(platform, rec, action);
    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
