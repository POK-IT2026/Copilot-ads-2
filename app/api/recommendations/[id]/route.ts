import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["pending", "done", "discarded"]);

/**
 * PATCH /api/recommendations/{id}
 * Body: { platform: "meta" | "google", status, note? }
 * Marcar como "done" requiere nota.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    platform?: string;
    status?: string;
    note?: string;
  };
  const { platform, status, note } = body;

  if (!VALID_STATUS.has(status ?? "")) {
    return NextResponse.json(
      { error: "status debe ser pending, done o discarded" },
      { status: 400 }
    );
  }
  if (status === "done" && (!note || note.trim() === "")) {
    return NextResponse.json(
      { error: "Marcar como hecha requiere una nota" },
      { status: 400 }
    );
  }

  const table =
    platform === "google" ? "google_ads_recommendations" : "meta_ads_recommendations";
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE ${table}
       SET status = ?,
           note = ?,
           resolved_at = CASE WHEN ? = 'pending' THEN NULL ELSE datetime('now') END
       WHERE id = ?`
    )
    .run(status, note?.trim() || null, status, Number(id));

  if (result.changes === 0) {
    return NextResponse.json({ error: "Recomendación no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
