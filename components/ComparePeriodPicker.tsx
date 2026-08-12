"use client";

import { type FormEvent, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const PRESETS: Array<{ key: "previous" | "7d" | "30d"; label: string }> = [
  { key: "previous", label: "Periodo anterior" },
  { key: "7d", label: "7 dias antes" },
  { key: "30d", label: "30 dias antes" },
];

function withParams(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | undefined>
) {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Selector del periodo de referencia para las comparaciones del dashboard
 * central: mismo N de dias anterior (default), ventana fija de 7/30 dias, o
 * un rango personalizado.
 */
export default function ComparePeriodPicker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preset = searchParams.get("comparePreset") ?? "previous";
  const isCustom = preset === "custom";
  const [showCustom, setShowCustom] = useState(isCustom);
  const [draftFrom, setDraftFrom] = useState(searchParams.get("compareFrom") ?? "");
  const [draftTo, setDraftTo] = useState(searchParams.get("compareTo") ?? "");

  useEffect(() => {
    setShowCustom(searchParams.get("comparePreset") === "custom");
    setDraftFrom(searchParams.get("compareFrom") ?? "");
    setDraftTo(searchParams.get("compareTo") ?? "");
  }, [searchParams]);

  function go(patch: Record<string, string | undefined>) {
    window.location.assign(withParams(pathname, searchParams, patch));
  }

  function selectPreset(key: "previous" | "7d" | "30d") {
    setShowCustom(false);
    go({
      comparePreset: key === "previous" ? undefined : key,
      compareFrom: undefined,
      compareTo: undefined,
    });
  }

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftFrom || !draftTo) return;
    go({ comparePreset: "custom", compareFrom: draftFrom, compareTo: draftTo });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Comparar contra:</span>
      <div className="flex overflow-hidden rounded-md border border-line">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => selectPreset(p.key)}
            className={`h-7 px-2.5 text-xs transition-colors ${
              !showCustom && preset === p.key
                ? "bg-accent font-medium text-white"
                : "bg-surface text-ink-2 hover:bg-page"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`h-7 px-2.5 text-xs transition-colors ${
            showCustom ? "bg-accent font-medium text-white" : "bg-surface text-ink-2 hover:bg-page"
          }`}
        >
          Personalizado
        </button>
      </div>

      {showCustom && (
        <form onSubmit={applyCustom} className="flex items-center gap-1.5">
          <input
            type="date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-ink"
            aria-label="Comparar desde"
          />
          <span className="text-muted">-</span>
          <input
            type="date"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-ink"
            aria-label="Comparar hasta"
          />
          <button
            type="submit"
            className="h-7 rounded-md border border-line bg-page px-2 text-xs font-medium text-ink-2 hover:bg-surface hover:text-ink"
          >
            Aplicar
          </button>
        </form>
      )}
    </div>
  );
}
