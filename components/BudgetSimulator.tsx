"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import SpendChart from "./SpendChart";
import { fmtDecimal, fmtMoney, fmtPercent } from "@/lib/format";

interface SimulationResult {
  campaignName: string;
  deltaPct: number;
  windowDays: number;
  currentDailySpend: number;
  currentConversions: number;
  currentValue: number;
  currentRoas: number;
  projectedDailySpend: number;
  projectedConversions: number;
  projectedValue: number;
  projectedRoas: number;
  dailyTrend: Array<{ date: string; spend: number; roas: number }>;
}

export default function BudgetSimulator({
  campaigns,
}: {
  campaigns: Array<{ platform: "meta" | "google"; campaignId: string; name: string }>;
}) {
  const [selected, setSelected] = useState(campaigns[0] ? `${campaigns[0].platform}:${campaigns[0].campaignId}` : "");
  const [deltaPct, setDeltaPct] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  async function simulate() {
    if (!selected) return;
    const [platform, campaignId] = selected.split(":");
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/budget-navigator/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, campaignId, deltaPct: deltaPct / 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted">No hay campañas activas para simular.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-ink-2">
          Campaña
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 block h-9 w-64 rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
          >
            {campaigns.map((c) => (
              <option key={`${c.platform}:${c.campaignId}`} value={`${c.platform}:${c.campaignId}`}>
                [{c.platform === "meta" ? "Meta" : "Google"}] {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-2">
          Cambio de presupuesto
          <input
            type="number"
            value={deltaPct}
            onChange={(e) => setDeltaPct(Number(e.target.value))}
            className="mt-1 block h-9 w-24 rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
          />
        </label>
        <span className="pb-2 text-xs text-muted">%</span>
        <button
          type="button"
          onClick={simulate}
          disabled={loading}
          className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Calculando..." : "Simular"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-critical">{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted">
            Estimación lineal basada en los últimos {result.windowDays} días de &quot;
            {result.campaignName}&quot; -- asume que la eficiencia (ROAS) se mantiene constante al
            escalar el presupuesto. En la práctica el ROAS puede bajar al escalar más allá de la
            audiencia/inventario eficiente; este número es un punto de partida, no una predicción.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-3 py-2.5 font-medium text-muted">Métrica</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted">Actual (prom/día)</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted">
                    Proyectado ({result.deltaPct >= 0 ? "+" : ""}
                    {fmtPercent(result.deltaPct * 100)})
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">Gasto diario</td>
                  <td className="px-3 py-2 text-right text-ink">{fmtMoney(result.currentDailySpend)}</td>
                  <td className="px-3 py-2 text-right text-ink">{fmtMoney(result.projectedDailySpend)}</td>
                </tr>
                <tr className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">Conversiones (periodo)</td>
                  <td className="px-3 py-2 text-right text-ink">{fmtDecimal(result.currentConversions)}</td>
                  <td className="px-3 py-2 text-right text-ink">{fmtDecimal(result.projectedConversions)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-ink">ROAS</td>
                  <td className="px-3 py-2 text-right text-ink">{fmtDecimal(result.currentRoas)}</td>
                  <td className="px-3 py-2 text-right text-ink">{fmtDecimal(result.projectedRoas)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <SpendChart
            data={result.dailyTrend.map((d) => ({ date: d.date, spend: d.spend }))}
            title="Gasto diario reciente (referencia)"
          />
        </div>
      )}
    </div>
  );
}
