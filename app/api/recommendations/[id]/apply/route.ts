import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  applyAction,
  availableActionsFor,
  getRecommendationRow,
  type ActionKey,
  type Platform,
} from "@/lib/recommendationActions";

export const dynamic = "force-dynamic";

/**
 * POST /api/recommendations/{id}/apply
 * Body: { platform: "meta" | "google", action: "pause" | "budget_up" | "budget_down", note?: string }
 * Vuelve a leer el estado en vivo (nunca confía en el preview previo),
 * ejecuta la mutación real sobre Meta/Google Ads, y si tiene éxito marca
 * la recomendación como hecha con una nota automática + auditoría.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    platform?: Platform;
    action?: ActionKey;
    note?: string;
  };
  const { platform, action, note } = body;

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

  let outcome;
  try {
    outcome = await applyAction(platform, rec, action);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const appliedAt = new Date().toISOString();
  const autoNote = `Acción aplicada desde Copilot (${appliedAt}): ${outcome.summary}`;
  const finalNote = note?.trim() ? `${autoNote}\n${note.trim()}` : autoNote;
  const appliedAction = JSON.stringify({ action, appliedAt, ...outcome });

  const table = platform === "google" ? "google_ads_recommendations" : "meta_ads_recommendations";
  const db = getDb();
  db.prepare(
    `UPDATE ${table}
     SET status = 'done', note = ?, applied_action = ?, resolved_at = datetime('now')
     WHERE id = ?`
  ).run(finalNote, appliedAction, rec.id);

  return NextResponse.json({ ok: true, ...outcome });
}
