"use client";

import { useRef, useState } from "react";
import { fmtCompact, fmtDecimal, fmtMoney, fmtMoneyCompact } from "@/lib/format";

export interface ChartPoint {
  date: string;
  spend: number;
  previousDate?: string;
  previousSpend?: number;
}

const W = 720;
const H = 230;
const PAD = { left: 58, right: 14, top: 14, bottom: 30 };

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * mag) return m * mag;
  }
  return 10 * mag;
}

/**
 * Gráfica de línea de gasto diario (una sola serie — el título la nombra,
 * sin leyenda). Incluye crosshair + tooltip al pasar el mouse.
 */
export default function SpendChart({
  data,
  title = "Gasto diario",
  previousLabel = "Periodo anterior",
  valueFormat = "money",
}: {
  data: ChartPoint[];
  title?: string;
  previousLabel?: string;
  /** "money" (default) formatea con $; "count" formatea como cantidad (p. ej. leads) */
  valueFormat?: "money" | "count";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hasPrevious = data.some((d) => d.previousSpend !== undefined);
  const fmtTick = valueFormat === "count" ? fmtCompact : fmtMoneyCompact;
  const fmtValue = valueFormat === "count" ? fmtDecimal : fmtMoney;

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-6 pb-6 text-center text-sm text-muted">
          Sin datos en el periodo seleccionado.
        </p>
      </div>
    );
  }

  const max = niceCeil(
    Math.max(...data.map((d) => Math.max(d.spend, hasPrevious ? d.previousSpend ?? 0 : 0)))
  );
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    data.length > 1 ? PAD.left + (i * innerW) / (data.length - 1) : PAD.left + innerW / 2;
  const y = (v: number) => PAD.top + (1 - v / max) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.spend)}`).join(" ");
  const previousLinePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.previousSpend ?? 0)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const xLabelEvery = Math.max(1, Math.ceil(data.length / 6));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD.left) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }

  const h = hover !== null ? data[hover] : null;
  // El tooltip se ancla al punto y se voltea cerca del borde derecho
  const tipW = 174;
  const tipX = h ? Math.min(x(hover!) + 10, W - PAD.right - tipW) : 0;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{title}</p>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-accent" />
            Actual
          </span>
          {hasPrevious && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-[#5b6b8c]" />
              {previousLabel}
            </span>
          )}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={title}
      >
        {/* rejilla y eje Y */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e3ddd2" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8c887f" style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {/* etiquetas eje X */}
        {data.map((d, i) =>
          i % xLabelEvery === 0 || i === data.length - 1 ? (
            <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#8c887f">
              {d.date.slice(5)}
            </text>
          ) : null
        )}
        {/* serie */}
        <path d={areaPath} fill="#a8481a" opacity={0.09} />
        {hasPrevious && (
          <path
            d={previousLinePath}
            fill="none"
            stroke="#5b6b8c"
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeLinejoin="round"
          />
        )}
        <path d={linePath} fill="none" stroke="#a8481a" strokeWidth={2} strokeLinejoin="round" />
        {/* crosshair + tooltip */}
        {h && (
          <g>
            <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={H - PAD.bottom} stroke="#c3beb2" strokeWidth={1} />
            <circle cx={x(hover!)} cy={y(h.spend)} r={4} fill="#a8481a" stroke="#fcfaf6" strokeWidth={2} />
            <g transform={`translate(${tipX}, ${PAD.top + 4})`}>
              <rect width={tipW} height={hasPrevious ? 64 : 44} rx={6} fill="#1a1613" opacity={0.94} />
              <text x={10} y={18} fontSize={11} fill="#c3beb2">
                {h.date}
              </text>
              <text x={10} y={34} fontSize={12} fontWeight={600} fill="#ffffff" style={{ fontVariantNumeric: "tabular-nums" }}>
                Actual: {fmtValue(h.spend)}
              </text>
              {hasPrevious && (
                <text x={10} y={52} fontSize={12} fill="#b9c4dc" style={{ fontVariantNumeric: "tabular-nums" }}>
                  Ant: {fmtValue(h.previousSpend ?? 0)}
                  {h.previousDate ? ` (${h.previousDate.slice(5)})` : ""}
                </text>
              )}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
