"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MasterBudgetForm({ currentMonthlyBudget }: { currentMonthlyBudget: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentMonthlyBudget || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const monthlyBudget = Number(value);
    if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0) {
      setError("Ingresa un monto válido");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/budget-navigator/master-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium text-ink-2">
        Presupuesto mensual (todas las plataformas)
        <input
          type="number"
          min="0"
          step="100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 block h-9 w-44 rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="h-9 rounded-md border border-line bg-page px-3 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-50"
      >
        {busy ? "Guardando..." : "Guardar"}
      </button>
      {error && <p className="text-xs text-critical">{error}</p>}
    </form>
  );
}
