"use client";

import { useRef, useState } from "react";
import { fmtDecimal, fmtMoney, fmtMoneyCompact } from "@/lib/format";
import type { CurvePoint } from "@/lib/budgetNavigator/budgetCurve";

const W = 720;
const H = 230;
const PAD = { left: 50, right: 14, top: 14, bottom: 30 };

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * mag) return m * mag;
  }
  return 10 * mag;
}

/**
 * Curva "qué pasaría si": eje X = presupuesto diario total (por paso de
 * CURVE_STEPS), eje Y = ROAS proyectado. Hermano visual de SpendChart (mismos
 * colores/mecánica de crosshair) pero sin relación de código -- ese es eje de
 * fecha, este es eje de presupuesto.
 */
export default function BudgetCurveChart({ data }: { data: CurvePoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">Curva de presupuesto total</p>
        <p className="mt-6 pb-6 text-center text-sm text-muted">
          Sin datos suficientes para calcular la curva.
        </p>
      </div>
    );
  }

  const currentIdx = data.findIndex((d) => d.deltaPct === 0);
  const max = niceCeil(Math.max(...data.map((d) => d.projectedRoas)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    data.length > 1 ? PAD.left + (i * innerW) / (data.length - 1) : PAD.left + innerW / 2;
  const y = (v: number) => PAD.top + (1 - (max > 0 ? v / max : 0)) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.projectedRoas)}`).join(" ");
  const areaPath = `${linePath} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD.left) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }

  const h = hover !== null ? data[hover] : null;
  const tipW = 190;
  const tipX = h ? Math.min(x(hover!) + 10, W - PAD.right - tipW) : 0;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Curva de presupuesto total</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Curva de presupuesto total"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e3ddd2" strokeWidth={1} />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill="#8c887f"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmtDecimal(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={d.deltaPct} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#8c887f">
            {d.deltaPct >= 0 ? "+" : ""}
            {Math.round(d.deltaPct * 100)}%
          </text>
        ))}
        <path d={areaPath} fill="#a8481a" opacity={0.09} />
        <path d={linePath} fill="none" stroke="#a8481a" strokeWidth={2} strokeLinejoin="round" />
        {currentIdx >= 0 && (
          <line
            x1={x(currentIdx)}
            x2={x(currentIdx)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="#5b6b8c"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {h && (
          <g>
            <line
              x1={x(hover!)}
              x2={x(hover!)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#c3beb2"
              strokeWidth={1}
            />
            <circle cx={x(hover!)} cy={y(h.projectedRoas)} r={4} fill="#a8481a" stroke="#fcfaf6" strokeWidth={2} />
            <g transform={`translate(${tipX}, ${PAD.top + 4})`}>
              <rect width={tipW} height={82} rx={6} fill="#1a1613" opacity={0.94} />
              <text x={10} y={16} fontSize={11} fill="#c3beb2">
                Presupuesto diario: {fmtMoneyCompact(h.dailyTotal)}
              </text>
              <text
                x={10}
                y={32}
                fontSize={12}
                fontWeight={600}
                fill="#ffffff"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ROAS proyectado: {fmtDecimal(h.projectedRoas)}
              </text>
              <text x={10} y={48} fontSize={11} fill="#b9c4dc">
                Gasto proyectado: {fmtMoney(h.projectedSpend)}
              </text>
              <text x={10} y={64} fontSize={11} fill="#b9c4dc">
                Conversiones: {fmtDecimal(h.projectedConversions)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
