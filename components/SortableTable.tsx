"use client";

import { useMemo, useState, type ReactNode } from "react";
import { fmtDecimal, fmtInt, fmtMoney, fmtPercent } from "@/lib/format";
import { StatusBadge } from "./Badges";
import AdPreviewButton from "./AdPreviewButton";

export type ColumnFormat = "text" | "money" | "int" | "percent" | "decimal" | "status";

export interface Column {
  key: string;
  label: string;
  format?: ColumnFormat;
}

const NUMERIC: Set<ColumnFormat> = new Set(["money", "int", "percent", "decimal"]);

function renderCell(value: unknown, format: ColumnFormat) {
  const missingNumber =
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value));
  if (NUMERIC.has(format) && missingNumber) return "—";

  switch (format) {
    case "money":
      return fmtMoney(Number(value) || 0);
    case "int":
      return fmtInt(Number(value) || 0);
    case "percent":
      return fmtPercent(Number(value) || 0);
    case "decimal":
      return fmtDecimal(Number(value) || 0);
    case "status":
      return <StatusBadge status={String(value ?? "")} />;
    default:
      return String(value ?? "");
  }
}

export default function SortableTable({
  columns,
  rows,
  initialSort,
  initialDesc = true,
  adPreviewKey,
  actionColumn,
  emptyMessage = "Sin datos en el periodo seleccionado.",
}: {
  columns: Column[];
  rows: Record<string, unknown>[];
  initialSort?: string;
  initialDesc?: boolean;
  /** Si se define, agrega una columna de vista previa usando row[adPreviewKey] como ad id */
  adPreviewKey?: string;
  /**
   * Columna genérica de acciones (p. ej. editar puja), como elementos ya
   * renderizados por el server component padre, indexados por row.id --
   * una función no puede cruzar el límite server/client de Next.js.
   */
  actionColumn?: { label: string; cells: Record<string, ReactNode> };
  emptyMessage?: string;
}) {
  const [sortKey, setSortKey] = useState<string>(initialSort ?? columns[0]?.key ?? "");
  const [desc, setDesc] = useState(initialDesc);

  const sortFormat = columns.find((c) => c.key === sortKey)?.format ?? "text";

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (NUMERIC.has(sortFormat)) {
        const an =
          av === null || av === undefined || av === "" || !Number.isFinite(Number(av))
            ? desc
              ? Number.NEGATIVE_INFINITY
              : Number.POSITIVE_INFINITY
            : Number(av);
        const bn =
          bv === null || bv === undefined || bv === "" || !Number.isFinite(Number(bv))
            ? desc
              ? Number.NEGATIVE_INFINITY
              : Number.POSITIVE_INFINITY
            : Number(bv);
        cmp = an - bn;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), "es");
      }
      return desc ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, desc, sortFormat]);

  function toggleSort(key: string, format: ColumnFormat) {
    if (key === sortKey) {
      setDesc((d) => !d);
    } else {
      setSortKey(key);
      setDesc(NUMERIC.has(format)); // numéricos: primero descendente
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b-2 border-line bg-accent/[0.03] text-left">
            {columns.map((col) => {
              const numeric = NUMERIC.has(col.format ?? "text");
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  className={`px-3.5 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wider text-muted ${
                    numeric ? "text-right" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleSort(col.key, col.format ?? "text")}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-accent-deep ${
                      active ? "text-accent-deep" : ""
                    }`}
                  >
                    {col.label}
                    <span className="text-[10px] leading-none">{active ? (desc ? "▼" : "▲") : ""}</span>
                  </button>
                </th>
              );
            })}
            {adPreviewKey && (
              <th className="px-3.5 py-2.5 text-right text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
                Vista
              </th>
            )}
            {actionColumn && (
              <th className="px-3.5 py-2.5 text-right text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
                {actionColumn.label}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={String(row[adPreviewKey ?? "id"] ?? i) + i}
              className="border-b border-line/60 transition-colors last:border-0 hover:bg-accent/5"
            >
              {columns.map((col) => {
                const numeric = NUMERIC.has(col.format ?? "text");
                return (
                  <td
                    key={col.key}
                    className={`px-3.5 py-3 ${
                      numeric ? "text-right font-semibold text-ink [font-variant-numeric:tabular-nums]" : "text-ink-2"
                    } ${col.key === "name" ? "max-w-72 truncate font-semibold text-ink" : ""}`}
                    title={col.key === "name" ? String(row[col.key] ?? "") : undefined}
                  >
                    {renderCell(row[col.key], col.format ?? "text")}
                  </td>
                );
              })}
              {adPreviewKey && (
                <td className="px-3.5 py-3 text-right">
                  <AdPreviewButton adId={String(row[adPreviewKey] ?? "")} adName={String(row.name ?? "")} />
                </td>
              )}
              {actionColumn && (
                <td className="px-3.5 py-3 text-right">
                  {actionColumn.cells[String(row.id)] ?? null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
