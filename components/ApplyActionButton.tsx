"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_LABELS, type ActionKey } from "@/lib/recommendationActionRules";

type Phase = "loading" | "confirm" | "applying" | "done" | "error";

/**
 * Botón de acción real sobre la plataforma (pausar / ajustar presupuesto)
 * para una recomendación. Al abrir consulta el estado en vivo antes de
 * mostrar Confirmar -- nunca aplica nada sin que el usuario vea primero
 * el cambio exacto propuesto. Se usa tanto en RecommendationsBoard como
 * en el dashboard de Budget Navigator (mismas rutas /preview y /apply).
 */
export default function ApplyActionButton({
  recId,
  platform,
  action,
}: {
  recId: number;
  platform: "meta" | "google";
  action: ActionKey;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [outcome, setOutcome] = useState<{
    entityName: string;
    currentLabel: string;
    newLabel: string;
    summary: string;
    warning?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setPhase("loading");
    setError(null);
    try {
      const res = await apiFetch(`/api/recommendations/${recId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setOutcome(data);
      setPhase("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function confirm() {
    setPhase("applying");
    setError(null);
    try {
      const res = await apiFetch(`/api/recommendations/${recId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setPhase("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-md border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
      >
        {ACTION_LABELS[action]}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => phase !== "applying" && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Confirmar: ${ACTION_LABELS[action]}`}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-ink">{ACTION_LABELS[action]}</p>
            <p className="mt-0.5 text-xs text-muted">
              Esta acción se aplica de inmediato sobre la cuenta real.
            </p>

            {phase === "loading" && (
              <p className="py-6 text-center text-sm text-muted">Consultando estado actual…</p>
            )}

            {(phase === "confirm" || phase === "applying") && outcome && (
              <div className="mt-3 rounded-md bg-page px-3 py-2 text-sm">
                <p className="font-medium text-ink">{outcome.entityName}</p>
                <p className="mt-1 text-ink-2">{outcome.summary}</p>
                {outcome.warning && (
                  <p className="mt-1.5 text-xs font-medium text-warning">⚠ {outcome.warning}</p>
                )}
              </div>
            )}

            {phase === "done" && (
              <p className="mt-3 rounded-md bg-good/10 px-3 py-2 text-sm text-good-ink">
                Aplicado. La recomendación se movió a &quot;Hechas&quot;.
              </p>
            )}

            {error && <p className="mt-2 text-sm text-critical">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={phase === "applying"}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-page disabled:opacity-50"
              >
                {phase === "done" ? "Cerrar" : "Cancelar"}
              </button>
              {phase === "confirm" && (
                <button
                  onClick={confirm}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white"
                >
                  Confirmar
                </button>
              )}
              {phase === "applying" && (
                <button
                  disabled
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white opacity-50"
                >
                  Aplicando…
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
