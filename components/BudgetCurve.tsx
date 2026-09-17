"use client";

import { useEffect, useState } from "react";
import BudgetCurveChart from "./BudgetCurveChart";
import { fmtDecimal, fmtMoney, fmtPercent } from "@/lib/format";
import type { CurvePoint } from "@/lib/budgetNavigator/budgetCurve";

/**
 * Fetch + render de la curva "qué pasaría si" (GET /api/budget-navigator/curve).
 * Sin input del usuario -- se calcula sola al montar, es rápida porque no lee
 * presupuestos en vivo (ver el docstring de la ruta).
 */
export default function BudgetCurve() {
  const [curve, setCurve] = useState<CurvePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/budget-navigator/curve");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        if (!cancelled) setCurve(data.curve);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-muted">Calculando curva...</p>;
  if (error) return <p className="text-sm text-critical">{error}</p>;
  if (!curve || curve.length === 0) {
    return <p className="text-sm text-muted">Sin datos suficientes para calcular la curva.</p>;
  }

  return (
    <div className="space-y-3">
      <BudgetCurveChart data={curve} />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2.5 font-medium text-muted">Cambio</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted">Presupuesto diario</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted">ROAS proyectado</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted">Conversiones proyectadas</th>
            </tr>
          </thead>
          <tbody>
            {curve.map((p) => (
              <tr key={p.deltaPct} className="border-b border-line/60">
                <td className="px-3 py-2 font-medium text-ink">
                  {p.deltaPct === 0 ? "Actual" : `${p.deltaPct >= 0 ? "+" : ""}${fmtPercent(p.deltaPct * 100)}`}
                </td>
                <td className="px-3 py-2 text-right text-ink">{fmtMoney(p.dailyTotal)}</td>
                <td className="px-3 py-2 text-right text-ink">{fmtDecimal(p.projectedRoas)}</td>
                <td className="px-3 py-2 text-right text-ink">{fmtDecimal(p.projectedConversions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
