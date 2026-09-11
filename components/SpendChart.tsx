"use client";

import { useRef, useState, useEffect } from "react";
import { fmtCompact, fmtDecimal, fmtMoney, fmtMoneyCompact } from "@/lib/format";

export interface ChartPoint {
  date: string;
  spend: number;
  previousDate?: string;
  previousSpend?: number;
}

const W = 720;
const H = 180;
const PAD = { left: 58, right: 14, top: 12, bottom: 26 };

// Paleta Fibrand 100% · reemplaza el naranja anterior por royal deep + gradient
const CLR = {
  primary: "#1E2E9E",          // royal deep · línea principal
  primaryFill: "#354EEC",       // royal accent · para punto y gradient stop
  previous: "#B4B8CB",          // muted-2 · línea comparativa (gris frío)
  grid: "#E4E7EF",              // line token
  axisText: "#6B7085",          // muted
  crosshair: "#B4B8CB",         // muted-2
  tooltipBg: "#0F1424",         // ink
  tooltipMuted: "#B4B8CB",      // texto secundario tooltip
  tooltipAccent: "#FFCE1F",     // brand yellow para "Actual" acentuado
  pointStroke: "#FFFFFF",       // borde blanco del punto hover
};

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * mag) return m * mag;
  }
  return 10 * mag;
}

/**
 * Gráfica de línea de gasto diario · Fibrand brandbook.
 * Animación line-drawing al montar + gradient royal + hover crosshair.
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
  const [mounted, setMounted] = useState(false);
  const hasPrevious = data.some((d) => d.previousSpend !== undefined);
  const fmtTick = valueFormat === "count" ? fmtCompact : fmtMoneyCompact;
  const fmtValue = valueFormat === "count" ? fmtDecimal : fmtMoney;

  // Trigger line-drawing animation on mount
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, [data]);

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
  const tipW = 174;
  const tipX = h ? Math.min(x(hover!) + 10, W - PAD.right - tipW) : 0;

  // Longitud aproximada del path para animación stroke-dashoffset
  const pathLength = data.length * (innerW / Math.max(1, data.length - 1)) * 1.5;

  return (
    <div className="rounded-lg border border-line bg-surface p-4 transition-shadow hover:shadow-lg hover:shadow-accent/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full" style={{ background: CLR.primary }} />
            Actual
          </span>
          {hasPrevious && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: CLR.previous, borderTop: `1px dashed ${CLR.previous}` }} />
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
        {/* Gradient royal para área bajo la línea */}
        <defs>
          <linearGradient id="royalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CLR.primaryFill} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CLR.primaryFill} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* rejilla y eje Y */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={CLR.grid}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill={CLR.axisText}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {/* etiquetas eje X */}
        {data.map((d, i) =>
          i % xLabelEvery === 0 || i === data.length - 1 ? (
            <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={CLR.axisText}>
              {d.date.slice(5)}
            </text>
          ) : null
        )}

        {/* área con gradient · fade-in animación */}
        <path
          d={areaPath}
          fill="url(#royalGrad)"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.8s ease-out",
          }}
        />

        {/* línea previa (comparativo) · dashed */}
        {hasPrevious && (
          <path
            d={previousLinePath}
            fill="none"
            stroke={CLR.previous}
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeLinejoin="round"
            style={{
              opacity: mounted ? 0.7 : 0,
              transition: "opacity 0.6s ease-out 0.4s",
            }}
          />
        )}

        {/* línea principal · line drawing animation */}
        <path
          d={linePath}
          fill="none"
          stroke={CLR.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: mounted ? 0 : pathLength,
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.65, 0, 0.35, 1)",
          }}
        />

        {/* crosshair + tooltip */}
        {h && (
          <g>
            <line
              x1={x(hover!)}
              x2={x(hover!)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={CLR.crosshair}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover!)}
              cy={y(h.spend)}
              r={5}
              fill={CLR.primaryFill}
              stroke={CLR.pointStroke}
              strokeWidth={2.5}
              style={{
                filter: "drop-shadow(0 2px 4px rgba(31,53,200,0.30))",
              }}
            />
            <g transform={`translate(${tipX}, ${PAD.top + 4})`}>
              <rect width={tipW} height={hasPrevious ? 64 : 44} rx={8} fill={CLR.tooltipBg} opacity={0.96} />
              <text x={12} y={20} fontSize={11} fill={CLR.tooltipMuted}>
                {h.date}
              </text>
              <text
                x={12}
                y={36}
                fontSize={12.5}
                fontWeight={700}
                fill={CLR.tooltipAccent}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                Actual: {fmtValue(h.spend)}
              </text>
              {hasPrevious && (
                <text
                  x={12}
                  y={54}
                  fontSize={11.5}
                  fill={CLR.tooltipMuted}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
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
