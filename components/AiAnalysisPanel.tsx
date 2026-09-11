"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";

/**
 * Panel opcional de análisis con IA (Claude). Solo funciona si el servidor
 * tiene ANTHROPIC_API_KEY configurada.
 */
export default function AiAnalysisPanel({
  platform,
  accountId,
  dateFrom,
  dateTo,
  available,
}: {
  platform: "meta" | "google";
  accountId: string;
  dateFrom: string;
  dateTo: string;
  available: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, accountId, dateFrom, dateTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Análisis con IA</p>
          <p className="text-xs text-muted">
            {available
              ? "Genera un diagnóstico de la cuenta con Claude a partir de los KPIs del periodo."
              : "Opcional — configura ANTHROPIC_API_KEY en .env.local para habilitarlo."}
          </p>
        </div>
        <button
          onClick={run}
          disabled={!available || loading || !accountId}
          className="rounded-md border border-accent px-3.5 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent"
        >
          {loading ? "Analizando…" : "Generar análisis"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-critical">{error}</p>}
      {analysis && (
        <div className="mt-3 whitespace-pre-wrap rounded-md bg-page p-4 text-sm leading-relaxed text-ink-2">
          {analysis}
        </div>
      )}
    </div>
  );
}
